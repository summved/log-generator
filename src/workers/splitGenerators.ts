import { Config } from '../types';

export const MAX_WORKERS = 256;

/** One copy of the generators config per worker, each with 1/count of every generator's rate */
export function splitGenerators(generators: Config['generators'], count: number): Config['generators'][] {
  if (count <= 1) return [generators];
  const share = Object.fromEntries(
    Object.entries(generators).map(([name, config]) => [name, { ...config, frequency: config.frequency / count }])
  ) as Config['generators'];
  return Array.from({ length: count }, () => share);
}

export function parseWorkerCount(value: string): number {
  const count = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!(count >= 1 && count <= MAX_WORKERS)) {
    throw new Error(`Invalid worker count "${value}": use a whole number from 1 to ${MAX_WORKERS}`);
  }
  return count;
}
