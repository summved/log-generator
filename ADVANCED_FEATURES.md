# Advanced Features

MITRE ATT&CK, D3FEND, attack chains, SOC simulation and the Node-only ML. For output and deployment see [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md), [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) and [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md). Remember `--` before flags with `npm run`.

## MITRE ATT&CK

Templates carry MITRE technique/tactic tags, and message text is auto-mapped where possible.

```bash
npm run mitre-list                                   # supported techniques and tactics (15 / 14)
npm run generate -- --mitre-technique T1110 --duration 1m   # only T1110 (and its sub-techniques)
npm run generate -- --mitre-tactic TA0006 --duration 1m     # only that tactic
npm run generate -- --mitre-enabled --duration 1m           # only logs that carry MITRE data
npm run mitre-coverage -- -f <historical-file>       # coverage across a stored file
```

The filters return **only** matching logs (a parent technique also matches its sub-techniques). If nothing in the enabled config can produce the requested technique/tactic, `generate` warns rather than writing nothing.

## D3FEND

Defensive-technique coverage, mostly via the SOC generator (below).

```bash
npm run d3fend-list                        # supported D3FEND techniques
npm run d3fend-coverage -- <paths...>      # which D3FEND techniques appear in log files
npm run soc-simulation:d3fend-coverage
```

## Attack chains

Three multi-stage templates, each writing MITRE-tagged, correlated logs plus a JSON report to `logs/attack-chains/` (or `--output-dir`):

| Chain | Aliases |
|---|---|
| `apt29-cozy-bear-campaign` | `apt29-cozy-bear`, `apt29` |
| `ryuk-ransomware-campaign` | `ransomware-ryuk`, `ryuk` |
| `malicious-insider-data-theft` | `insider-threat-data-theft`, `insider-threat` |

```bash
npm run attack-chains:list
npm run attack-chains:info ryuk
npm run attack-chains:execute ransomware-ryuk -- --duration 5m     # or --speed 2.0
npm run attack-chains:coverage
```

`attack-chains:execute` is what writes real chain logs. By default it writes a correlated JSONL file (and a report) to `logs/attack-chains/`; pass **`-c <config>`** to send the chain's logs to that config's output instead (destination and format — e.g. straight to a SIEM over HTTP or syslog), the same delivery path `generate` uses. Other options: `--speed`, `--duration`, `--output-dir`, `--continue-on-failure`, `--no-randomize-timing`, `--no-progress-logging`, `--no-report`. A running execution lives in its process, so a separate `attack-chains:status`/`:abort` invocation won't see it — stop a run with Ctrl+C.

```bash
npm run attack-chains:execute ransomware-ryuk -- -c siem.yaml --duration 5m   # deliver to your SIEM
```

### "AI" attack-chain commands (honest description)

There is **no AI model**. `--mode` (`static`/`enhanced`/`dynamic`) and `--ai-level` (`basic`/`medium`/`high`/`advanced`) vary each step's duration, delay and log rate so repeated runs differ:

| mode / level | variation |
|---|---|
| `static` (any level) | none — run the chain as defined |
| `enhanced` / `dynamic`, basic → advanced | ±10% → ±20% → ±35% → ±50% |

The steps, their order and their MITRE mapping never change. There is no technique substitution, evasion or anti-forensics.

```bash
npm run attack-chains:execute-ai ryuk -- --mode dynamic --ai-level high            # simulates (no logs)
npm run attack-chains:execute-ai ryuk -- --mode dynamic --ai-level high --full-execution   # writes logs
npm run attack-chains:training ryuk -- --variations 5                              # progressive levels
npm run attack-chains:preview ryuk -- --mode enhanced --ai-level medium
npm run attack-chains:ai-options ryuk
npm run attack-chains:ai-statistics
```

Simulation is the default and writes no logs; add `--full-execution` to write real logs. `training` accepts `--variations`, `--no-progressive` and `--full-execution`. `ai-statistics` reads a persisted history (`logs/attack-chains/ai-executions.jsonl`), so it works across runs.

## SOC simulation

Generates realistic SOC-analyst and defensive (D3FEND) activity from a `soc-platform` source.

```bash
npm run soc-simulation:scenarios
npm run soc-simulation:run threat-hunting -- --duration 10m --analysts 3 --intensity high
```

- Scenarios: `incident-response`, `threat-hunting`, `network-defense`, `malware-analysis`, `compliance-audit`.
- `--analysts` 1–6 sizes the analyst pool.
- `--intensity` sets the rate: `low` 60, `medium` 300, `high` 1200 logs/min.

## ML (Node only)

Hand-written TypeScript using `natural` and `simple-statistics` — no Python, GPU or model downloads.

```bash
npm run ml-patterns:learn -- <paths...>              # learn a profile -> models/ml-patterns/profile.json
npm run ml-patterns:generate <source> -- --count 20 # generate logs for a learned source
npm run ml-patterns:analyze -- <paths...>           # message templates, outliers, indicators
npm run ml-patterns:test-anomaly -- <paths...>      # volume z-score anomalies + rare levels/sources
npm run ml-patterns:forecast -- <paths...>          # linear or Holt-Winters volume forecast
npm run ml-patterns:threat-intel -- <paths...> --iocs list.txt   # extract + match IPs/domains/hashes
npm run ml-patterns:train-nlp -- <paths...> --label source       # Naive Bayes; reports measured accuracy
npm run ml-patterns:status                          # show the learned profile
npm run ml-patterns:config                          # show/change ml settings
npm run ml-patterns:reset                           # delete the profile + classifiers
```

- **learn/generate**: a profile captures sources, levels, hourly volume, and message templates (with number slots); generation reuses those shapes with fresh values.
- **analyze / test-anomaly**: message grouping, isolation-forest outliers, and volume z-score anomalies.
- **forecast**: linear trend, or additive Holt-Winters when a daily/weekly cycle fits better (`--seasonality auto|none|daily|weekly`).
- **threat-intel**: regex extraction of IPv4, domains, emails and hashes, matched against an optional indicator list.
- **train-nlp**: predicts `level`, `source` or `technique` from message text and reports its held-out accuracy against a majority baseline — no fixed accuracy is claimed.

## Performance, output and monitoring

- Worker threads and throughput: [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md).
- Output formats and SIEM wiring: [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md).
- Docker, Kubernetes and metrics: [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md).
