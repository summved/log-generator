/** One benchmark result: how many logs (and bytes) were processed in how long */
export interface Measurement {
  name: string;
  logs: number;
  bytes: number;
  seconds: number;
  logsPerSecond: number;
  mbPerSecond: number;
  bytesPerLog: number;
}

export interface StepResult {
  logs: number;
  bytes: number;
}

const MB = 1024 * 1024;

export function toMeasurement(name: string, logs: number, bytes: number, seconds: number): Measurement {
  return {
    name,
    logs,
    bytes,
    seconds,
    logsPerSecond: seconds > 0 ? Math.round(logs / seconds) : 0,
    mbPerSecond: seconds > 0 ? Math.round((bytes / MB / seconds) * 100) / 100 : 0,
    bytesPerLog: logs > 0 ? Math.round(bytes / logs) : 0
  };
}

/** Run a synchronous step back to back for `durationMs` (at least once) and total what it processed */
export function measureFor(name: string, durationMs: number, step: () => StepResult): Measurement {
  let logs = 0;
  let bytes = 0;
  const start = process.hrtime.bigint();
  const end = start + BigInt(Math.max(0, durationMs)) * 1000000n;
  do {
    const result = step();
    logs += result.logs;
    bytes += result.bytes;
  } while (process.hrtime.bigint() < end);
  return toMeasurement(name, logs, bytes, Number(process.hrtime.bigint() - start) / 1e9);
}

export function elapsedSeconds(startNs: bigint): number {
  return Number(process.hrtime.bigint() - startNs) / 1e9;
}
