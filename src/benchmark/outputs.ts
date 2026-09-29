/**
 * Output benchmarks: logs go through the tool's real OutputManager (and its per-log history storage)
 * to a temporary file, a local HTTP receiver or a local UDP syslog receiver.
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { BaseGenerator } from '../generators/BaseGenerator';
import { Config, LogEntry } from '../types';
import { OutputManager } from '../utils/outputManager';
import { StorageManager } from '../utils/storage';
import { LocalReceivers } from './localReceivers';
import { elapsedSeconds, Measurement, toMeasurement } from './measure';
import { BATCH_SIZE } from './inProcess';

export type OutputDestination = 'file' | 'http' | 'syslog';
export const OUTPUT_DESTINATIONS: OutputDestination[] = ['file', 'http', 'syslog'];

export interface OutputMeasurement extends Measurement {
  /** Logs that reached the destination (file lines or receiver counts) */
  delivered: number;
}

export interface OutputRun {
  generators: Map<string, BaseGenerator>;
  output: Config['output'];
  durationMs: number;
  receivers: LocalReceivers;
}

function mixedBatch(generators: BaseGenerator[]): LogEntry[] {
  const perGenerator = Math.max(1, Math.round(BATCH_SIZE / generators.length));
  return generators.flatMap(generator => generator.generateLogs(perGenerator));
}

async function countLines(file: string): Promise<number> {
  if (!(await fs.pathExists(file))) return 0;
  const content = await fs.readFile(file, 'utf8');
  return content.split('\n').filter(line => line.length > 0).length;
}

async function countStoredLogs(dir: string): Promise<number> {
  let total = 0;
  for (const file of await fs.readdir(dir)) total += await countLines(path.join(dir, file));
  return total;
}

function outputConfig(base: Config['output'], destination: OutputDestination, dir: string, receivers: LocalReceivers): Config['output'] {
  return {
    ...base,
    destination,
    file: { ...(base.file || { rotation: false, maxSize: '100MB', maxFiles: 1 }), path: path.join(dir, 'output.log') },
    http: { ...(base.http || {}), url: receivers.httpUrl },
    syslog: { ...(base.syslog || { protocol: 'udp' }), host: '127.0.0.1', port: receivers.syslogPort, protocol: 'udp' }
  };
}

/** Send logs to one destination for the duration, then flush; the time includes the final flush */
export async function benchmarkOutput(destination: OutputDestination, run: OutputRun): Promise<OutputMeasurement> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-generator-benchmark-'));
  const storageDir = path.join(dir, 'history');
  try {
    const before = await run.receivers.settledCounts(50, 1000);
    const output = new OutputManager(outputConfig(run.output, destination, dir, run.receivers), new StorageManager(storageDir, storageDir, 1));
    const generators = [...run.generators.values()];
    const start = process.hrtime.bigint();
    const end = start + BigInt(run.durationMs) * 1000000n;
    let sent = 0;
    let bytes = 0;
    do {
      const batch = mixedBatch(generators);
      // Like LogGeneratorManager: each log is handed over without waiting for the previous one
      await Promise.all(batch.map(log => output.outputLog(log)));
      sent += batch.length;
      bytes += batch.reduce((sum, log) => sum + Buffer.byteLength(JSON.stringify(log)), 0);
    } while (process.hrtime.bigint() < end);
    await output.close();
    const seconds = elapsedSeconds(start);

    const after = await run.receivers.settledCounts();
    const delivered = destination === 'file' ? await countLines(path.join(dir, 'output.log'))
      : destination === 'http' ? after.httpLogs - before.httpLogs
      : after.syslogMessages - before.syslogMessages;
    return { ...toMeasurement(destination, sent, bytes, seconds), delivered };
  } finally {
    await fs.remove(dir);
  }
}

/** The per-log history copy every output makes (StorageManager.storeLog), measured on its own */
export async function benchmarkHistoryStorage(generators: Map<string, BaseGenerator>, durationMs: number): Promise<OutputMeasurement> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-generator-benchmark-'));
  try {
    const storage = new StorageManager(dir, dir, 1);
    const all = [...generators.values()];
    const start = process.hrtime.bigint();
    const end = start + BigInt(durationMs) * 1000000n;
    let sent = 0;
    let bytes = 0;
    do {
      const batch = mixedBatch(all);
      await Promise.all(batch.map(log => storage.storeLog(log)));
      sent += batch.length;
      bytes += batch.reduce((sum, log) => sum + Buffer.byteLength(JSON.stringify(log)), 0);
    } while (process.hrtime.bigint() < end);
    const seconds = elapsedSeconds(start);
    return { ...toMeasurement('history storage only', sent, bytes, seconds), delivered: await countStoredLogs(dir) };
  } finally {
    await fs.remove(dir);
  }
}
