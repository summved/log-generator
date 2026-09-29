# Security Policy

This is a developer tool that generates **synthetic** SIEM logs for testing and lab use.
It is not a hosted service and stores no user accounts or credentials. This policy covers
how to report a vulnerability, what is supported, the supply-chain practices the build
actually enforces, and the known limitations you should account for before running it
anywhere sensitive.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public GitHub issue.

Use GitHub's private vulnerability reporting:

1. Go to <https://github.com/summved/log-generator>
2. Open the **Security** tab → **Report a vulnerability**
3. Include a clear description, affected version/commit, reproduction steps, and impact

You'll get a response through that private advisory thread. Please allow time for
assessment and a fix before any public disclosure.

## Supported versions

| Version            | Supported |
| ------------------ | --------- |
| Current `main`     | Yes       |
| Older tags/commits | No        |

Fixes land on the current `main` line. The project requires **Node.js >= 22.12**
(`engines` in `package.json`); CI runs the test suite on Node 22.x and 24.x.

## Supply-chain and build practices

These are enforced by the repo and CI (`.github/workflows/ci-cd.yml`,
`Dockerfile`, `Dockerfile.production`, `.npmrc`):

- **Pinned base image.** Both Dockerfiles pin `node:22-alpine` by SHA256 digest, so the
  base image is immutable across builds.
- **Non-root, minimal production image.** `Dockerfile.production` runs as a dedicated
  non-root user (`loggen`, uid 1001) and removes `npm`/`npx` after install — the app runs
  with plain `node`, reducing the image's attack surface. CI asserts this: it runs the CLI
  in the image and verifies `npm`/`npx` are absent.
- **Reproducible installs.** Dependencies are installed with `npm ci` against a committed
  lockfile. `.npmrc` sets `save-exact=true` (exact versions), forces the official npm
  registry (`registry.npmjs.org`) for all scopes, and disables install-time funding output.
- **Dependency auditing.** CI runs `npm audit --audit-level=high` and fails on high or
  critical advisories. You can run the same check locally with `npm audit` (or
  `npm run security:audit`).
- **Vulnerability scanning.** CI runs Trivy in two modes and uploads SARIF to the GitHub
  **code scanning** tab: a filesystem scan of the repo, and an image scan of the built
  production image (pull requests build and scan the image locally so results compare
  against `main`).
- **GitHub Actions pinning.** The Trivy action is pinned by commit **SHA**
  (`aquasecurity/trivy-action@ed142fd…`). The other actions
  (`actions/checkout`, `actions/setup-node`, `docker/*`, `github/codeql-action`,
  `actions/upload-artifact`) are pinned by **major tag** (e.g. `@v4`), not by digest.

## Known limitations (read before production use)

Be honest with yourself about these — the tool does **not** implement rate limiting,
security headers, HTTPS enforcement, authentication, or SSRF protection. Specifically:

- **The metrics HTTP server is unauthenticated.** When monitoring is enabled, an HTTP
  server listens on `HTTP_PORT` (default **3000**) and serves `/health`, `/ready`,
  `/metrics` (Prometheus), and `/status`. It is **read-only** (GET/HEAD only; other methods
  get `405`), has **no CORS headers and no authentication**, and is intended for local/lab
  use. If you expose it in a shared or production environment, front it with your own
  controls (reverse proxy, network policy, authenticating gateway). Set
  `ENABLE_MONITORING=false` to disable it entirely.
- **Minimal environment surface.** The code reads only three environment variables:
  `HTTP_PORT`, `ENABLE_MONITORING`, and `CONFIG_PATH`. There is no `.env` loader; no secrets
  are read from the environment. (Config files may reference other variables via `${VAR}`
  syntax only if you write them in.)
- **Data goes only where you point it.** The tool sends generated logs to the
  destination configured in your config file (file, HTTP, syslog, or stdout) and nothing
  else — no telemetry, no external AI/LLM calls. HTTP output batches that keep failing are
  logged and dropped rather than retried indefinitely.

## Using it safely

- It generates **synthetic** data. Point outputs (HTTP, syslog, files) only at systems you
  own or are authorized to test.
- Do not send generated traffic to production SIEM/logging pipelines you don't control.
- Keep dependencies current and re-run `npm audit` after updates.

## License note

This project is licensed under **PolyForm Noncommercial 1.0.0** — noncommercial use only;
commercial use requires a separate license. See [LICENSE](LICENSE).

## Related docs

- [DevOps guide](DEVOPS_GUIDE.md) — deployment, Docker, and monitoring details
- [Configuration reference](CONFIGURATION.md) — output destinations and config options
