/**
 * Single-thread benchmarks: how fast the real generators create logs and the formatters turn them into text.
 */

import { BaseGenerator } from '../generators/BaseGenerator';
import { LogEntry } from '../types';
import { LOG_FORMATS, LogFormatters } from '../utils/formatters';
import { measureFor, Measurement } from './measure';

/** Logs generated per step: large enough to hide loop overhead, small enough to stop close to the duration */
export const BATCH_SIZE = 500;

function averageJsonBytes(logs: LogEntry[]): number {
  return logs.reduce((sum, log) => sum + Buffer.byteLength(JSON.stringify(log)), 0) / Math.max(1, logs.length);
}

/** Each generator on its own. Bytes are estimated from the JSON size of a sample, so timing covers generation only */
export function benchmarkGenerators(generators: Map<string, BaseGenerator>, durationMs: number): Measurement[] {
  return [...generators].map(([name, generator]) => {
    const bytesPerLog = averageJsonBytes(generator.generateLogs(100));
    const result = measureFor(name, durationMs, () => {
      generator.generateLogs(BATCH_SIZE);
      return { logs: BATCH_SIZE, bytes: BATCH_SIZE * bytesPerLog };
    });
    return { ...result, bytes: Math.round(result.bytes) };
  });
}

/** All generators taking turns, which is what `generate` does when every log type is enabled */
export function benchmarkMixedGenerators(generators: Map<string, BaseGenerator>, durationMs: number): Measurement {
  const all = [...generators.values()];
  const perGenerator = Math.max(1, Math.round(BATCH_SIZE / all.length));
  const bytesPerLog = averageJsonBytes(all.flatMap(generator => generator.generateLogs(10)));
  const result = measureFor(`all ${all.length} generators`, durationMs, () => {
    for (const generator of all) generator.generateLogs(perGenerator);
    return { logs: perGenerator * all.length, bytes: perGenerator * all.length * bytesPerLog };
  });
  return { ...result, bytes: Math.round(result.bytes) };
}

/** Each output format on the same sample, with the real formatted size */
export function benchmarkFormats(sample: LogEntry[], durationMs: number): Measurement[] {
  return LOG_FORMATS.map(format => measureFor(format, durationMs, () => {
    let bytes = 0;
    for (const log of sample) bytes += Buffer.byteLength(LogFormatters.format(format, log));
    return { logs: sample.length, bytes };
  }));
}

/** Seconds the newest generated timestamp is ahead of the clock (0 when it is not ahead) */
export function timestampLeadSeconds(lastTimestampMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.round((lastTimestampMs - nowMs) / 1000));
}
