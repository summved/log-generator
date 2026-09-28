/**
 * Log Profile
 * Learns a profile from real logs (sources, levels, hour-of-day volume and message patterns)
 * and generates new logs that follow it.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { LogEntry, LogSource } from '../types';
import { ParsedLog } from '../utils/logFiles';
import { groupByTemplate, MESSAGE_MASKS, numberValues, toTemplate } from './logTemplates';
import { seededRandom, weightedPick } from './random';

/** Learned values for one <NUM> position in a template */
export interface NumberSlot {
  /** Distinct observed values, when there are few of them (e.g. status codes) */
  values?: string[];
  min: number;
  max: number;
  decimals: number;
}

export interface ProfileTemplate {
  template: string;
  count: number;
  /** Share of this source's logs */
  share: number;
  levels: Record<string, number>;
  examples: string[];
  /** One entry per <NUM> placeholder, in order */
  numbers: NumberSlot[];
}

export interface SourceProfile {
  type: string;
  count: number;
  share: number;
  levels: Record<string, number>;
  /** Share of this source's timestamped logs in each UTC hour, index 0-23 */
  hourly: number[];
  templates: ProfileTemplate[];
}

export interface LogProfile {
  format: 'log-profile';
  version: 1;
  learnedAt: string;
  files: string[];
  totalLogs: number;
  timeRange?: { start: string; end: string };
  sources: Record<string, SourceProfile>;
}

export interface BuildProfileOptions {
  files?: string[];
  maxTemplatesPerSource?: number;
  /** Only use logs within this many days of the newest log */
  maxHistoryDays?: number;
}

export interface GenerateOptions {
  count: number;
  anomalyRate?: number;
  seed?: number;
  /** Day to place generated timestamps on (default: today) */
  now?: Date;
  userId?: string;
  systemId?: string;
}

const PROFILE_FORMAT = 'log-profile';
const ANOMALY_LEVELS = new Set(['ERROR', 'CRITICAL', 'FATAL']);
const RARE_SHARE = 0.05;
const DAY_MS = 86400000;
/** Number positions with at most this many distinct values reuse them exactly */
const MAX_DISTINCT_NUMBERS = 20;

function timeOf(log: ParsedLog): number | undefined {
  const time = log.timestamp ? Date.parse(log.timestamp) : NaN;
  return Number.isNaN(time) ? undefined : time;
}

function numberSlots(messages: string[]): NumberSlot[] {
  const columns: string[][] = [];
  for (const message of messages) {
    numberValues(message).forEach((value, position) => {
      (columns[position] = columns[position] || []).push(value);
    });
  }
  return columns.map(column => {
    const numbers = column.map(Number);
    const distinct = [...new Set(column)].sort((a, b) => Number(a) - Number(b));
    return {
      ...(distinct.length <= MAX_DISTINCT_NUMBERS ? { values: distinct } : {}),
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      decimals: Math.max(...column.map(value => (value.split('.')[1] || '').length))
    };
  });
}

function hourlyShares(logs: ParsedLog[]): number[] {
  const hours = new Array(24).fill(0);
  let counted = 0;
  for (const log of logs) {
    const time = timeOf(log);
    if (time !== undefined) {
      hours[new Date(time).getUTCHours()]++;
      counted++;
    }
  }
  return counted > 0 ? hours.map(count => count / counted) : new Array(24).fill(1 / 24);
}

export function buildProfile(allLogs: ParsedLog[], options: BuildProfileOptions = {}): LogProfile {
  let logs = allLogs;
  if (options.maxHistoryDays !== undefined) {
    const times = logs.map(timeOf).filter((time): time is number => time !== undefined);
    if (times.length > 0) {
      const cutoff = Math.max(...times) - options.maxHistoryDays * DAY_MS;
      logs = logs.filter(log => (timeOf(log) ?? Infinity) >= cutoff);
    }
  }

  const bySource = new Map<string, ParsedLog[]>();
  for (const log of logs) {
    const name = log.source?.name || log.source?.type || 'unknown';
    if (!bySource.has(name)) bySource.set(name, []);
    bySource.get(name)!.push(log);
  }

  const sources: Record<string, SourceProfile> = {};
  for (const [name, sourceLogs] of [...bySource].sort(([a], [b]) => a.localeCompare(b))) {
    const messagesByTemplate = new Map<string, string[]>();
    for (const log of sourceLogs) {
      const template = toTemplate(log.message);
      if (!messagesByTemplate.has(template)) messagesByTemplate.set(template, []);
      messagesByTemplate.get(template)!.push(log.message);
    }
    const levels: Record<string, number> = {};
    for (const log of sourceLogs) {
      if (log.level) levels[log.level] = (levels[log.level] || 0) + 1;
    }
    sources[name] = {
      type: sourceLogs.find(log => log.source?.type)?.source?.type || name,
      count: sourceLogs.length,
      share: sourceLogs.length / logs.length,
      levels,
      hourly: hourlyShares(sourceLogs),
      templates: groupByTemplate(sourceLogs, { examples: 5 })
        .slice(0, options.maxTemplatesPerSource ?? 50)
        .map(group => ({
          template: group.template,
          count: group.count,
          share: group.share,
          levels: group.levels,
          examples: group.examples,
          numbers: numberSlots(messagesByTemplate.get(group.template) || [])
        }))
    };
  }

  const times = logs.map(timeOf).filter((time): time is number => time !== undefined);
  return {
    format: PROFILE_FORMAT,
    version: 1,
    learnedAt: new Date().toISOString(),
    files: options.files || [],
    totalLogs: logs.length,
    ...(times.length > 0 ? { timeRange: { start: new Date(Math.min(...times)).toISOString(), end: new Date(Math.max(...times)).toISOString() } } : {}),
    sources
  };
}

export async function saveProfile(profile: LogProfile, file: string): Promise<void> {
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(profile, null, 2));
}

export async function loadProfile(file: string): Promise<LogProfile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Not a learned profile: ${file} (${error instanceof Error ? error.message : String(error)})`);
  }
  const profile = parsed as Partial<LogProfile>;
  if (!profile || profile.format !== PROFILE_FORMAT || typeof profile.sources !== 'object') {
    throw new Error(`Not a learned profile: ${file}`);
  }
  return profile as LogProfile;
}

function randomDigits(length: number, random: () => number): string {
  let digits = String(1 + Math.floor(random() * 9));
  while (digits.length < length) digits += String(Math.floor(random() * 10));
  return digits.slice(0, length);
}

function randomHex(length: number, random: () => number): string {
  return Array.from({ length }, () => '0123456789abcdef'[Math.floor(random() * 16)]).join('');
}

function randomOctet(random: () => number): number {
  return 1 + Math.floor(random() * 254);
}

/** The same message shape as `example`, with fresh values for its variable parts; learned number slots are used when given */
export function regenerateMessage(example: string, random: () => number, numbers: NumberSlot[] = []): string {
  let numberIndex = 0;
  const replacements: Record<string, (match: string) => string> = {
    '<TIME>': () => new Date(Date.UTC(2026, 0, 1) + Math.floor(random() * 365 * DAY_MS)).toISOString(),
    '<URL>': match => match,
    '<EMAIL>': match => `user${randomDigits(3, random)}@${match.split('@')[1]}`,
    '<UUID>': () => [8, 4, 4, 4, 12].map(length => randomHex(length, random)).join('-'),
    '<HEX>': match => (match.startsWith('0x') ? '0x' : '') + randomHex(match.replace(/^0x/, '').length, random),
    '<IP>': match => {
      const [a, b] = match.split('.').map(Number);
      const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
      const first = isPrivate ? 10 : [23, 45, 52, 81, 104, 142, 185, 203][Math.floor(random() * 8)];
      return [first, randomOctet(random), randomOctet(random), randomOctet(random)].join('.');
    },
    '<NUM>': match => {
      const slot = numbers[numberIndex++];
      if (slot?.values && slot.values.length > 0) {
        return slot.values[Math.floor(random() * slot.values.length)];
      }
      if (slot) {
        return (slot.min + random() * (slot.max - slot.min)).toFixed(slot.decimals);
      }
      const [whole, fraction] = match.split('.');
      return randomDigits(whole.length, random) + (fraction !== undefined ? `.${randomDigits(fraction.length, random)}` : '');
    }
  };

  let message = example;
  for (const { token, pattern } of MESSAGE_MASKS) {
    message = message.replace(pattern, match => replacements[token](match));
  }
  return message;
}

function resolveSource(profile: LogProfile, query: string): [string, SourceProfile] {
  const lower = query.toLowerCase();
  const match = Object.entries(profile.sources).find(([name]) => name.toLowerCase() === lower)
    || Object.entries(profile.sources).find(([, source]) => source.type.toLowerCase() === lower);
  if (!match) {
    throw new Error(`No learned patterns for source "${query}". Learned sources: ${Object.keys(profile.sources).join(', ')}`);
  }
  return match;
}

/** Generate `count` logs for one learned source, in timestamp order */
export function generateFromProfile(profile: LogProfile, sourceQuery: string, options: GenerateOptions): LogEntry[] {
  const [name, source] = resolveSource(profile, sourceQuery);
  const random = seededRandom(options.seed ?? Date.now());
  const anomalyRate = options.anomalyRate ?? 0;
  const day = new Date(options.now || new Date());
  const dayStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());

  const rare = source.templates.filter(t => t.share < RARE_SHARE || Object.keys(t.levels).some(level => ANOMALY_LEVELS.has(level)));
  const weights = (templates: ProfileTemplate[]) => Object.fromEntries(templates.map((t, i) => [String(i), t.count]));
  const hourWeights = Object.fromEntries(source.hourly.map((share, hour) => [String(hour), share]));

  const logs: LogEntry[] = [];
  for (let i = 0; i < options.count; i++) {
    const anomalous = rare.length > 0 && random() < anomalyRate;
    const pool = anomalous ? rare : source.templates;
    const template = pool[Number(weightedPick(weights(pool), random))];

    const errorLevels = Object.fromEntries(Object.entries(template.levels).filter(([level]) => ANOMALY_LEVELS.has(level)));
    const levelWeights = anomalous && Object.keys(errorLevels).length > 0 ? errorLevels : template.levels;
    const level = (Object.keys(levelWeights).length > 0 ? weightedPick(levelWeights, random) : 'INFO') as LogEntry['level'];

    const hour = Number(weightedPick(hourWeights, random));
    const time = dayStart + hour * 3600000 + Math.floor(random() * 3600000);
    const example = template.examples[Math.floor(random() * template.examples.length)];

    logs.push({
      timestamp: new Date(time).toISOString(),
      level,
      source: { type: source.type as LogSource['type'], name },
      message: regenerateMessage(example, random, template.numbers || []),
      metadata: {
        generator: 'ml-profile',
        template: template.template,
        is_anomaly: anomalous,
        ...(options.userId ? { userId: options.userId } : {}),
        ...(options.systemId ? { systemId: options.systemId } : {})
      }
    });
  }

  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
