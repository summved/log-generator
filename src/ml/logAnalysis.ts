/**
 * Log Analysis
 * One-shot report over a set of logs: message patterns, levels, sources, busiest hours,
 * volume anomalies, unusual individual logs and indicators.
 */

import { ParsedLog } from '../utils/logFiles';
import { extractIndicators } from './indicators';
import { detectLogOutliers, LogOutlier } from './logOutliers';
import { groupByTemplate, TemplateGroup } from './logTemplates';
import { bucketByWindow, detectVolumeAnomalies, VolumeAnomaly } from './volumeAnalysis';

export type AnalysisFocus = 'user' | 'system' | 'security' | 'application';

export interface LogAnalysisReport {
  focus?: AnalysisFocus;
  totalLogs: number;
  analyzedLogs: number;
  levels: Record<string, number>;
  sources: Record<string, number>;
  busiestHours: Array<{ hour: number; share: number }>;
  templates: TemplateGroup[];
  volumeAnomalies: VolumeAnomaly[];
  outliers: LogOutlier[];
  indicators: Record<string, number>;
}

// In this tool the 'endpoint' source type is the HTTP API gateway, so it counts as application traffic
const FOCUS_SOURCE_TYPES: Record<AnalysisFocus, string[]> = {
  security: ['authentication', 'firewall'],
  user: ['authentication'],
  system: ['server', 'cloud', 'iot', 'backup', 'microservices'],
  application: ['application', 'endpoint', 'webserver', 'database', 'email']
};

const USER_KEYS = ['user', 'userId', 'username', 'user_id', 'userName'];
const ELEVATED_LEVELS = new Set(['WARN', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL']);

function matchesFocus(log: ParsedLog, focus: AnalysisFocus): boolean {
  const type = log.source?.type || '';
  if (FOCUS_SOURCE_TYPES[focus].includes(type)) return true;
  switch (focus) {
    case 'security':
      // MITRE-tagged logs, and elevated-level logs from any source, are security-relevant
      return Boolean(log.mitre?.technique) || ELEVATED_LEVELS.has((log.level || '').toUpperCase());
    case 'user':
      return USER_KEYS.some(key => log.metadata && key in log.metadata);
    default:
      return false;
  }
}

function countBy(logs: ParsedLog[], key: (log: ParsedLog) => string | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    const value = key(log);
    if (value) counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

export function analyzeLogs(allLogs: ParsedLog[], options: { focus?: AnalysisFocus; top?: number } = {}): LogAnalysisReport {
  const { focus } = options;
  if (focus !== undefined && !(focus in FOCUS_SOURCE_TYPES)) {
    throw new Error(`Unknown focus "${focus}". Use user, system, security or application`);
  }
  const logs = focus ? allLogs.filter(log => matchesFocus(log, focus)) : allLogs;
  const top = options.top ?? 10;

  const hours = new Array(24).fill(0);
  let timed = 0;
  for (const log of logs) {
    const time = log.timestamp ? Date.parse(log.timestamp) : NaN;
    if (!Number.isNaN(time)) {
      hours[new Date(time).getUTCHours()]++;
      timed++;
    }
  }

  const indicators = countBy(extractIndicators(logs).map(indicator => ({ message: indicator.type })), log => log.message);

  return {
    ...(focus ? { focus } : {}),
    totalLogs: allLogs.length,
    analyzedLogs: logs.length,
    levels: countBy(logs, log => log.level),
    sources: countBy(logs, log => log.source?.name || log.source?.type),
    busiestHours: hours
      .map((count, hour) => ({ hour, share: timed > 0 ? count / timed : 0 }))
      .filter(entry => entry.share > 0)
      .sort((a, b) => b.share - a.share || a.hour - b.hour)
      .slice(0, 3),
    templates: groupByTemplate(logs).slice(0, top),
    volumeAnomalies: detectVolumeAnomalies(bucketByWindow(logs, 60000), 3).anomalies.slice(0, top),
    outliers: logs.length >= 20 ? detectLogOutliers(logs, { top: 5 }).outliers : [],
    indicators
  };
}
