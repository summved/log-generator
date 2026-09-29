import { LogEntry } from '../types';
import { LOG_FORMATS, LogFormatters } from './formatters';

const entry: LogEntry = {
  timestamp: '2026-01-01T00:00:00.000000Z',
  level: 'WARN',
  source: { type: 'authentication', name: 'auth-service', host: 'auth-01' },
  message: 'Failed login for alice from 203.0.113.7',
  metadata: { user: 'alice' }
};

describe('LogFormatters.format', () => {
  it('supports the four output formats the config accepts', () => {
    expect(LOG_FORMATS).toEqual(['json', 'syslog', 'cef', 'wazuh']);
  });

  it('uses the matching formatter for each format', () => {
    expect(LogFormatters.format('json', entry)).toBe(LogFormatters.formatAsJSON(entry));
    expect(LogFormatters.format('syslog', entry)).toBe(LogFormatters.formatAsSyslog(entry));
    expect(LogFormatters.format('cef', entry)).toBe(LogFormatters.formatAsCEF(entry));
    expect(LogFormatters.format('wazuh', entry)).toBe(LogFormatters.formatForWazuh(entry));
  });

  it('falls back to JSON for an unknown format', () => {
    expect(LogFormatters.format('xml' as never, entry)).toBe(JSON.stringify(entry));
  });

  it('produces the documented shape for each format', () => {
    expect(JSON.parse(LogFormatters.format('json', entry)).message).toBe(entry.message);
    expect(LogFormatters.format('cef', entry)).toMatch(/^CEF:0\|/);
    expect(JSON.parse(LogFormatters.format('wazuh', entry)).rule.description).toBe(entry.message);
    expect(LogFormatters.format('syslog', entry)).toContain(entry.message);
  });
});
