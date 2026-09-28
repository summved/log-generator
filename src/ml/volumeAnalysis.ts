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
  /** Mean absolute difference between the trend line and the history */
  meanAbsoluteError: number;
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

  const meanAbsoluteError = mean(points.map(([x, y]) => Math.abs(y - line(x))));
  return { slopePerWindow: fit.m, rSquared: rSquared(points, line), meanAbsoluteError, forecast };
}

export interface SeasonalForecast {
  method: 'holt-winters';
  seasonLength: number;
  /** Mean absolute error of one-step-ahead predictions over the history */
  meanAbsoluteError: number;
  params: { alpha: number; beta: number; gamma: number };
  forecast: VolumeBucket[];
}

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Windows per cycle for a seasonal forecast: a daily cycle when the window divides a day
 * and there are two days of history, otherwise a weekly one; null when neither fits.
 */
export function chooseSeasonLength(windowMs: number, windowCount: number): number | null {
  for (const period of [DAY_MS, WEEK_MS]) {
    const length = period / windowMs;
    if (Number.isInteger(length) && length >= 2 && windowCount >= 2 * length) {
      return length;
    }
  }
  return null;
}

/** One pass of additive Holt-Winters; returns the one-step error and the fitted state */
function holtWinters(values: number[], m: number, alpha: number, beta: number, gamma: number) {
  const firstSeason = values.slice(0, m);
  const secondSeason = values.slice(m, 2 * m);
  let level = mean(firstSeason);
  let trend = (mean(secondSeason) - level) / m;
  const season = firstSeason.map(value => value - level);

  let absoluteError = 0;
  for (let t = m; t < values.length; t++) {
    const s = t % m;
    absoluteError += Math.abs(values[t] - (level + trend + season[s]));
    const previousLevel = level;
    level = alpha * (values[t] - season[s]) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    season[s] = gamma * (values[t] - level) + (1 - gamma) * season[s];
  }

  return { meanAbsoluteError: absoluteError / (values.length - m), level, trend, season };
}

/** Additive Holt-Winters forecast with a cycle of `seasonLength` windows; smoothing chosen by grid search */
export function forecastSeasonal(buckets: VolumeBucket[], horizon: number, windowMs: number, seasonLength: number): SeasonalForecast {
  const m = seasonLength;
  if (buckets.length < 2 * m) {
    throw new Error(`At least ${2 * m} time windows are needed for a seasonal forecast with a cycle of ${m}`);
  }

  const values = buckets.map(bucket => bucket.count);
  let best: { alpha: number; beta: number; gamma: number; fit: ReturnType<typeof holtWinters> } | null = null;
  for (const alpha of [0.1, 0.2, 0.4, 0.6]) {
    for (const beta of [0, 0.05, 0.2]) {
      for (const gamma of [0.1, 0.3, 0.5]) {
        const fit = holtWinters(values, m, alpha, beta, gamma);
        if (!best || fit.meanAbsoluteError < best.fit.meanAbsoluteError) {
          best = { alpha, beta, gamma, fit };
        }
      }
    }
  }

  const { level, trend, season, meanAbsoluteError } = best!.fit;
  const last = buckets[buckets.length - 1].start;
  const forecast = Array.from({ length: horizon }, (_, i) => ({
    start: last + (i + 1) * windowMs,
    count: Math.max(0, Math.round(level + (i + 1) * trend + season[(values.length + i) % m]))
  }));

  return {
    method: 'holt-winters',
    seasonLength: m,
    meanAbsoluteError,
    params: { alpha: best!.alpha, beta: best!.beta, gamma: best!.gamma },
    forecast
  };
}

export type AutoForecast =
  | ({ method: 'holt-winters'; alternativeError?: number } & SeasonalForecast)
  | ({ method: 'linear'; alternativeError?: number } & VolumeForecast);

/**
 * Fit a linear trend and, when the history covers two daily/weekly cycles, a seasonal model;
 * use whichever has the lower mean absolute error on the history.
 * `alternativeError` is the other model's error (undefined when only the trend was possible).
 */
export function forecastAuto(buckets: VolumeBucket[], horizon: number, windowMs: number): AutoForecast {
  const linear = forecastVolume(buckets, horizon, windowMs);
  const seasonLength = chooseSeasonLength(windowMs, buckets.length);
  if (!seasonLength) {
    return { ...linear, method: 'linear', alternativeError: undefined };
  }

  const seasonal = forecastSeasonal(buckets, horizon, windowMs, seasonLength);
  return seasonal.meanAbsoluteError < linear.meanAbsoluteError
    ? { ...seasonal, alternativeError: linear.meanAbsoluteError }
    : { ...linear, method: 'linear', alternativeError: seasonal.meanAbsoluteError };
}
