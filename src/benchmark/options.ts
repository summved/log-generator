import { LOG_FORMATS, LogFormat } from '../utils/formatters';
import { BENCHMARK_PHASES, BenchmarkOptions, BenchmarkPhase } from './runBenchmark';

export interface RawBenchmarkOptions {
  config?: string;
  duration?: string;
  phases?: string;
  workers?: string;
  format?: string;
}

const MAX_DURATION_MS = 10 * 60 * 1000;
const MAX_WORKERS = 256;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60000 };

function list(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

function parseDurationMs(value: string): number {
  const match = value.trim().match(/^(\d+)(ms|s|m)$/);
  const ms = match ? Number(match[1]) * UNIT_MS[match[2]] : 0;
  if (ms <= 0) throw new Error(`Invalid duration "${value}". Use e.g. 500ms, 3s or 1m`);
  if (ms > MAX_DURATION_MS) throw new Error(`Invalid duration "${value}": use at most 10m per measurement`);
  return ms;
}

/** Validate the benchmark CLI options, throwing a clear message for anything unusable */
export function parseBenchmarkOptions(raw: RawBenchmarkOptions): BenchmarkOptions & Required<Pick<BenchmarkOptions, 'phases' | 'workerFormat'>> {
  const phases = raw.phases ? list(raw.phases) : BENCHMARK_PHASES;
  for (const phase of phases) {
    if (!BENCHMARK_PHASES.includes(phase as BenchmarkPhase)) {
      throw new Error(`Unknown phase "${phase}". Choose from: ${BENCHMARK_PHASES.join(', ')}`);
    }
  }

  const workerCounts = raw.workers ? list(raw.workers).map(value => {
    const count = /^\d+$/.test(value) ? Number(value) : NaN;
    if (!(count >= 1 && count <= MAX_WORKERS)) throw new Error(`Invalid worker count "${value}": use 1-${MAX_WORKERS}`);
    return count;
  }) : undefined;

  const format = raw.format || 'json';
  if (!LOG_FORMATS.includes(format as LogFormat)) {
    throw new Error(`Unknown format "${format}". Choose from: ${LOG_FORMATS.join(', ')}`);
  }

  return {
    durationMs: parseDurationMs(raw.duration || '3s'),
    phases: phases as BenchmarkPhase[],
    workerCounts,
    workerFormat: format as LogFormat,
    configPath: raw.config
  };
}
