/**
 * Full benchmark: every generator, every format, every output (local only) and worker-thread scaling.
 */

import * as os from 'os';
import { ConfigManager } from '../config';
import { createGenerators } from '../generators/createGenerators';
import { LogFormat } from '../utils/formatters';
import { timestampSequencer } from '../utils/timestampSequencer';
import { benchmarkFormats, benchmarkGenerators, benchmarkMixedGenerators, timestampLeadSeconds } from './inProcess';
import { startLocalReceivers } from './localReceivers';
import { Measurement } from './measure';
import { benchmarkHistoryStorage, benchmarkOutput, OUTPUT_DESTINATIONS, OutputMeasurement } from './outputs';
import { runWorkers, workerCounts } from './workers';

export type BenchmarkPhase = 'generators' | 'formats' | 'outputs' | 'workers';
export const BENCHMARK_PHASES: BenchmarkPhase[] = ['generators', 'formats', 'outputs', 'workers'];

export interface BenchmarkOptions {
  configPath?: string;
  /** Time spent on each measurement */
  durationMs: number;
  phases?: BenchmarkPhase[];
  workerCounts?: number[];
  workerFormat?: LogFormat;
  onProgress?: (message: string) => void;
}

export interface BenchmarkReport {
  startedAt: string;
  system: { node: string; platform: string; cpus: number; cpuModel: string };
  durationPerMeasurementMs: number;
  generators?: Measurement[];
  mixed?: Measurement;
  /** Seconds the newest generated timestamp was ahead of the clock after the single-thread runs */
  timestampLeadSeconds?: number;
  formats?: Measurement[];
  outputs?: OutputMeasurement[];
  workers?: Measurement[];
  workerFormat?: LogFormat;
}

export async function runBenchmark(options: BenchmarkOptions): Promise<BenchmarkReport> {
  const phases = new Set(options.phases || BENCHMARK_PHASES);
  const progress = options.onProgress || (() => undefined);
  const config = new ConfigManager(options.configPath).getConfig();
  const generators = createGenerators(config.generators);
  const cpus = os.availableParallelism();
  const report: BenchmarkReport = {
    startedAt: new Date().toISOString(),
    system: { node: process.version, platform: `${os.platform()} ${os.arch()}`, cpus, cpuModel: os.cpus()[0]?.model || 'unknown' },
    durationPerMeasurementMs: options.durationMs
  };

  if (phases.has('generators')) {
    progress(`Generators: each of ${generators.size} log types, then all together`);
    report.generators = benchmarkGenerators(generators, options.durationMs);
    report.mixed = benchmarkMixedGenerators(generators, options.durationMs);
    report.timestampLeadSeconds = timestampLeadSeconds(timestampSequencer.getCounterInfo().lastTimestamp);
  }

  if (phases.has('formats')) {
    progress('Formats: json, syslog, cef, wazuh');
    const sample = [...generators.values()].flatMap(generator => generator.generateLogs(200));
    report.formats = benchmarkFormats(sample, options.durationMs);
  }

  if (phases.has('outputs')) {
    progress('Outputs: file, HTTP and syslog to local receivers on 127.0.0.1');
    const receivers = await startLocalReceivers();
    try {
      report.outputs = [];
      for (const destination of OUTPUT_DESTINATIONS) {
        report.outputs.push(await benchmarkOutput(destination, { generators, output: config.output, durationMs: options.durationMs, receivers }));
      }
      report.outputs.push(await benchmarkHistoryStorage(generators, options.durationMs));
    } finally {
      await receivers.stop();
    }
  }

  if (phases.has('workers')) {
    const format = options.workerFormat || 'json';
    report.workerFormat = format;
    report.workers = [];
    for (const count of options.workerCounts || workerCounts(cpus)) {
      progress(`Worker threads: ${count}`);
      report.workers.push(await runWorkers(count, { configPath: options.configPath, durationMs: options.durationMs, format }));
    }
  }

  return report;
}
