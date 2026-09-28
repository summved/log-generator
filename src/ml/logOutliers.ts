/**
 * Log Outliers
 * Scores individual logs with an Isolation Forest over simple per-log features and
 * explains each flagged log by the features that deviate most from the typical log.
 */

import { mean, standardDeviation } from 'simple-statistics';
import { ParsedLog } from '../utils/logFiles';
import { IsolationForest } from './isolationForest';
import { toTemplate } from './logTemplates';

export interface LogFeature {
  name: string;
  description: string;
}

export const LOG_FEATURES: LogFeature[] = [
  { name: 'hour', description: 'Hour of day (UTC)' },
  { name: 'isWeekend', description: '1 on Saturday or Sunday' },
  { name: 'messageLength', description: 'Characters in the message' },
  { name: 'wordCount', description: 'Words in the message' },
  { name: 'errorWords', description: 'Words like error, failed, denied, exception, panic, timeout' },
  { name: 'levelRank', description: 'DEBUG 0, INFO 1, WARN 2, ERROR 3, CRITICAL 4' },
  { name: 'sourceRarity', description: '1 minus the share of logs from the same source' },
  { name: 'templateRarity', description: '1 minus the share of logs with the same message pattern' },
  { name: 'metadataFields', description: 'Number of metadata fields' },
  { name: 'hasIp', description: '1 if the message or metadata contains an IPv4 address' }
];

export interface OutlierReason {
  feature: string;
  value: number;
  typical: number;
  zScore: number;
}

export interface LogOutlier {
  index: number;
  score: number;
  message: string;
  level?: string;
  source?: string;
  timestamp?: string;
  reasons: OutlierReason[];
}

export interface LogOutlierResult {
  analyzed: number;
  outliers: LogOutlier[];
}

const MIN_LOGS = 20;
const LEVEL_RANK: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, WARNING: 2, ERROR: 3, CRITICAL: 4 };
const ERROR_WORDS = /\b(error|errors|fail|failed|failure|denied|exception|panic|fatal|timeout|unable|refused)\b/gi;
const IPV4 = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/;

function shares(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return new Map([...counts].map(([value, count]) => [value, count / values.length]));
}

function featurize(logs: ParsedLog[]): number[][] {
  const sources = logs.map(log => log.source?.name || log.source?.type || '');
  const templates = logs.map(log => toTemplate(log.message));
  const sourceShare = shares(sources);
  const templateShare = shares(templates);

  return logs.map((log, i) => {
    const time = log.timestamp ? new Date(log.timestamp) : null;
    const valid = time !== null && !Number.isNaN(time.getTime());
    const metadata = log.metadata || {};
    return [
      valid ? time!.getUTCHours() : 12,
      valid && (time!.getUTCDay() === 0 || time!.getUTCDay() === 6) ? 1 : 0,
      log.message.length,
      log.message.split(/\s+/).filter(Boolean).length,
      (log.message.match(ERROR_WORDS) || []).length,
      LEVEL_RANK[(log.level || 'INFO').toUpperCase()] ?? 1,
      1 - (sourceShare.get(sources[i]) || 0),
      1 - (templateShare.get(templates[i]) || 0),
      Object.keys(metadata).length,
      IPV4.test(log.message) || IPV4.test(JSON.stringify(metadata)) ? 1 : 0
    ];
  });
}

/** The `top` most unusual logs, highest score first */
export function detectLogOutliers(logs: ParsedLog[], options: { top?: number; seed?: number } = {}): LogOutlierResult {
  if (logs.length < MIN_LOGS) {
    throw new Error(`Need at least ${MIN_LOGS} logs to learn what is normal (found ${logs.length})`);
  }

  const vectors = featurize(logs);
  const forest = new IsolationForest({ seed: options.seed ?? 42 }).fit(vectors);

  const columns = LOG_FEATURES.map((_, f) => vectors.map(vector => vector[f]));
  const means = columns.map(column => mean(column));
  const stdDevs = columns.map(column => standardDeviation(column));

  const scored = vectors.map((vector, index) => ({ index, score: forest.score(vector) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const outliers = scored.slice(0, options.top ?? 10).map(({ index, score }) => {
    const log = logs[index];
    const reasons = LOG_FEATURES
      .map((feature, f) => ({
        feature: feature.name,
        value: vectors[index][f],
        typical: means[f],
        zScore: stdDevs[f] > 0 ? (vectors[index][f] - means[f]) / stdDevs[f] : 0
      }))
      .filter(reason => Math.abs(reason.zScore) >= 2)
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 3);

    return {
      index,
      score,
      message: log.message,
      level: log.level,
      source: log.source?.name || log.source?.type,
      timestamp: log.timestamp,
      reasons
    };
  });

  return { analyzed: logs.length, outliers };
}
