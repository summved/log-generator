/**
 * Log Templates
 * Groups log messages by their shape: variable parts (IPs, numbers, IDs, ...) are masked
 * so that messages produced by the same code path fall into the same group.
 */

import { ParsedLog } from '../utils/logFiles';

export interface TemplateGroup {
  template: string;
  count: number;
  share: number;
  levels: Record<string, number>;
  sources: Record<string, number>;
  firstSeen?: string;
  lastSeen?: string;
  examples: string[];
}

/** Applied in order: specific patterns first, plain numbers last */
export const MESSAGE_MASKS: Array<{ token: string; pattern: RegExp }> = [
  { token: '<TIME>', pattern: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g },
  { token: '<URL>', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi },
  { token: '<EMAIL>', pattern: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { token: '<UUID>', pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
  { token: '<HEX>', pattern: /\b(?:0x)?[0-9a-f]{16,}\b/gi },
  { token: '<IP>', pattern: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g },
  { token: '<NUM>', pattern: /(?<![A-Za-z0-9_.<>-])\d+(?:\.\d+)?(?![\d.])/g }
];

/** The message with its variable parts replaced by placeholders such as <IP> and <NUM> */
export function toTemplate(message: string): string {
  let template = message;
  for (const { token, pattern } of MESSAGE_MASKS) {
    template = template.replace(pattern, token);
  }
  return template.replace(/\s+/g, ' ').trim();
}

/** The plain numbers in a message, in order (the values the <NUM> placeholders stand for) */
export function numberValues(message: string): string[] {
  let masked = message;
  for (const { token, pattern } of MESSAGE_MASKS) {
    if (token === '<NUM>') {
      return masked.match(pattern) || [];
    }
    masked = masked.replace(pattern, token);
  }
  return [];
}

/** Group logs by message template, most frequent first */
export function groupByTemplate(logs: ParsedLog[], options: { examples?: number } = {}): TemplateGroup[] {
  const maxExamples = options.examples ?? 3;
  const groups = new Map<string, TemplateGroup>();

  for (const log of logs) {
    const template = toTemplate(log.message);
    let group = groups.get(template);
    if (!group) {
      group = { template, count: 0, share: 0, levels: {}, sources: {}, examples: [] };
      groups.set(template, group);
    }

    group.count++;
    if (log.level) {
      group.levels[log.level] = (group.levels[log.level] || 0) + 1;
    }
    const source = log.source?.name || log.source?.type;
    if (source) {
      group.sources[source] = (group.sources[source] || 0) + 1;
    }
    if (log.timestamp && !Number.isNaN(Date.parse(log.timestamp))) {
      const time = Date.parse(log.timestamp);
      if (!group.firstSeen || time < Date.parse(group.firstSeen)) group.firstSeen = log.timestamp;
      if (!group.lastSeen || time > Date.parse(group.lastSeen)) group.lastSeen = log.timestamp;
    }
    if (group.examples.length < maxExamples && !group.examples.includes(log.message)) {
      group.examples.push(log.message);
    }
  }

  return [...groups.values()]
    .map(group => ({ ...group, share: group.count / logs.length }))
    .sort((a, b) => b.count - a.count || a.template.localeCompare(b.template));
}
