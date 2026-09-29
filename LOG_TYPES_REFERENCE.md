# Log Types Reference

Reference for SIEM rule writers and anyone who needs to know exactly what each log source emits: its source identity, its default rate, every message template it can produce, the probability of each template, and the MITRE ATT&CK technique attached to security-relevant templates.

Everything here is generated from the code: source identities in `src/generators/<Name>Generator.ts` and templates/frequencies in `src/config/default.yaml`. If you edit a config file, your values override these defaults (a partial config is merged over the built-in defaults — see [CONFIGURATION.md](CONFIGURATION.md)).

---

## How to read this document

- **Source identity** — the fixed `type`, `name`, `host`, `component` (and `service` for the five infrastructure sources) each generator stamps on every log via `source`. `metadata.host` is set to the source `host`.
- **Frequency** — default `logs/min` for that generator from `default.yaml`. Rates come only from config; there is no `--count` or per-source rate flag on `generate`.
- **Templates** — each generator selects one template per log by weighted random draw. The **probability** column is the real `probability` value from `default.yaml`; per generator these sum to 1.0. The **level** is the emitted log level. The message column paraphrases the `messageTemplate` (placeholders like `{clientIP}` are filled at generation time with faker-generated values; IPs are IPv4).
- **MITRE** — the `technique` / `tactic` attached to that template in config. Templates without a MITRE column carry no template-level mapping, though the engine may still auto-map a technique from the message text at runtime (see [MITRE mapping](#mitre-mapping)).

The 12 generators are wired in `src/generators/createGenerators.ts` in this order: endpoint, application, server, firewall, cloud, authentication, database, webserver, email, backup, microservices, iot. Default total rate is **238 logs/min**.

---

## Metadata every log carries

Beyond the per-template metadata fields, `src/utils/templateEngine.ts` adds these to every log's `metadata`:

| Field | Value |
|-------|-------|
| `host` | The source `host` (falls back to source `name`). |
| `environment` | One of `production`, `staging`, `development` (random per log). |
| `version` | A semver string (faker-generated). |
| `correlationId` | A UUID v4. |
| `generator` | The source `name` (e.g. `api-gateway`, `postgres-primary`). |
| _template metadata_ | The `metadata` block from the selected template (e.g. `component`, `sessionId`, `ruleId`). The template's `component` is what appears in `metadata.component`; the source's own `component` lives on `source`. |

Each log also has top-level `timestamp`, `level`, `source` (the full identity object), `message`, and — when a technique applies — a `mitre` block. Timestamps are **ISO-8601 with 6 fractional digits**, unique and monotonic (and unique across worker threads).

---

## Output formats

The same log entries render to any of these `output.format` values (see [CONFIGURATION.md](CONFIGURATION.md) and [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md)):

- **json** — the full `LogEntry`, including the `mitre` block and all metadata.
- **syslog** — RFC 3164 by default, or RFC 5424 (which carries MITRE as structured data `[mitre@32473 ...]`).
- **cef** — `CEF:0|LogGenerator|LogGen|1.0|<TYPE>|<message>|<sev>|<k=v...>`, with MITRE in `cs1`/`cs2`.
- **wazuh** — JSON with `agent` / `rule` (including `rule.mitre`) / `decoder` / `data`.

(No LEEF format.) A JSON-lines history copy is also kept per hour in `storage.currentPath` unless `storage.history` is disabled.

---

## Infrastructure sources

### Endpoint — `api-gateway`

- **Source identity:** type `endpoint`, name `api-gateway`, host `api.example.com`, service `gateway`, component `nginx`
- **Default frequency:** 10 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | HTTP `{method} {path}` returned `{status}` in `{responseTime}`ms, with client IP and user | 0.5 | — |
| ERROR | HTTP `{method} {path}` failed with `{status}` and `{errorMessage}`, with client IP and user | 0.1 | T1190 / TA0001 (Exploit Public-Facing Application) |
| WARN | Rate limit exceeded for a client IP on `{path}` (`{attemptCount}`/min) | 0.15 | T1110 / TA0006 (Brute Force) |
| DEBUG | Request headers dump for a session on `{path}` | 0.2 | — |
| WARN | Suspicious request pattern `{patternType}` from a client IP with a risk score | 0.05 | T1071 / TA0011 (Application Layer Protocol) |

### Application — `business-app`

- **Source identity:** type `application`, name `business-app`, host `app-server-01`, service `web-application`, component `spring-boot`
- **Default frequency:** 15 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | User performed `{action}` on `{resourceId}` with duration, session, and role | 0.4 | — |
| ERROR | Database connection failed with pool name and retry count | 0.08 | T1078 / TA0001 (Valid Accounts) |
| WARN | High memory usage `{memoryUsage}%` for a process/PID vs threshold | 0.12 | T1496 / TA0040 (Resource Hijacking) |
| INFO | Cache `{cacheOperation}` for a key, with result, TTL, and hit rate | 0.25 | — |
| DEBUG | API call to `{apiEndpoint}` with method, status, duration, and user | 0.1 | — |
| WARN | Business rule violation `{ruleName}` by a user with severity | 0.05 | T1078 / TA0001 (Valid Accounts) |

### Server — `linux-server`

- **Source identity:** type `server`, name `linux-server`, host `srv-prod-01`, service `system`, component `systemd`
- **Default frequency:** 8 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | System load with CPU / memory / disk usage and uptime | 0.3 | — |
| ERROR | Disk space critical on `{mountPoint}` with free space vs threshold | 0.05 | T1499 / TA0040 (Endpoint Denial of Service) |
| WARN | High CPU usage for a duration, naming the top process vs threshold | 0.15 | T1496 / TA0040 (Resource Hijacking) |
| INFO | Service `{serviceName}` `{action}` with PID, status, and uptime | 0.3 | — |
| DEBUG | Network interface RX/TX bytes, status, and speed | 0.1 | — |
| WARN | Memory pressure with swap usage and available memory | 0.1 | T1496 / TA0040 (Resource Hijacking) |

### Firewall — `pfsense-fw`

- **Source identity:** type `firewall`, name `pfsense-fw`, host `firewall-01`, service `firewall`, component `pf`
- **Default frequency:** 20 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | ACCEPT `{protocol}` src→dst with rule ID and byte count | 0.6 | — |
| WARN | DROP `{protocol}` src→dst with rule ID, reason, and threat level | 0.25 | T1562.004 / TA0005 (Disable or Modify System Firewall) |
| ERROR | Intrusion detected: `{attackType}` from a src IP, blocked by a rule, with severity | 0.05 | T1562.001 / TA0005 (Disable or Modify Tools) |
| DEBUG | Connection state `{state}` between src and dst with duration | 0.05 | — |
| WARN | Port scan detected from a src IP over `{portRange}` with scan type | 0.05 | T1046 / TA0007 (Network Service Scanning) |

### Cloud — `aws-cloudtrail`

- **Source identity:** type `cloud`, name `aws-cloudtrail`, host `aws-region-us-east-1`, service `aws`, component `cloudtrail`
- **Default frequency:** 12 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | AWS `{service}` API call `{awsOperation}` by a user, with request ID, region, duration | 0.4 | — |
| WARN | Auto-scaling `{action}` for an instance in a region, with reason and current capacity | 0.2 | T1059.003 / TA0002 (Windows Command Shell) |
| ERROR | S3 bucket access denied for a user, with action, client IP, and reason | 0.1 | T1078 / TA0001 (Valid Accounts) |
| INFO | Lambda function executed with duration, memory used, and cold-start flag | 0.15 | — |
| WARN | EC2 instance stopped unexpectedly with reason and uptime | 0.1 | T1499 / TA0040 (Endpoint Denial of Service) |
| DEBUG | CloudWatch metric threshold exceeded with value, threshold, and namespace | 0.05 | — |

---

## Security and identity sources

### Authentication — `auth-service`

- **Source identity:** type `authentication`, name `auth-service`, host `auth-01`, component `identity-provider`
- **Default frequency:** 25 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | User login successful from a client IP, with session and auth method | 0.5 | — |
| WARN | Failed login attempt for a user from a client IP (`{attemptCount}`/5) with reason | 0.2 | T1110.001 / TA0006 (Password Guessing) |
| ERROR | Account locked after multiple failed attempts, with lock duration | 0.05 | T1110 / TA0006 (Brute Force) |
| INFO | Password changed for a user, naming the password policy | 0.05 | T1098 / TA0003 (Account Manipulation) |
| WARN | Suspicious login from unusual location `{location}` with a risk score | 0.08 | T1078 / TA0001 (Valid Accounts) |
| INFO | User logout with session duration and reason | 0.02 | — |
| DEBUG | Auth token refresh with token type and expiry | 0.1 | — |

### Web server — `nginx-proxy`

- **Source identity:** type `webserver`, name `nginx-proxy`, host `web-01`, component `reverse-proxy`
- **Default frequency:** 40 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Access-log line: client IP, `{method} {path} {status}`, response size, user agent, duration | 0.5 | — |
| WARN | Rate limiting activated for a client IP (`{requestCount}`/min) vs threshold on `{path}` | 0.1 | T1110 / TA0006 (Brute Force) |
| ERROR | Backend `{backendHost}` unreachable with error code and retry count | 0.05 | — |
| INFO | SSL certificate expires in `{daysToExpiry}` days for a domain, with issuer | 0.02 | — |
| WARN | Large response `{responseSize}`MB for `{path}` vs threshold | 0.08 | — |
| ERROR | Request timeout on `{path}` exceeding `{timeout}`s, with client and backend | 0.15 | — |
| DEBUG | Cache hit for `{path}` with cache key and TTL | 0.1 | — |

---

## Data and storage sources

### Database — `postgres-primary`

- **Source identity:** type `database`, name `postgres-primary`, host `db-01`, component `database-server`
- **Default frequency:** 30 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Query executed: `{queryType}` on `{tableName}` with duration, DB user, row count | 0.4 | — |
| WARN | Slow query detected (>1000ms threshold) with the query and DB user | 0.15 | T1505.003 / TA0003 (Server Software Component) |
| ERROR | Database connection failed with pool, DB user, and retry count | 0.05 | T1078 / TA0001 (Valid Accounts) |
| INFO | Transaction committed across `{tableCount}` tables, with duration and DB user | 0.2 | — |
| ERROR | Deadlock detected: transaction rolled back, naming affected tables | 0.02 | — |
| WARN | High connection count `{connectionCount}`/`{maxConnections}` for a DB pool | 0.08 | — |
| DEBUG | Database backup started with estimated size and DB user | 0.05 | — |
| WARN | Suspicious database access: DB user reading a sensitive table, with query type | 0.05 | T1003 / TA0006 (OS Credential Dumping) |

### Backup — `backup-service`

- **Source identity:** type `backup`, name `backup-service`, host `backup-01`, component `backup-agent`
- **Default frequency:** 8 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Backup completed with size, duration, and file count | 0.3 | — |
| WARN | Backup size increased vs previous run, with growth rate | 0.2 | T1499 / TA0040 (Endpoint Denial of Service) |
| ERROR | Backup failed with error and retry count | 0.1 | T1490 / TA0040 (Inhibit System Recovery) |
| INFO | Retention cleanup removed `{deletedCount}` old backups, freeing space | 0.15 | — |
| WARN | Storage space low on `{storagePath}` with usage vs threshold | 0.15 | T1499 / TA0040 (Endpoint Denial of Service) |
| DEBUG | Backup verification with integrity result and checksum | 0.1 | — |

---

## Modern architecture sources

### Microservices — `service-mesh`

- **Source identity:** type `microservices`, name `service-mesh`, host `k8s-01`, component `api-gateway`
- **Default frequency:** 35 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Service called `{targetService}` with method, duration, and status | 0.3 | — |
| WARN | Circuit breaker opened for a service, with failure rate vs threshold | 0.1 | T1499 / TA0040 (Endpoint Denial of Service) |
| ERROR | Service health check failed on `{healthEndpoint}` with status and response time | 0.05 | T1499 / TA0040 (Endpoint Denial of Service) |
| INFO | Service scaled `{oldInstances}`→`{newInstances}` with reason and CPU usage | 0.15 | — |
| WARN | High latency between two services (`{latency}`ms) vs threshold | 0.2 | T1499 / TA0040 (Endpoint Denial of Service) |
| INFO | Service discovery: a service registered at `{serviceUrl}` with version and health | 0.1 | — |
| DEBUG | Service-mesh trace with trace ID, span ID, operation, and duration | 0.1 | — |

### Email — `mail-server`

- **Source identity:** type `email`, name `mail-server`, host `mail-01`, component `smtp-service`
- **Default frequency:** 15 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Email sent from `{sender}` to `{recipient}` with subject, message ID, size | 0.4 | — |
| WARN | Email delivery delayed with retry attempt and reason | 0.2 | T1566 / TA0001 (Phishing) |
| ERROR | Email delivery failed (final attempt) with error message | 0.1 | T1566 / TA0001 (Phishing) |
| WARN | Spam detected from `{sender}` with spam score and action | 0.15 | T1566 / TA0001 (Phishing) |
| ERROR | Email quota exceeded for a sender vs limit | 0.05 | T1499 / TA0040 (Endpoint Denial of Service) |
| DEBUG | Email authentication (`{authMethod}`) result and score for a sender | 0.1 | — |

### IoT — `iot-hub`

- **Source identity:** type `iot`, name `iot-hub`, host `iot-01`, component `device-manager`
- **Default frequency:** 20 logs/min

| Level | Message (paraphrased) | Prob. | MITRE |
|-------|-----------------------|-------|-------|
| INFO | Device connected with IP, type, firmware version, and signal strength | 0.25 | — |
| WARN | Device battery low `{batteryLevel}%` with location and last-charge time | 0.2 | T1499 / TA0040 (Endpoint Denial of Service) |
| ERROR | Device offline with last-seen time, uptime, and reason | 0.1 | T1499 / TA0040 (Endpoint Denial of Service) |
| INFO | Sensor data: temperature, humidity, and pressure for a device | 0.2 | — |
| WARN | Device firmware outdated (current vs latest) with pending security patches | 0.15 | T1499 / TA0040 (Endpoint Denial of Service) |
| DEBUG | Device telemetry: CPU, memory, storage usage, and uptime | 0.1 | — |
| WARN | Suspicious device behavior `{patternType}` with risk score and location | 0.05 | T1078 / TA0001 (Valid Accounts) |

---

## Default rate summary

| Category | Sources | Rate (logs/min) |
|----------|---------|-----------------|
| Infrastructure | endpoint (10), application (15), server (8), firewall (20), cloud (12) | 65 |
| Security & identity | authentication (25), webserver (40) | 65 |
| Data & storage | database (30), backup (8) | 38 |
| Modern architecture | microservices (35), email (15), iot (20) | 70 |
| **Total** | **12 sources** | **238** |

Frequencies are honoured exactly. Change them per source in a config file; `enabled: false` turns a source off. See [CONFIGURATION.md](CONFIGURATION.md).

---

## MITRE mapping

Templates that model a security-relevant condition carry a `mitre` block (`technique`, `tactic`) shown above. For templates without one, the engine still attempts to auto-map a technique from the message text and metadata at runtime (`src/generators/BaseGenerator.ts` → `mitreMapper`). The mapper covers a curated set (15 techniques across 14 tactics).

List the supported techniques and tactics with:

```bash
npm run mitre-list --
# or directly:
node dist/cli.js mitre-list
```

To generate only logs matching a technique or tactic, use `generate --mitre-technique <T####>` / `--mitre-tactic <TA####>` (a parent technique also matches its sub-techniques). See [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md).

---

## Not one of the 12: SecurityOperationsGenerator (`soc-platform`)

`src/generators/SecurityOperationsGenerator.ts` defines a separate source — type `application`, name `soc-platform`, host `soc-01.enterprise.local`, service `security-operations`, component `siem`. It is **not** part of the 12-generator set and is not driven by the `generators` config or the `generate` command. It is used only by `soc-simulation`, which emits SOC / D3FEND activity at an intensity-controlled rate. See [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md).

---

## Related docs

- [README.md](README.md) — overview and quick start
- [CONFIGURATION.md](CONFIGURATION.md) — config schema, per-source toggles, frequencies, output formats
- [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) — shipping these logs to a SIEM
- [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md) — MITRE filtering, attack chains, SOC simulation, ML
- [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) — throughput and worker threads
- [CODE_ARCHITECTURE.md](CODE_ARCHITECTURE.md) — how generators and templates are wired
- [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md) — running in containers and Kubernetes
- [FAQ.md](FAQ.md) — common questions
- [SECURITY.md](SECURITY.md) — security posture and limitations
