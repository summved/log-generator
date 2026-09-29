/**
 * Runs the benchmark worker (workerEntry) on several threads at once and combines the results.
 */

import * as path from 'path';
import { Worker } from 'worker_threads';
import { Measurement, toMeasurement } from './measure';
import { WorkerJob, WorkerTotals } from './workerEntry';

// Running from TypeScript source (ts-node, jest), the worker needs a TypeScript loader too
const EXTENSION = path.extname(__filename);
const ENTRY = path.join(__dirname, `workerEntry${EXTENSION}`);
const EXEC_ARGV = EXTENSION === '.ts' ? ['--require', 'ts-node/register/transpile-only'] : [];

function runOne(job: WorkerJob): Promise<WorkerTotals> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(ENTRY, { workerData: job, execArgv: EXEC_ARGV });
    worker.once('message', (message: { ok: boolean; totals?: WorkerTotals; error?: string }) => {
      if (message.ok && message.totals) resolve(message.totals);
      else reject(new Error(message.error || 'Benchmark worker failed'));
    });
    worker.once('error', reject);
    worker.once('exit', code => {
      if (code !== 0) reject(new Error(`Benchmark worker exited with code ${code}`));
    });
  });
}

/** Total throughput of `count` workers generating at the same time (time = the slowest worker) */
export async function runWorkers(count: number, job: WorkerJob): Promise<Measurement> {
  const totals = await Promise.all(Array.from({ length: count }, () => runOne(job)));
  return toMeasurement(
    `${count} worker${count === 1 ? '' : 's'}`,
    totals.reduce((sum, t) => sum + t.logs, 0),
    totals.reduce((sum, t) => sum + t.bytes, 0),
    Math.max(...totals.map(t => t.seconds))
  );
}

/** 1, 2, 4, ... up to (and always including) the CPU count */
export function workerCounts(cpus: number): number[] {
  const counts: number[] = [];
  for (let n = 1; n < cpus; n *= 2) counts.push(n);
  counts.push(Math.max(1, cpus));
  return counts;
}
