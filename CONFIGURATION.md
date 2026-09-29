# Configuration

This guide covers how to configure the log generator: the config file format, how partial
files merge over the built-in defaults, environment-variable substitution, the `config` and
`init` commands, and every real config section with its actual default values.

The config file is the **only** way to change what gets generated and where it goes. The
`generate` command has no `--count`, `--output`, `--host`, or `--format` flags — rates, format,
and destination all come from config. See [README.md](README.md) for a quick start and the full
command list.

---

## Config file basics

The config is YAML. The shipped defaults live in `src/config/default.yaml` (12 generators plus
`replay`, `output`, and `storage`). You never edit that file directly — instead you provide your
own file that is **merged over the defaults**.

### A config file only needs what it changes

Your file is deep-merged on top of the built-in defaults, key by key:

- Anything you omit keeps its default value.
- Generators you do not mention keep their default rates and templates.
- To turn a generator off, set `enabled: false` on it.
- For a list value (for example `replay.filters.sources`), the value in your file **replaces**
  the default list rather than concatenating.

So a complete, valid config can be as small as:

```yaml
# my-config.yaml — everything else keeps its default
generators:
  iot:
    enabled: false          # turn off the IoT generator
  database:
    frequency: 60           # 60 logs/min instead of the default 30
output:
  destination: stdout       # write logs to stdout instead of a file
```

Your file **must** be a YAML mapping. It is loaded through `ConfigManager`, which requires the
merged result to contain `generators`, `output`, and `storage` (the defaults always supply
these, so a partial file is fine).

### Selecting a config file

Two ways, checked in this order:

1. `-c, --config <path>` on the command (highest priority).
2. The `CONFIG_PATH` environment variable.

If neither is set, the shipped `default.yaml` is used as-is.

```bash
# With npm scripts, flags MUST come after `--`
npm run generate -- -c ./my-config.yaml

# Or via the environment variable
CONFIG_PATH=./my-config.yaml npm run generate

# Direct node invocation needs no `--`
node dist/cli.js generate -c ./my-config.yaml
```

`CONFIG_PATH` is one of only three environment variables the tool itself reads (the others are
`HTTP_PORT` and `ENABLE_MONITORING`, both for the local metrics server). There is no `.env`
loader.

### Environment-variable substitution in string values

Any **string** value in the config may reference environment variables:

- `${VAR}` — replaced with the value of `VAR`. If `VAR` is not set and has no default, loading
  fails with a clear error (the config never silently keeps a literal `${...}`).
- `${VAR:-default}` — uses `VAR` if set, otherwise the literal `default`.

```yaml
output:
  destination: http
  http:
    url: ${SIEM_HTTP_URL:-http://localhost:55000/api/events}
    headers:
      Authorization: Bearer ${SIEM_TOKEN}     # required; load errors if unset
```

This is the recommended way to keep secrets (tokens, URLs) out of the committed config file.
Never hardcode credentials in the YAML.

---

## The `config` and `init` commands

### `init` — create a config file to edit

`init` copies the shipped defaults to a new file so you have a full, editable starting point.
It will not overwrite an existing file.

```bash
npm run init                        # writes ./config.yaml
npm run init -- -o ./my-config.yaml # custom path
```

### `config` — inspect and set values

There is no `npm run config` script, so run `config` directly with `node dist/cli.js` (after
`npm run build`) or `npx ts-node src/cli.ts`.

```bash
# Show the fully merged, effective config as JSON
node dist/cli.js config --show
npx ts-node src/cli.ts config --show

# Read one dotted key
node dist/cli.js config --get generators.endpoint.frequency

# Set one key (writes an override file, NOT the shipped defaults)
node dist/cli.js config --set generators.endpoint.frequency=20
node dist/cli.js config --set output.destination=stdout -c ./my-config.yaml
```

Notes:

- `--show` and `--get` reflect the **merged** result (`-c` / `CONFIG_PATH` are honoured).
- `--set` **never** rewrites the shipped `default.yaml`. It writes to the `-c` file if you pass
  one, otherwise to `./config.yaml`, creating the file and any intermediate keys as needed. The
  written file holds only the keys you set; it is merged over the defaults when you next run.
- `--set` parses values: `true`/`false` become booleans, numeric strings become numbers,
  everything else stays text.

### `validate-config` — advisory checks

`validate-config` loads a config and reports errors and performance warnings. It is advisory:
it helps you catch mistakes but does not change any files.

```bash
npm run validate-config -- -c ./my-config.yaml
node dist/cli.js validate-config -c ./my-config.yaml
```

---

## `generators`

Each of the 12 generators has the same shape:

```yaml
generators:
  <name>:
    enabled: true          # set false to disable this generator
    frequency: 10          # logs per minute
    templates: [ ... ]      # message templates (level, messageTemplate, probability, metadata, mitre)
```

The 12 generator names and their **default `frequency`** (logs per minute) from `default.yaml`:

| Generator        | Default frequency (logs/min) |
|------------------|------------------------------|
| `endpoint`       | 10  |
| `application`    | 15  |
| `server`         | 8   |
| `firewall`       | 20  |
| `cloud`          | 12  |
| `authentication` | 25  |
| `database`       | 30  |
| `webserver`      | 40  |
| `email`          | 15  |
| `backup`        | 8   |
| `microservices`  | 35  |
| `iot`            | 20  |
| **Total**        | **238** |

All are `enabled: true` by default. Each ships with several `templates`, each having a `level`
(`INFO`/`WARN`/`ERROR`/`DEBUG`), a `messageTemplate` with `{placeholder}` fields, a `probability`
(0–1, how often that template is picked), `metadata`, and optional MITRE ATT&CK tags. See
[LOG_TYPES_REFERENCE.md](LOG_TYPES_REFERENCE.md) for the full template and field reference.

### `frequency` is honoured exactly

`frequency` is the number of logs per minute the generator emits — it is not a cap or an
estimate. The whole-config default is **238 logs/min** (the sum above). To change the volume,
change the frequencies you care about; generators you leave out keep their defaults.

```yaml
# ~600 logs/min total: bump the two busiest generators, disable IoT
generators:
  webserver:
    frequency: 300
  database:
    frequency: 200
  iot:
    enabled: false
```

```yaml
# A quiet stream: just authentication at 5 logs/min, everything else off
generators:
  endpoint:    { enabled: false }
  application: { enabled: false }
  server:      { enabled: false }
  firewall:    { enabled: false }
  cloud:       { enabled: false }
  database:    { enabled: false }
  webserver:   { enabled: false }
  email:       { enabled: false }
  backup:      { enabled: false }
  microservices: { enabled: false }
  iot:         { enabled: false }
  authentication:
    frequency: 5
```

When using `--workers N`, the configured rates are shared across the worker threads, so the
total output is unchanged. See [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) for throughput
details.

---

## `output`

Controls the log format and where logs are sent.

```yaml
output:
  format: json          # json | syslog | cef | wazuh
  destination: file     # file | http | syslog | stdout
  batching:
    enabled: true
    maxBatchSize: 1000
    flushIntervalMs: 100
  file: { ... }
  syslog: { ... }
  http: { ... }
```

- **`format`** — `json` (the full log entry), `syslog` (RFC 3164 or 5424), `cef`, or `wazuh`
  (JSON with `agent`/`rule`/`decoder`/`data`). MITRE ATT&CK data is preserved in `json`, `cef`,
  `wazuh`, and RFC 5424 syslog structured data.
- **`destination`** — where formatted logs go: `file`, `http`, `syslog`, or `stdout`.

See [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) for format details and receiver setup.

### `output.batching`

| Key               | Default | Meaning |
|-------------------|---------|---------|
| `enabled`         | `true`  | Batch logs before writing/sending |
| `maxBatchSize`    | `1000`  | Flush once this many logs are queued |
| `flushIntervalMs` | `100`   | Flush at least this often (ms) |

### `output.file` (used when `destination: file`)

| Key           | Default                    | Meaning |
|---------------|----------------------------|---------|
| `path`        | `./logs/current/logs.json` | Output file path |
| `rotation`    | `true`                     | Rotate by size (on by default when `maxSize` is set) |
| `maxSize`     | `100MB`                    | Rotate before a write would exceed this |
| `maxFiles`    | `10`                       | Number of rotated files to keep |
| `compression` | `true`                     | Gzip rotated files |

### `output.syslog` (used when `destination: syslog`)

| Key               | Default      | Meaning |
|-------------------|--------------|---------|
| `host`            | `localhost`  | Syslog server host |
| `port`            | `514`        | Syslog server port |
| `protocol`        | `udp`        | `udp` (reused socket) or `tcp` (reused connection, newline framing, auto-reconnect) |
| `facility`        | `local0`     | Facility name (`local0`, `auth`, …) or number `0`–`23` |
| `tag`             | source name  | APP-NAME; defaults to each source's name when unset |
| `timestampFormat` | `RFC3164`    | `RFC3164` or `RFC5424` |
| `structuredData`  | `true`       | RFC 5424 only: emit MITRE ATT&CK data as structured data |

### `output.http` (used when `destination: http`)

| Key       | Default (shipped)                       | Meaning |
|-----------|-----------------------------------------|---------|
| `url`     | `http://localhost:55000/api/events`     | Endpoint to POST to |
| `method`  | `POST`                                  | HTTP method |
| `payload` | `batch`                                 | Body shape: `batch` (`{logs, count, timestamp}`), `ndjson`, `splunk-hec`, or `elasticsearch-bulk` |
| `index`   | `log-generator`                         | Index name, used by `elasticsearch-bulk` |
| `headers` | `Authorization`, `X-Source` (see below) | Request headers (put tokens here via `${VAR}`) |
| `timeout` | `5000`                                  | Per-request timeout in ms |
| `retries` | `3`                                     | Retries on network errors, 5xx, and 429 (with backoff); 4xx is not retried |

The shipped `default.yaml` sets `timeout: 5000` and `retries: 3`. If you omit these keys
entirely, the code falls back to `timeout: 10000` and `retries: 0`. Shipped default headers:

```yaml
output:
  destination: http
  http:
    url: ${SIEM_HTTP_URL:-http://localhost:55000/api/events}
    method: POST
    payload: batch
    headers:
      Authorization: Bearer ${SIEM_TOKEN}
      X-Source: log-generator
    timeout: 5000
    retries: 3
```

---

## `storage`

Controls where logs are archived and how long they are kept.

```yaml
storage:
  currentPath: ./logs/current       # live/history logs
  historicalPath: ./logs/historical # rotated archives
  retention: 30                     # days to keep historical logs
  history: true                     # keep the hourly history copy (default true)
```

| Key              | Default              | Meaning |
|------------------|----------------------|---------|
| `currentPath`    | `./logs/current`     | Directory for the running/history copy |
| `historicalPath` | `./logs/historical`  | Directory for rotated archives |
| `retention`      | `30`                 | Days of historical logs to retain |
| `history`        | `true`               | Whether to keep the hourly history copy |

### The hourly history copy

Regardless of the `output.destination`, every generated log is **also** written as a
JSON-lines history copy under `storage.currentPath`, one file per hour named
`logs_YYYY-MM-DD_HH-00-00.jsonl`. This is what `replay`, `analyze`, and `status` read back.

Set `storage.history: false` to disable this copy (for example, when you only want logs sent to
your SIEM and do not need local replay):

```yaml
storage:
  history: false
```

A background job rotates the current logs into `historicalPath` daily (01:00 UTC) and cleans up
past the `retention` window (02:00 UTC).

---

## `replay`

Defaults for the `replay` command (all overridable by `replay` CLI flags):

```yaml
replay:
  enabled: false
  speed: 1        # 1 = real time, 2 = 2x, etc.
  loop: false     # restart when the log set ends
  filters:
    sources: []   # empty = all sources
    levels: []    # empty = all levels
```

---

## Related docs

- [README.md](README.md) — quick start and command overview
- [LOG_TYPES_REFERENCE.md](LOG_TYPES_REFERENCE.md) — generators, templates, and fields
- [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) — output formats and receiver setup
- [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) — rates, workers, and throughput
- [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) — attack chains, SOC simulation, ML patterns
- [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) — how config loading and generation work
- [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md) — Docker, Kubernetes, and the metrics server
- [FAQ.md](FAQ.md) — common questions
- [SECURITY.md](SECURITY.md) — secret handling and safe use
