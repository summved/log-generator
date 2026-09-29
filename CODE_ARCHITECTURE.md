# Code Architecture

A map of the source for contributors. The tool is a TypeScript Node CLI; run it with `npx ts-node src/cli.ts <cmd>` in development or `node dist/cli.js <cmd>` after `npm run build`. Tests are co-located `*.test.ts` files run with Jest.

## Entry points

- `src/cli.ts` — the CLI (commander). Defines every command (`generate`, `replay`, `attack-chains:*`, `soc-simulation:*`, `ml-patterns:*`, `benchmark`, `performance-test`, `config`, `analyze`, …).
- `src/index.ts` — the long-running service entry (`node dist/index.js`); builds a `LogGeneratorManager` from `CONFIG_PATH` and starts it. Used by the Docker image.

## Project layout (`src/`)

```
LogGeneratorManager.ts     Orchestrates generation: builds generators, runs them
                           (main thread or worker threads), applies MITRE filter +
                           metrics, writes output, starts the monitoring server.
cli.ts / index.ts          CLI and service entry points.

config/
  default.yaml             The built-in defaults (all sections + templates).
  index.ts                 ConfigManager: loads default.yaml, merges a user config
                           over it, validates.
  loadConfig.ts            Deep-merge over defaults + ${VAR} substitution.
  configFile.ts            Read/write single dotted keys (config --get/--set).

generators/
  BaseGenerator.ts         Timer-driven generation, exact rate scheduling,
                           pause()/resume(), generateLogs(n), generateLogEntry().
  <Type>Generator.ts       The 12 sources (endpoint, application, server, firewall,
                           cloud, authentication, database, webserver, email, backup,
                           microservices, iot) — each supplies its LogSource.
  createGenerators.ts      Builds the 12 generators from config (used by the manager
                           and the worker threads). GENERATOR_NAMES lists them.
  SecurityOperationsGenerator.ts  Separate SOC/D3FEND generator (soc-platform),
                           used by soc-simulation, not one of the 12.
  index.ts                 Re-exports.

chains/
  AttackChainManager.ts    Loads templates (src/chains/templates/*.yaml), runs chains.
  AttackChainEngine.ts     Executes a chain's steps, emits events.
  StepLogFactory.ts        Builds a step's MITRE-tagged logs.
  StepLogSink.ts           Writes chain logs + report (via StorageManager).
  chainTiming.ts           Duration / speed helpers.

stubs/
  WorkingAIFeatures.ts     EnhancedAttackChainManager for attack-chains:execute-ai /
                           training / preview / ai-options / ai-statistics.
  variationProfile.ts      Maps --mode/--ai-level to a timing/log-rate variation.

ml/                        Node-only ML: logProfile, logTemplates, logAnalysis,
                           logOutliers, isolationForest, logTextClassifier,
                           volumeAnalysis, indicators, mlSettings, random.

workers/
  GenerationWorkers.ts     Main-thread side: starts N generation workers, collects
                           their logs, acks batches, applies backpressure.
  generationWorker.ts      Worker body: runs the real generators, its own timestamp
                           slots, sends batches, pauses on backpressure.
  splitGenerators.ts       Splits each generator's rate across N workers.
  backpressure.ts          Bounds in-flight logs (pause/resume).
  workerScript.ts          Starts a worker from a sibling module (ts-node or dist).

benchmark/                 `benchmark` command: runBenchmark, inProcess (generators,
                           formats), outputs, workers/workerEntry, localReceivers,
                           measure, options, report.

replay/ReplayManager.ts    Replays historical logs at a speed.

utils/
  outputManager.ts         Batches and writes to file/http/syslog/stdout + history.
  rotatingFile.ts          Size-based file rotation (+ optional gzip).
  syslogSender.ts          UDP socket / TCP connection reuse.
  httpPayload.ts           batch / ndjson / splunk-hec / elasticsearch-bulk bodies.
  httpSender.ts            HTTP send with timeout + retries.
  formatters.ts            json / syslog / cef / wazuh formatting.
  templateEngine.ts        Fills {placeholders}; placeholderValues.ts has the values.
  storage.ts               History copy (hourly files) + historical reads.
  timestampSequencer.ts    Unique, monotonic, 6-digit timestamps (per-thread slots).
  timestampValidator.ts    analyze --fix (microsecond-preserving).
  httpServer.ts            /health /ready /metrics /status (read-only).
  metricsCollector.ts      Prometheus metrics.
  mitreMapper.ts / mitreFilter.ts   MITRE technique data + generate filtering.
  d3fendMapper.ts / d3fendCoverage.ts   D3FEND data + coverage.
  configValidator.ts       Advisory config validation.
  logFiles.ts / logger.ts  Log-file reading; winston logger (to stderr + files).

types/                     index.ts (Config, LogEntry, ...) and attackChain.ts.
```

## Key components

- **`LogGeneratorManager`** builds the generators via `createGenerators()`, and for each generated log calls `handleLog()` — record metrics, apply the MITRE filter (`matchesMitreFilter`), then write through `OutputManager` under a `Backpressure` limit. With `--workers N` it runs `GenerationWorkers` instead of the in-process generators; with a SOC option it runs a single `SecurityOperationsGenerator`. It also starts the monitoring HTTP server unless `ENABLE_MONITORING=false`.
- **`BaseGenerator`** schedules on a timer, emitting exactly the number of logs due since it started (so `frequency`, in logs/min, is honoured over time), and supports `pause()`/`resume()` for flow control. `generateLogEntry()` is a concrete method; subclasses only supply the `LogSource`.
- **`TemplateEngine.render()`** fills message and metadata placeholders in one pass, one value per placeholder per log; unknown names are guessed from the name.
- **`OutputManager`** batches logs and writes them to the destination (via `RotatingFileWriter`, `SyslogSender`, or `HttpSender`) and to the history copy (`StorageManager`).
- **Worker threads**: `GenerationWorkers` starts workers, each running the real generators at `1/N` of the rate with its own timestamp slots; batches are acknowledged and backpressure bounds memory. `workerScript` loads the worker under ts-node or from `dist/`.

## Data flows

- **Generation**: generator (timer) → `handleLog` → metrics + MITRE filter → `OutputManager` (destination + history). With workers: worker generators → batch → main thread `handleLog` → same path.
- **Attack chains**: `AttackChainManager` → `AttackChainEngine` → `StepLogFactory` → `StepLogSink` → `logs/attack-chains/`. This path is independent of `LogGeneratorManager`/`OutputManager`.
- **ML**: `ml-patterns:learn` → `logProfile` → `models/ml-patterns/profile.json`; `:generate`/`:analyze`/etc. read it.

## Extension points

- **New log source**: add a `BaseGenerator` subclass that supplies its `LogSource`, register it in `createGenerators.ts` (the map and `GENERATOR_NAMES`), add it to `Config['generators']` in `types/index.ts`, and add a default entry in `config/default.yaml`.
- **New output format**: add it to `LOG_FORMATS` and the switch in `utils/formatters.ts`, and to the `output.format` union in `types/index.ts`. The benchmark picks it up from `LOG_FORMATS`.

## Testing

- `npm test` — Jest, ~377 tests in co-located `*.test.ts` files.
- `npm run test:smoke` — `scripts/smoke-test.sh`, ~63 end-to-end checks against local receivers (needs `perl`; rebuilds `dist/`). Not run by CI.

## See also

- [CONFIGURATION.md](CONFIGURATION.md), [ADVANCED_FEATURES.md](ADVANCED_FEATURES.md), [PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md), [DEVOPS_GUIDE.md](DEVOPS_GUIDE.md)
