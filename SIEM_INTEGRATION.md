# SIEM Integration

How to send generated logs to a SIEM. All of this is configured in a YAML config file passed with `-c`; there are no CLI flags for the output destination or format. A config file only needs the keys you change — everything else is merged from the defaults (see [CONFIGURATION.md](CONFIGURATION.md)).

## Destinations and formats

- **Destinations** (`output.destination`): `file`, `http`, `syslog`, `stdout`.
- **Formats** (`output.format`): `json`, `syslog`, `cef`, `wazuh`. (No LEEF.)

Every log is also written to a local JSON-lines history copy in `storage.currentPath` (one file per hour), regardless of destination. Set `storage.history: false` to disable it. Attack-chain runs write their own files under `logs/attack-chains/`, not to the configured destination.

Test any config for a fixed time with:
```bash
npm run generate -- -c my.yaml --duration 30s
```

## Syslog (UDP or TCP)

```yaml
output:
  destination: syslog
  format: syslog
  syslog:
    host: 10.0.0.10
    port: 514
    protocol: udp          # or tcp
    facility: local0       # name (local0-7, auth, daemon, ...) or a number 0-23
    tag: my-app            # APP-NAME; default is each source's name
    timestampFormat: RFC3164   # or RFC5424
    structuredData: true       # RFC5424 only: adds MITRE as [mitre@32473 ...]
```

- **UDP** reuses one socket and sends one datagram per log.
- **TCP** reuses one connection, sends one message per line (RFC 6587 newline framing), and reconnects if the connection drops.
- `RFC3164` produces `<PRI>MMM DD HH:MM:SS host tag: message`. `RFC5424` produces `<PRI>1 <ISO-8601 timestamp> host app - msgid [SD] message` and, with `structuredData: true`, includes the MITRE technique/tactic as structured data.

## HTTP (Splunk, Elasticsearch, generic)

```yaml
output:
  destination: http
  format: json
  http:
    url: https://siem.example.com/ingest
    method: POST            # default POST
    payload: batch          # batch | ndjson | splunk-hec | elasticsearch-bulk
    headers:
      Authorization: "Bearer ${SIEM_TOKEN}"   # ${VAR} is substituted from the environment
    timeout: 10000          # ms
    retries: 3              # network errors, 5xx and 429 are retried with backoff; 4xx is not
```

Payload shapes:

- **`batch`** (default): one JSON body `{ "logs": [ ...logs... ], "count": N, "timestamp": "..." }`. Generic; most SIEMs need one of the specific shapes below.
- **`ndjson`**: one formatted log per line.
- **`splunk-hec`**: one `{ "time", "host", "source", "sourcetype", "event" }` object per log, for Splunk's HTTP Event Collector.
- **`elasticsearch-bulk`**: alternating `{ "index": { "_index": <output.http.index> } }` action lines and documents (each with an added `@timestamp`), for the Elasticsearch `_bulk` API. `output.http.index` defaults to `log-generator`.

### Splunk HEC
```yaml
output:
  destination: http
  format: json
  http:
    url: https://splunk.example.com:8088/services/collector/event
    payload: splunk-hec
    headers:
      Authorization: "Splunk ${SPLUNK_HEC_TOKEN}"
    retries: 3
```

### Elasticsearch bulk
```yaml
output:
  destination: http
  format: json
  http:
    url: https://es.example.com:9200/_bulk
    payload: elasticsearch-bulk
    index: log-generator
    headers:
      Authorization: "ApiKey ${ES_API_KEY}"
    retries: 3
```
An Elasticsearch bulk response that reports item errors is treated as a failure (with the rejected count and error types logged).

### Wazuh
```yaml
output:
  destination: http
  format: wazuh
  http:
    url: https://wazuh.example.com:55000/events
    headers:
      Authorization: "Bearer ${WAZUH_TOKEN}"
```

## Format examples

For a firewall log, the four formats look like:

- **json**: the full log entry, e.g. `{"timestamp":"2026-01-01T10:20:30.123456Z","level":"WARN","source":{"type":"firewall","name":"pfsense-fw","host":"firewall-01","component":"pf"},"message":"...","metadata":{...},"mitre":{"technique":"T1046","tactic":"TA0007",...}}`
- **syslog** (RFC 3164): `<131>Jan 01 10:20:30 firewall-01 pfsense-fw[pf]: Port scan detected ...`
- **cef**: `CEF:0|LogGenerator|LogGen|1.0|FIREWALL|Port scan detected ...|7|rt=... dvchost=firewall-01 msg=... cs1Label=mitreTechnique cs1=T1046 cs2Label=mitreTactic cs2=TA0007 ...` (header fields escape `|`/`\`; extension values escape `\`, `=` and newlines).
- **wazuh**: JSON with `agent`, `rule` (including `rule.mitre`), `decoder`, `data`, `location` and `full_log`.

The MITRE technique/tactic is carried in `json`, in `cef` (`cs1`/`cs2`), in `wazuh` (`rule.mitre`), and in RFC 5424 syslog structured data.

## Testing throughput to a receiver

`performance-test` runs the configured generators for a set time and reports logs/second:
```bash
npm run performance-test -- --mode http --duration 10s      # uses src/config/siem-http-test.yaml
npm run performance-test -- --mode syslog --duration 10s    # uses src/config/siem-syslog-test.yaml
```
These use bundled test configs pointed at a local receiver. For maximum throughput and format/output comparisons, use `npm run benchmark` (see [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)); its receivers listen on `127.0.0.1` only.

## Notes and limits

- HTTP batches are sent when `output.batching.maxBatchSize` is reached or every `flushIntervalMs`. A batch that keeps failing after its retries is logged and dropped.
- The metrics/health server (`/health`, `/ready`, `/metrics`, `/status`) is separate from log output — see [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md).

## See also

- [CONFIGURATION.md](CONFIGURATION.md) — the full config reference
- [LOG_TYPES_REFERENCE.md](LOG_TYPES_REFERENCE.md) — what each source emits
- [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) — MITRE, attack chains, SOC, ML
- [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md) — Docker, Kubernetes, monitoring
