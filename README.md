# SIEM Log Generator

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A TypeScript/Node.js CLI that generates realistic, high-volume synthetic logs for SIEM testing, detection engineering, security training, and load testing — with MITRE ATT&CK tagging, D3FEND coverage reporting, attack-chain simulation, and Node-only ML analysis. Everything runs locally: nothing is sent anywhere except the output destination you configure.

## Features

- **12 log sources** — endpoint, application, server, firewall, cloud, authentication, database, webserver, email, backup, microservices, and IoT. Each carries a source host and component, and rates are driven entirely by config.
- **MITRE ATT&CK tagging and filtering** — logs are auto-mapped to techniques/tactics; generate only matching logs with `--mitre-technique` / `--mitre-tactic`. List and analyze coverage with `mitre-list` and `mitre-coverage`.
- **D3FEND coverage** — list defensive techniques (`d3fend-list`) and report which appear in your logs (`d3fend-coverage`).
- **Attack-chain simulation** — 3 correlated, MITRE-tagged campaign templates: APT29 (Cozy Bear), Ryuk ransomware, and malicious-insider data theft. Simulate by default, or write real chain logs with `--full-execution`.
- **Honest "AI" variation** — the AI-enhanced modes vary each step's timing, delay, and log rate (±10–50%) only. There is no model, no evasion, and no change to step order or MITRE mapping.
- **Node-only ML** — learn a behavioral profile and generate from it, plus anomaly detection (volume z-scores, isolation-forest outliers), volume forecasting (linear trend / Holt-Winters), IOC extraction and matching, and a Naive Bayes text classifier that reports measured held-out accuracy. Hand-written TypeScript with `natural` and `simple-statistics` — no Python, transformers, GPUs, or model downloads.
- **Worker threads with flow control** — spread generation across CPU cores with `generate --workers N`; the configured rate is shared across workers and flow control keeps memory bounded.
- **Output formats** — `json`, `syslog` (RFC 3164/5424), `cef`, and `wazuh`. MITRE data is preserved in each.
- **Destinations** — `file` (with rotation, size limits, and gzip compression), `http` (batch, NDJSON, Splunk HEC, Elasticsearch bulk), `syslog` (UDP/TCP), and `stdout`.
- **Monitoring** — built-in Prometheus metrics and health endpoints for Grafana dashboards.
- **Docker & Kubernetes** — production-ready container images and k8s manifests.

## Quick Start

Requires **Node.js >= 22.12**.

```bash
git clone https://github.com/summved/log-generator.git
cd log-generator
npm install
npm run build
```

```bash
# Generate logs for 30 seconds (npm scripts need `--` before flags)
npm run generate -- --duration 30s

# Generate only logs mapped to a MITRE technique, for 1 hour
npm run generate -- --mitre-technique T1110 --duration 1h

# Generate across 4 worker threads
npm run generate -- --workers 4

# Simulate an attack chain (writes no logs by default)
npm run attack-chains:execute -- apt29-cozy-bear-campaign
```

After `npm run build` you can run the compiled CLI directly, where flags need **no** `--`:

```bash
node dist/cli.js generate --duration 30s
node dist/cli.js mitre-list
```

Generated logs are written to your configured destination and also kept as a JSON-lines history copy under `logs/current/` (one file per hour), which `replay`, `analyze`, and `status` read back.

## Performance

Measured on an Apple M4 Pro (14 CPUs, Node 26) with `npm run benchmark`:

- **~119,000 logs/s** — all 12 generators, single-thread generation.
- **~70,000 logs/s** — end-to-end to a file (generate + format + send + history copy).
- **~385,000 logs/s** — generation with 4 worker threads (generate + format, no output).

Run `npm run benchmark` to measure your own hardware. See **[PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)** for methodology and tuning.

## Commands

npm scripts mirror the CLI; remember to put flags after `--`.

| Command | Description |
|---|---|
| `npm run generate` | Generate logs from all configured sources |
| `npm run replay` | Replay historical logs |
| `npm run analyze` | Analyze historical log files for timestamp issues |
| `npm run validate-config` | Validate a configuration file (advisory warnings) |
| `npm run status` | Show generator/replay status |
| `npm run init` | Create a new configuration file |
| `npm run benchmark` | Measure max throughput: generators, formats, outputs, workers |
| `npm run performance-test` | Run configured generators for a set time (disk/http/syslog/worker) |
| `npm run mitre-list` | List supported MITRE ATT&CK techniques and tactics |
| `npm run mitre-coverage` | Report MITRE coverage in historical logs |
| `npm run d3fend-list` | List supported D3FEND defensive techniques |
| `npm run d3fend-coverage` | Report D3FEND coverage in log files |
| `npm run attack-chains:list` | List attack-chain templates |
| `npm run attack-chains:execute` | Execute (simulate) an attack chain |
| `npm run attack-chains:execute-ai` | Run a chain with timing/log-rate variation (no AI model) |
| `npm run attack-chains:training` | Run multiple chain variations for training |
| `npm run soc-simulation:scenarios` | List SOC simulation scenarios |
| `npm run soc-simulation:run` | Run a SOC simulation scenario |
| `npm run ml-patterns:learn` | Learn a behavioral profile from historical logs |
| `npm run ml-patterns:analyze` | Report patterns, anomalies, and indicators |
| `npm run ml-patterns:forecast` | Forecast log volume per time window |
| `npm run ml-patterns:threat-intel` | Extract and match IOCs |
| `npm run ml-patterns:train-nlp` | Train a text classifier, report held-out accuracy |

Full command list: `ENABLE_MONITORING=false npx ts-node src/cli.ts --help` (or `node dist/cli.js --help` after building).

## Output Formats & Destinations

Configure output via a YAML config file passed with `-c` (a partial file is merged over the built-in defaults).

- **Formats:** `json`, `syslog` (RFC 3164/5424), `cef`, `wazuh`.
- **Destinations:** `file` (rotation, size limits, gzip), `http` (batch / NDJSON / Splunk HEC / Elasticsearch bulk), `syslog` (UDP/TCP), `stdout`.

Tested against Splunk (HEC), Elastic/ELK, Wazuh, and any syslog-compatible SIEM. See **[SIEM_INTEGRATION.md](SIEM_INTEGRATION.md)** for setup guides.

## Monitoring

When monitoring is enabled (default), an HTTP server exposes `/health`, `/ready`, `/status`, and `/metrics` (Prometheus) on `HTTP_PORT` (default `3000`):

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

The metrics server is read-only and unauthenticated — intended for local/lab use. Disable it with `ENABLE_MONITORING=false`.

## Requirements

- **Node.js >= 22.12** (see `engines` in `package.json`).
- No Python, external AI/LLM APIs, or network calls beyond your configured output destination.

## Documentation

| Guide | Description |
|---|---|
| [CONFIGURATION.md](CONFIGURATION.md) | Configuration options and precedence |
| [LOG_TYPES_REFERENCE.md](LOG_TYPES_REFERENCE.md) | Breakdown of all 12 log sources |
| [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) | Integrating with SIEM platforms |
| [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) | Benchmarking and performance tuning |
| [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) | ML patterns, attack chains, D3FEND |
| [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) | Developer documentation and internals |
| [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md) | Docker, Kubernetes, and deployment |
| [FAQ.md](FAQ.md) | Frequently asked questions |
| [SECURITY.md](SECURITY.md) | Security policy and considerations |

## Contributing

1. Create a feature branch.
2. Verify locally: `npx tsc --noEmit`, `npm test`, and `npm run test:smoke`.
3. Open a pull request.

## License

Licensed under the **PolyForm Noncommercial License 1.0.0** — see [LICENSE](LICENSE). You may use, modify, and share it for any **noncommercial** purpose (personal projects, research, education, nonprofits, and government). **Commercial use requires a separate license** from the author.

## Acknowledgments

- **MITRE ATT&CK** and **MITRE D3FEND** frameworks for threat and defensive modeling.
