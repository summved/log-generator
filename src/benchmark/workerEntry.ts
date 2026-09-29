/**
 * Worker-thread body for the benchmark: builds the real generators from the config and
 * generates + formats logs back to back for the given time, then reports the totals.
 */

import { parentPort, workerData } from 'worker_threads';
import { ConfigManager } from '../config';
import { createGenerators } from '../generators/createGenerators';
import { LogFormat, LogFormatters } from '../utils/formatters';
import { measureFor } from './measure';
import { BATCH_SIZE } from './inProcess';

export interface WorkerJob {
  configPath?: string;
  durationMs: number;
  format: LogFormat;
}

export interface WorkerTotals {
  logs: number;
  bytes: number;
  seconds: number;
  lastTimestamp: string;
}

function run(job: WorkerJob): WorkerTotals {
  const generators = [...createGenerators(new ConfigManager(job.configPath).getConfig().generators).values()];
  const perGenerator = Math.max(1, Math.round(BATCH_SIZE / generators.length));
  let lastTimestamp = '';
  const result = measureFor('worker', job.durationMs, () => {
    let bytes = 0;
    for (const generator of generators) {
      for (const log of generator.generateLogs(perGenerator)) {
        bytes += Buffer.byteLength(LogFormatters.format(job.format, log));
        lastTimestamp = log.timestamp;
      }
    }
    return { logs: perGenerator * generators.length, bytes };
  });
  return { logs: result.logs, bytes: result.bytes, seconds: result.seconds, lastTimestamp };
}

if (parentPort) {
  try {
    parentPort.postMessage({ ok: true, totals: run(workerData as WorkerJob) });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
