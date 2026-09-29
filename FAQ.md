# FAQ

Common questions about the log generator. See also the [README](README.md) and the other docs linked below.

## General

### What is this tool?
A command-line tool that generates realistic, synthetic SIEM logs from 12 source types (endpoint, firewall, authentication, database, and so on). Logs can be tagged with MITRE ATT&CK techniques, correlated into attack chains, and written to a file, an HTTP endpoint, syslog, or stdout in JSON, syslog, CEF or Wazuh format. It's for testing SIEM pipelines, detection rules, dashboards and SOC training — all data is fake.

### Is it free to use?
It's licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, modify and share it for any **noncommercial** purpose: personal projects, research, experimentation, education, and use by nonprofits, public-research, public-safety and government organizations. **Commercial use** (selling it, or building it into a commercial product or service) requires a separate license from the author. It is not GPL or MIT.

### What are the requirements?
Node.js **>= 22.12**. No Python, no GPU, no model downloads, and no network calls except to the output destination you configure.

### How do I run it?
```bash
npm install
npm run build
npm run generate -- --duration 30s
```
Or run the CLI directly: `node dist/cli.js generate --duration 30s`.

### Why don't my flags work with `npm run`?
`npm` only passes flags that come after `--`. Use `npm run generate -- --duration 1m`, not `npm run generate --duration 1m`. If you run the CLI directly (`node dist/cli.js generate --duration 1m`) you don't need the `--`.

## Configuration and output

### How do I change the output format or destination?
There are no CLI flags for these — set them in a config file and pass it with `-c`. For example a `my.yaml` with:
```yaml
output:
  destination: syslog
  format: cef
  syslog:
    host: 127.0.0.1
    port: 514
    protocol: tcp
```
then `npm run generate -- -c my.yaml`. A config file only needs the keys you change; everything else is merged from the defaults. See [CONFIGURATION.md](CONFIGURATION.md).

### Which output formats are supported?
`json`, `syslog` (RFC 3164, or RFC 5424 with `timestampFormat: RFC5424`), `cef`, and `wazuh`. There is no LEEF format.

### Which SIEMs can it feed?
- **Splunk** via HTTP Event Collector — `output.http.payload: splunk-hec`
- **Elasticsearch** via the bulk API — `output.http.payload: elasticsearch-bulk`
- **Wazuh** — `output.format: wazuh`
- Anything that takes **syslog** over UDP or TCP
- A file for a forwarder to tail

See [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) for full examples.

### Where do the logs go by default?
To `./logs/current/` as a rotating `logs.json` file. Every log is *also* kept as a JSON-lines history copy in the same directory (one file per hour), which `replay`, `analyze` and `mitre-coverage` read. Set `storage.history: false` to turn the history copy off.

## MITRE and attack chains

### How many MITRE techniques are covered?
`mitre-list` reports 15 techniques across 14 tactics, and templates carry their own MITRE tags. Filter generation with `npm run generate -- --mitre-technique T1110` (a parent technique also matches its sub-techniques, e.g. `T1110.001`), `--mitre-tactic TA0006`, or `--mitre-enabled` (only logs that carry MITRE data). If nothing configured can produce the technique you ask for, it warns instead of silently writing nothing.

### What attack chains are included?
Three templates: `apt29-cozy-bear-campaign` (aliases `apt29-cozy-bear`, `apt29`), `ryuk-ransomware-campaign` (`ransomware-ryuk`, `ryuk`), and `malicious-insider-data-theft` (`insider-threat-data-theft`, `insider-threat`). Run one with `npm run attack-chains:execute ransomware-ryuk -- --duration 5m`; it writes MITRE-tagged, correlated logs and a report to `logs/attack-chains/`.

### Do the "AI" attack-chain commands use a real AI model?
No. `attack-chains:execute-ai` and `:training` have no AI model. `--mode` and `--ai-level` vary each step's timing and log rate (from ±0% for `static` up to ±50% for `dynamic`/`advanced`) so repeated runs differ; the steps, their order and their MITRE mapping never change. They **simulate by default and write no logs** — add `--full-execution` to write real logs. There is no technique substitution, evasion or anti-forensics.

## ML

### Does the ML need Python or a GPU?
No — it's plain TypeScript using `natural` and `simple-statistics`. `ml-patterns:learn` builds a profile of your logs (sources, levels, hourly volume, message templates); `:generate` produces new logs from it; `:analyze` and `:test-anomaly` find outliers (isolation forest) and volume anomalies (z-score); `:forecast` projects volume (linear or Holt-Winters); `:threat-intel` extracts and matches indicators (IPs, domains, hashes); `:train-nlp` trains a Naive Bayes classifier and reports its measured held-out accuracy. No fixed accuracy is claimed — it depends on your data.

## Performance

### How fast is it?
On an Apple M4 Pro (14 CPUs, Node 26), one thread generates about **119,000 logs/second** across all 12 sources, and about **70,000 logs/second** end to end to a file (generate + format + send + history copy, all delivered). `generate --workers 4` reaches roughly **385,000 logs/second** of generation. Measure your own hardware with `npm run benchmark`. See [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md).

### How do I generate at very high rates?
Raise each generator's `frequency` (logs per minute) in a config, and optionally use `npm run generate -- --workers 4`. Flow control keeps memory bounded — generators pause while the output catches up. The default config is a gentle 238 logs/min in total.

## Extending

### How do I add a custom log type or template?
Templates live under `generators.<name>.templates` in the config, each with `level`, `messageTemplate`, `probability`, optional `metadata`, and optional `mitre`. Message placeholders like `{srcIP}` are filled automatically. To add a whole new generator you add a class and register it in code — see [CONFIGURATION.md](CONFIGURATION.md) and [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md).

## Reporting

### How do I report a security issue?
Use GitHub's private vulnerability reporting on [github.com/summved/log-generator](https://github.com/summved/log-generator) — see [SECURITY.md](SECURITY.md). Don't open a public issue for a vulnerability.
