/**
 * Volume Analysis
 * Time-window statistics over log files: volume anomalies, rare values and trend forecasts
 */

import { linearRegression, linearRegressionLine, mean, rSquared, standardDeviation } from 'simple-statistics';
import { ParsedLog } from '../utils/logFiles';

export interface VolumeBucket {
  /** Window start, epoch milliseconds */
  start: number;
  count: number;
}

export interface VolumeAnomaly extends VolumeBucket {
  zScore: number;
  direction: 'spike' | 'drop';
}

export interface VolumeAnomalyResult {
  mean: number;
  stdDev: number;
  anomalies: VolumeAnomaly[];
}

export interface RareValue {
  value: string;
  count: number;
  share: number;
}

export interface VolumeForecast {
  slopePerWindow: number;
  rSquared: number;
  forecast: VolumeBucket[];
}

/** Count logs per fixed window, from the first to the last window that has logs (empty windows included) */
export function bucketByWindow(logs: ParsedLog[], windowMs: number): VolumeBucket[] {
  if (!(windowMs > 0)) {
    throw new Error('Window must be greater than zero');
  }

  const counts = new Map<number, number>();
  for (const log of logs) {
    const time = log.timestamp ? Date.parse(log.timestamp) : NaN;
    if (Number.isNaN(time)) {
      continue;
    }
    const start = Math.floor(time / windowMs) * windowMs;
    counts.set(start, (counts.get(start) || 0) + 1);
  }
  if (counts.size === 0) {
    return [];
  }

  const starts = [...counts.keys()];
  const first = Math.min(...starts);
  const last = Math.max(...starts);
  const buckets: VolumeBucket[] = [];
  for (let start = first; start <= last; start += windowMs) {
    buckets.push({ start, count: counts.get(start) || 0 });
  }
  return buckets;
}

/** Windows whose count is more than `threshold` standard deviations from the mean */
export function detectVolumeAnomalies(buckets: VolumeBucket[], threshold: number): VolumeAnomalyResult {
  if (buckets.length === 0) {
    return { mean: 0, stdDev: 0, anomalies: [] };
  }

  const counts = buckets.map(bucket => bucket.count);
  const average = mean(counts);
  const stdDev = standardDeviation(counts);
  if (stdDev === 0) {
    return { mean: average, stdDev, anomalies: [] };
  }

  const anomalies = buckets
    .map(bucket => ({ ...bucket, zScore: (bucket.count - average) / stdDev }))
    .filter(bucket => Math.abs(bucket.zScore) > threshold)
    .map(bucket => ({ ...bucket, direction: bucket.zScore > 0 ? 'spike' as const : 'drop' as const }));

  return { mean: average, stdDev, anomalies };
}

/** Values of `level` or `source` whose share of all logs is below `maxShare`, rarest first */
export function rareValues(
  logs: ParsedLog[],
  field: 'level' | 'source',
  maxShare: number
): RareValue[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const value = field === 'level' ? log.level : log.source?.name || log.source?.type;
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, share: count / logs.length }))
    .filter(entry => entry.share < maxShare)
    .sort((a, b) => a.count - b.count || a.value.localeCompare(b.value));
}

/** Fit a linear trend to window counts and project the next `horizon` windows (never below zero) */
export function forecastVolume(buckets: VolumeBucket[], horizon: number, windowMs: number): VolumeForecast {
  if (buckets.length < 2) {
    throw new Error('At least 2 time windows are needed to forecast');
  }

  const points = buckets.map((bucket, index) => [index, bucket.count]);
  const fit = linearRegression(points);
  const line = linearRegressionLine(fit);
  const last = buckets[buckets.length - 1].start;

  const forecast = Array.from({ length: horizon }, (_, i) => ({
    start: last + (i + 1) * windowMs,
    count: Math.max(0, Math.round(line(buckets.length + i)))
  }));

  return { slopePerWindow: fit.m, rSquared: rSquared(points, line), forecast };
}
