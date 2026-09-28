/**
 * D3FEND Coverage
 * Lists supported D3FEND techniques and measures which of them appear in a set of logs
 */

import { D3FENDInfo } from '../types';
import { D3FENDMapper } from './d3fendMapper';

/** The parts of a log entry that coverage analysis reads */
export interface CoverageLog {
  message: string;
  metadata?: Record<string, unknown>;
  d3fend?: D3FENDInfo;
}

export interface D3fendTechniqueCount {
  technique: string;
  category: string;
  subcategory: string;
  count: number;
}

export interface D3fendCoverageReport {
  totalLogs: number;
  logsWithDefense: number;
  /** Techniques seen in the logs, most frequent first */
  techniques: D3fendTechniqueCount[];
  /** Number of logs per D3FEND category */
  categories: Record<string, number>;
  /** Supported techniques that never appeared */
  unseenTechniques: string[];
}

/** Every supported technique, optionally limited to one category (case-insensitive) */
export function listD3fendTechniques(category?: string): D3FENDInfo[] {
  const all = D3FENDMapper.getSupportedTechniques()
    .map(id => D3FENDMapper.getTechniqueInfo(id))
    .filter((info): info is D3FENDInfo => info !== null);

  if (category === undefined) {
    return all;
  }

  const categories = D3FENDMapper.getSupportedCategories();
  const match = categories.find(name => name.toLowerCase() === category.toLowerCase());
  if (!match) {
    throw new Error(`Unknown D3FEND category "${category}". Use one of: ${categories.join(', ')}`);
  }
  return all.filter(info => info.category === match);
}

/** Count D3FEND techniques in logs, using a log's own d3fend tag or the mapper's message patterns */
export function analyzeD3fendCoverage(logs: CoverageLog[]): D3fendCoverageReport {
  const counts = new Map<string, D3fendTechniqueCount>();
  const categories: Record<string, number> = {};
  let logsWithDefense = 0;

  for (const log of logs) {
    const info = log.d3fend || D3FENDMapper.mapLogToDefensiveTechnique(log.message, log.metadata);
    if (!info) {
      continue;
    }
    logsWithDefense++;
    categories[info.category] = (categories[info.category] || 0) + 1;
    const existing = counts.get(info.technique);
    counts.set(info.technique, {
      technique: info.technique,
      category: info.category,
      subcategory: info.subcategory,
      count: (existing?.count || 0) + 1
    });
  }

  const techniques = [...counts.values()].sort((a, b) => b.count - a.count || a.technique.localeCompare(b.technique));
  const unseenTechniques = D3FENDMapper.getSupportedTechniques().filter(id => !counts.has(id));

  return { totalLogs: logs.length, logsWithDefense, techniques, categories, unseenTechniques };
}

/** Parse JSON-lines text into log entries; blank lines are ignored, other non-log lines are counted as skipped */
export function parseLogLines(text: string): { logs: CoverageLog[]; skipped: number } {
  const logs: CoverageLog[] = [];
  let skipped = 0;

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && typeof (parsed as CoverageLog).message === 'string') {
        logs.push(parsed as CoverageLog);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { logs, skipped };
}
