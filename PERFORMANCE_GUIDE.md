# Performance Guide

This guide is for performance and operations engineers. It covers how to measure the
Log Generator's throughput, what the current measurements are, how `generate --workers`
behaves under load, and how to size hardware for a target rate.

The golden rule: **measure on your own hardware.** All numbers below come from one machine
(Apple M4 Pro, 14 CPUs, `darwin arm64`, Node v26.9.0). Your CPU, storage and receiver will
differ. Run `npm run benchmark` to get numbers for your box before you plan capacity.

> Node: the project requires Node >= 22.12 (see `package.json` engines); the figures here were
> measured on Node 26.

---

## Measuring throughput: `npm run benchmark`

`benchmark` runs the real generators, formatters and `OutputManager` flat out, with no rate
timers, and reports the maximum throughput each stage can sustain. It is the tool for finding
**capacity**.

```bash
npm run benchmark                                              # all phases, 3s per measurement
npm run benchmark -- --duration 1s                            # quicker, less stable numbers
npm run benchmark -- --phases generators,formats             # only some phases
npm run benchmark -- --phases workers --workers 1,2,4,8      # specific worker counts
npm run benchmark -- --format cef                            # format the worker phase produces
npm run benchmark -- --json report.json                      # also save the full report as JSON
```

With npm, flags must come after `--` or npm consumes them. If you run the compiled CLI directly
(`node dist/cli.js benchmark ...`) you omit the `--`.

### Options

| Option | Meaning | Default |
|---|---|---|
| `-d, --duration <time>` | Time per measurement (e.g. `500ms`, `3s`, `1m`) | `3s` |
| `--phases <list>` | Which phases to run: `generators,formats,outputs,workers` | all four |
| `--workers <list>` | Worker-thread counts to try, e.g. `1,2,4` | doubling up to the CPU count |
| `--format <format>` | Format the worker phase produces: `json`, `syslog`, `cef`, `wazuh` | `json` |
| `--json <file>` | Also write the full report as JSON | off |

### Phases

| Phase | What it measures |
|---|---|
| `generators` | Each of the 12 generators on one thread, then all 12 together |
| `formats` | `json`, `syslog`, `cef` and `wazuh` formatting on the same sample |
| `outputs` | The full output path (generate + format + send + per-log history copy) to a temp file, and to HTTP and UDP syslog receivers, and history storage on its own |
| `workers` | All generators plus formatting on N worker threads, up to the CPU count |

The `outputs` phase talks only to **local receivers on `127.0.0.1`** that the benchmark starts
itself, and it counts how many logs actually arrived. Nothing leaves the machine.

---

## Measured results (M4 Pro, 14 CPUs, Node 26, 3s per measurement)

### Generators — single thread, generation only

Each generator produces logs of a slightly different size, so per-generator rates vary. All 12
running together on one thread produce about **119,000 logs/s**.

| Generator | Logs/s |
|---|---|
| server | 228,614 |
| backup | 170,246 |
| firewall | 163,117 |
| iot | 160,888 |
| database | 156,663 |
| microservices | 149,172 |
| application | 137,027 |
| cloud | 134,150 |
| webserver | 114,375 |
| authentication | 105,079 |
| email | 103,523 |
| endpoint | 102,732 |
| **all 12 together** | **118,530** |

### Formats — single thread, formatting only

| Format | Logs/s |
|---|---|
| json | 1,067,962 |
| wazuh | 787,655 |
| cef | 334,134 |
| syslog | 275,272 |

Formatting is never the bottleneck: even the slowest format is far faster than the output path.

### Outputs — generate + format + send + history copy (local receivers, 100% delivered)

| Destination | Logs/s | Delivered |
|---|---|---|
| file | 70,466 | 100% |
| HTTP | 59,196 | 100% |
| syslog (UDP) | 50,229 | 100% |
| history storage only | 84,452 | 100% |

Every log is also kept as a JSON-lines **history copy** (one file per hour) unless you set
`storage.history: false`. The history copy alone runs at ~84,000 logs/s, and because it writes a
second copy of every log it roughly **doubles the disk write volume** of file output. It is the
main reason end-to-end file output (~70k/s) is slower than raw generation (~119k/s). File output
is the fastest destination on this machine; HTTP and syslog are close behind.

### Worker threads — all generators, generate + format as json, no output

| Workers | Logs/s |
|---|---|
| 1 | 103,812 |
| 2 | 197,615 |
| 4 | 385,173 |
| 8 | 641,876 |
| 14 | 617,816 |

Generation + formatting scales almost linearly to about **642,000 logs/s at 8 workers**, then
flattens (and slightly regresses at 14, once workers contend for all cores). This phase does no
output, so it shows the ceiling of the generation side, not what a real run can deliver.

**Takeaway:** the generators and formatters are not the limit. The **output/write path is the
limit** — file output tops out near the speed of the per-log history copy. Add workers to feed
the output faster, but you cannot exceed what the single write path can absorb.

---

## Generating at full force: `generate --workers N`

`generate` produces logs at the rates set in your config (`frequency`, logs per minute per
generator — see [CONFIGURATION.md](./CONFIGURATION.md)). To drive it flat out, set frequencies
higher than the machine can produce; generation then runs as fast as the output can write.

```bash
npm run generate -- --workers 4 --duration 30s      # 4 worker threads share the configured rates
npm run generate -- --workers 4                      # run until Ctrl+C
```

### How `--workers N` splits the rate

With `--workers N`, each worker thread runs **every enabled generator at 1/N of its configured
rate**, so the total rate is exactly what the config says — more workers means more parallelism,
not more logs. The **main thread** applies MITRE filters and metrics, then does all the writing:
sending to the destination and writing the history copy.

### Flow control keeps memory bounded

Generation pauses itself when too many logs are still waiting to be written, so memory stays flat
over time instead of growing without bound:

- **Without workers:** the main-thread generators pause while more than **50,000** logs are still
  in flight (`MAX_PENDING_OUTPUTS`), and resume once the backlog drains.
- **With workers:** each worker pauses while more than **20,000** of its own logs are still
  unacknowledged by the main thread (`MAX_UNACKED_LOGS`), and resumes as they settle.

Because of this, the in-flight log buffers are bounded by design. As a rough guide at the measured
~676 bytes/log, the main-thread backlog caps at roughly 50,000 × 676 B ≈ 34 MB of pending log
data, and each worker's backlog at roughly 20,000 × 676 B ≈ 14 MB, on top of Node's own baseline.
Run your own workload and watch RSS to confirm — memory should stay flat, not climb.

### More workers stop helping — the sweet spot is around 4

The main thread does all the writing, so once it saturates, adding workers no longer raises the
delivered rate; it only adds memory and scheduling overhead. In practice the sweet spot for a
single `generate` process is **around 4 workers**. Confirm the knee for your hardware with
`npm run benchmark -- --phases workers` and a few `generate --workers` values.

### `performance-test` vs `benchmark`

- **`performance-test`** runs the *configured* generators at their *configured* rates for a set
  time and reports logs generated and logs/s. It answers "how does my configured rate actually
  run?" — not "what is the maximum?".
- **`benchmark`** runs flat out to find **capacity**.

```bash
npm run performance-test -- --mode worker --workers 4 --duration 30s
npm run performance-test -- --mode disk --duration 10s
npm run performance-test -- --mode http --duration 10s
npm run performance-test -- --mode syslog --duration 10s
```

Options: `--mode <disk|http|syslog|worker>` (default `worker`), `--workers <count>` (default `4`),
`--duration <time>` (default `10s`). For maximum throughput, use `benchmark`.

---

## Timestamps at high rates

Timestamps stay on the wall clock even when generation runs far faster than one log per
microsecond. Each log carries an ISO 8601 timestamp with **six fractional digits**; logs within
the same instant take successive sub-microsecond slots, and each worker thread gets its own slot
range so timestamps never collide across threads. You get unique, monotonic, on-the-clock
timestamps at any of the rates above.

---

## Hardware sizing

These are **approximate** starting points derived from the measurements above, on one machine.
They are for planning only — **run `npm run benchmark` on your own hardware** and size from those
numbers, because CPU, storage speed and (for network output) the receiver all move the ceiling.

### The ceiling is the write path, not the CPU

On the reference machine, a single core generates + formats ~100,000 logs/s (1-worker phase), but
end-to-end delivery caps much lower because writing is single-threaded on the main thread:

- file: ~70,000 logs/s
- HTTP: ~59,000 logs/s
- syslog (UDP): ~50,000 logs/s

So for target rates up to roughly 50,000 logs/s, you are bound by the write path, not by cores.
Extra cores help only up to the ~4-worker sweet spot, where they keep the main thread fed.

### Rough sizing by target sustained rate

| Target delivered rate | CPU | RAM | Disk |
|---|---|---|---|
| Up to ~10,000 logs/s | 2–4 cores | A few hundred MB over Node baseline | Any SSD; ~13 MB/s written incl. history |
| ~10,000–50,000 logs/s | 4+ cores; `--workers 4` | ~100 MB in-flight buffers over baseline | SSD; ~65 MB/s written incl. history |
| Approaching the ceiling (~50,000–70,000 logs/s) | 4–8 cores; the main write thread is the limit | Bounded by flow control; watch RSS | Fast local SSD/NVMe; ~90 MB/s written incl. history |

Notes on the disk column (measured ~676 bytes/log):

- Bytes/s ≈ logs/s × ~676 B **× 2** when the history copy is on (it writes every log a second
  time). For example, 50,000 logs/s ≈ 34 MB/s of delivered logs plus ~34 MB/s of history ≈
  ~68 MB/s total.
- Setting `storage.history: false` removes the second write and lifts the disk ceiling, at the
  cost of losing the local history used by `replay`, `analyze` and `status`.

### RAM

Flow control (the 50,000 / 20,000 in-flight limits above) keeps memory bounded and flat over
time, so RAM scales with the number of workers, not with run duration. Budget for Node's baseline
plus the bounded in-flight buffers (tens of MB per worker). If RSS climbs steadily during a run,
that is a signal to investigate, not expected behavior.

### Network output

For HTTP and syslog destinations, the **receiver** is usually the real limit in production — the
measured ~59k (HTTP) and ~50k (syslog) figures used loopback receivers on `127.0.0.1` with zero
network latency. Size and test against your actual SIEM. See
[SIEM_INTEGRATION.md](./SIEM_INTEGRATION.md) for destination configuration and batching, and
[SECURITY.md](./SECURITY.md) for hardening the metrics endpoint and outbound connections.

---

## Related docs

- [README.md](./README.md) — overview and quick start
- [CONFIGURATION.md](./CONFIGURATION.md) — generator rates, output destinations, batching, storage
- [LOG_TYPES_REFERENCE.md](./LOG_TYPES_REFERENCE.md) — the 12 generators and their fields
- [SIEM_INTEGRATION.md](./SIEM_INTEGRATION.md) — HTTP and syslog output for SIEMs
- [ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md) — attack chains, SOC simulation, ML patterns
- [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) — how generation, workers and output fit together
- [DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md) — Docker, Kubernetes, monitoring
- [FAQ.md](./FAQ.md) — common questions
- [SECURITY.md](./SECURITY.md) — security posture and hardening
