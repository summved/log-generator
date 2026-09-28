/**
 * Indicators
 * Extracts network and file indicators (IPv4, domains, emails, hashes) from logs and matches them against a list
 */

import { ParsedLog } from '../utils/logFiles';

export type IndicatorType = 'ipv4' | 'domain' | 'email' | 'md5' | 'sha1' | 'sha256';

export interface Indicator {
  type: IndicatorType;
  value: string;
  count: number;
  /** IPv4 only: not publicly routable (private, loopback, reserved, ...) vs public */
  scope?: 'private' | 'public';
}

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`(?<![\\d.])${OCTET}(?:\\.${OCTET}){3}(?!\\.?\\d)`, 'g');
const EMAIL = /(?<![\w.+-])[\w.+-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?![\w-])/gi;
const DOMAIN = /(?<![\w.@-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?![\w-])/gi;
const HASHES: Array<{ type: IndicatorType; pattern: RegExp }> = [
  { type: 'sha256', pattern: /(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])/gi },
  { type: 'sha1', pattern: /(?<![a-f0-9])[a-f0-9]{40}(?![a-f0-9])/gi },
  { type: 'md5', pattern: /(?<![a-f0-9])[a-f0-9]{32}(?![a-f0-9])/gi }
];

/** Final labels that mark a file name rather than a domain */
const FILE_EXTENSIONS = new Set([
  'exe', 'dll', 'sys', 'bat', 'cmd', 'ps1', 'sh', 'vbs', 'js', 'jar', 'py', 'msi', 'bin',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
  'zip', 'rar', 'gz', 'tar', 'tgz', '7z', 'iso',
  'json', 'jsonl', 'xml', 'yaml', 'yml', 'log', 'ini', 'conf', 'cfg', 'tmp', 'bak', 'db', 'sql',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'html', 'htm', 'php', 'asp', 'aspx', 'ts'
]);

/** Not publicly routable: private, loopback, link-local, carrier-grade NAT, "this network", multicast and reserved */
function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

/** Text scanned for one log: the message plus top-level string metadata values */
function textOf(log: Pick<ParsedLog, 'message' | 'metadata'>): string {
  const values = Object.values(log.metadata || {}).filter((value): value is string => typeof value === 'string');
  return [log.message, ...values].join('\n');
}

/** Every indicator found in the logs with how many times it appears, most frequent first */
export function extractIndicators(logs: Array<Pick<ParsedLog, 'message' | 'metadata'>>): Indicator[] {
  const found = new Map<string, Indicator>();
  const add = (type: IndicatorType, value: string): void => {
    const key = `${type}:${value}`;
    const existing = found.get(key);
    if (existing) {
      existing.count++;
    } else {
      found.set(key, { type, value, count: 1, ...(type === 'ipv4' ? { scope: isPrivateIpv4(value) ? 'private' : 'public' } : {}) });
    }
  };

  for (const log of logs) {
    const text = textOf(log);
    for (const ip of text.match(IPV4) || []) {
      add('ipv4', ip);
    }
    for (const email of text.match(EMAIL) || []) {
      add('email', email.toLowerCase());
    }
    // Domains inside email addresses are counted as part of the email, not separately
    for (const domain of text.replace(EMAIL, ' ').match(DOMAIN) || []) {
      const lower = domain.toLowerCase();
      if (!FILE_EXTENSIONS.has(lower.slice(lower.lastIndexOf('.') + 1))) {
        add('domain', lower);
      }
    }
    for (const { type, pattern } of HASHES) {
      for (const hash of text.match(pattern) || []) {
        add(type, hash.toLowerCase());
      }
    }
  }

  return [...found.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** One indicator per line; blank lines and lines starting with # are ignored; compared case-insensitively */
export function parseIndicatorList(text: string): Set<string> {
  return new Set(
    text.split('\n')
      .map(line => line.trim().toLowerCase())
      .filter(line => line && !line.startsWith('#'))
  );
}

/** Extracted indicators whose value is on the list */
export function matchIndicators(indicators: Indicator[], list: Set<string>): Indicator[] {
  return indicators.filter(indicator => list.has(indicator.value.toLowerCase()));
}
