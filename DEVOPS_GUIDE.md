# DevOps Guide

Running the log generator with Docker, Docker Compose and Kubernetes, plus monitoring and CI. For output/SIEM configuration see [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) and [CONFIGURATION.md](CONFIGURATION.md).

## Ports

The app serves one HTTP port, `HTTP_PORT` (default **3000**), when `ENABLE_MONITORING` is not `false`. It exposes `/health`, `/ready`, `/metrics` and `/status`. There is no separate metrics port. The Kubernetes manifests, Compose file and Prometheus config all use 3000.

## Environment variables

Only three are read by the app:

| Variable | Meaning |
|---|---|
| `HTTP_PORT` | Monitoring server port (default 3000) |
| `ENABLE_MONITORING` | Set to `false` to disable the HTTP server |
| `CONFIG_PATH` | Config file for the service entry (`node dist/index.js`) |

To send logs to a SIEM from a container, use a config whose output references the environment with `${VAR}`. The shipped `src/config/siem.yaml` does this (`output.http.url: ${SIEM_HTTP_URL}`, `Authorization: Bearer ${SIEM_API_TOKEN}`):

- **Docker Compose**: `docker-compose.production.yml` already points `CONFIG_PATH` at `siem.yaml` and defaults `SIEM_HTTP_URL` to the bundled `mock-siem`, so `docker compose up` demonstrates SIEM delivery. Set `SIEM_HTTP_URL`/`SIEM_API_TOKEN` for a real SIEM, or `CONFIG_PATH=/app/src/config/default.yaml` to write files.
- **Kubernetes**: the ConfigMap (`k8s/configmap.yaml`) mounts a config with `destination: http` and the same `${VAR}` references; `SIEM_HTTP_URL`/`SIEM_API_TOKEN` come from the Secret.

`LOG_LEVEL` and `NODE_ENV` in the manifests are not read by the app.

## Docker

`Dockerfile.production` is a multi-stage build on `node:22-alpine` (pinned by digest). The runtime image runs as the non-root `loggen` user, ships without `npm`/`npx`, exposes 3000, and its entry is `node dist/index.js`. Its `HEALTHCHECK` performs an HTTP GET against `/health` on the running server.

```bash
npm run docker:build
docker run --rm -e ENABLE_MONITORING=false ghcr.io/summved/log-generator:main node dist/cli.js status
```

`docker-compose.production.yml` runs the generator (port `3000:3000`) with Prometheus, Grafana and a local httpbin receiver. `docker-compose.yml` is a development stack with Wazuh and Elasticsearch (version-tagged images).

## Kubernetes (`k8s/`)

Manifests: `namespace.yaml`, `deployment.yaml`, `service.yaml`, `hpa.yaml`, `pvc.yaml`, `configmap.yaml`, `secret.yaml`. The deployment image is `ghcr.io/summved/log-generator:main` (the tag CI pushes on merges to `main`). Probes hit `/health` and `/ready` on port 3000; the service and `prometheus.io/port` annotation use 3000. Resource requests/limits and an HPA are defined.

Caveats to plan for:
- Each replica generates the full configured volume, so multiple replicas multiply the log rate — scale the config, not just replicas, for a target rate.
- The PVCs are `ReadWriteOnce`.
- `secret.yaml` ships placeholder values — replace them before use.

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

## Monitoring

Prometheus scrapes `/metrics` on port 3000. The exposed metrics are:

- `log_generator_logs_total`
- `log_generator_logs_per_second`
- `log_generator_errors_total`
- `log_generator_uptime_seconds`
- `log_generator_by_source_total{generator}`
- `log_generator_active_generators{generator}`

A Grafana dashboard ships under `monitoring/grafana/`. `/health` returns status plus a performance summary; `/ready` returns 200 when uptime, generator count and error count are healthy (503 otherwise). The endpoints are GET-only and unauthenticated — see [SECURITY.md](SECURITY.md).

## CI (`.github/workflows/ci-cd.yml`)

On push and pull request:
- **Test Suite** on Node 22.x and 24.x: `npx tsc --noEmit`, `npm test -- --ci`, short `generate`/`validate-config`/`performance-test`/`benchmark` runs, a `Dockerfile.production` build with `node dist/cli.js status` and a check that npm/npx are absent, and `npm audit --audit-level=high`.
- **Security scanning**: Trivy filesystem and image scans, uploaded as SARIF to code scanning.
- On `main`: a benchmark run whose JSON report is kept as an artifact.

CI does **not** run `npm run test:smoke` — run that locally (it needs `perl` and rebuilds `dist/`).

## See also

- [CONFIGURATION.md](CONFIGURATION.md) — config reference (incl. `${VAR}` and storage paths)
- [SIEM_INTEGRATION.md](SIEM_INTEGRATION.md) — sending logs to a SIEM
- [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md) — throughput and sizing
- [SECURITY.md](SECURITY.md) — security posture and reporting
