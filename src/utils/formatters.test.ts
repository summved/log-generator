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

const attack: LogEntry = {
  timestamp: '2026-01-01T10:20:30.123456Z',
  level: 'ERROR',
  source: { type: 'firewall', name: 'pfsense-fw', host: 'firewall-01', component: 'pf' },
  message: 'Blocked a|b = c\\d\nnext line',
  metadata: { rule: 'r=1', tags: ['a', 'b'], 'bad key!': 'x', count: 3 },
  mitre: { technique: 'T1110', tactic: 'TA0006', description: 'Brute Force' }
};

describe('syslog format', () => {
  it('uses the configured facility (name or number), and severity from the level', () => {
    expect(LogFormatters.format('syslog', attack)).toMatch(/^<131>/); // local0 (16) * 8 + error (3)
    expect(LogFormatters.format('syslog', attack, { syslog: { facility: 'auth' } })).toMatch(/^<35>/); // 4 * 8 + 3
    expect(LogFormatters.format('syslog', attack, { syslog: { facility: 23 } })).toMatch(/^<187>/);
  });

  it('rejects an unknown facility', () => {
    expect(() => LogFormatters.format('syslog', attack, { syslog: { facility: 'nope' } })).toThrow(/Unknown syslog facility/);
  });

  it('keeps the per-source app name unless a tag is configured', () => {
    expect(LogFormatters.format('syslog', attack)).toContain(' firewall-01 pfsense-fw[pf]: ');
    expect(LogFormatters.format('syslog', attack, { syslog: { tag: 'loggen' } })).toContain(' firewall-01 loggen: ');
  });

  it('writes RFC 5424 with the full timestamp and MITRE structured data', () => {
    const line = LogFormatters.format('syslog', attack, { syslog: { timestampFormat: 'RFC5424', structuredData: true } });

    expect(line).toBe('<131>1 2026-01-01T10:20:30.123456Z firewall-01 pfsense-fw - pf [mitre@32473 technique="T1110" tactic="TA0006"] Blocked a|b = c\\d next line');
  });

  it('writes RFC 5424 without structured data as "-"', () => {
    const line = LogFormatters.format('syslog', { ...attack, mitre: undefined }, { syslog: { timestampFormat: 'RFC5424', structuredData: true } });

    expect(line).toMatch(/^<131>1 \S+ firewall-01 pfsense-fw - pf - Blocked/);
  });

  it('keeps each syslog message on one line', () => {
    expect(LogFormatters.format('syslog', attack)).not.toContain('\n');
  });
});

describe('CEF format', () => {
  const cef = LogFormatters.format('cef', attack);
  const [header, extension] = [cef.split(/(?<!\\)\|/).slice(0, 7), cef.split(/(?<!\\)\|/).slice(7).join('|')];

  it('has exactly 7 unescaped header fields and escapes | and \\ in them', () => {
    expect(header).toHaveLength(7);
    expect(header[5]).toBe('Blocked a\\|b = c\\\\d next line');
    expect(header[6]).toBe('7');
  });

  it('keeps the whole message as the name, up to 512 characters', () => {
    const long = LogFormatters.format('cef', { ...attack, message: 'x'.repeat(600) }).split(/(?<!\\)\|/)[5];

    expect(long).toHaveLength(512);
  });

  it('escapes = and \\ and newlines in extension values, and drops invalid keys', () => {
    expect(extension).toContain('msg=Blocked a|b \\= c\\\\d\\nnext line');
    expect(extension).toContain('rule=r\\=1');
    expect(extension).toContain('tags=["a","b"]');
    expect(extension).toContain('count=3');
    expect(extension).not.toContain('bad key');
  });

  it('adds the event time, device host and MITRE fields', () => {
    expect(extension).toContain(`rt=${Date.parse(attack.timestamp)}`);
    expect(extension).toContain('dvchost=firewall-01');
    expect(extension).toContain('cs1Label=mitreTechnique cs1=T1110');
    expect(extension).toContain('cs2Label=mitreTactic cs2=TA0006');
  });
});

describe('Wazuh format', () => {
  it('keeps MITRE data in rule.mitre', () => {
    expect(JSON.parse(LogFormatters.format('wazuh', attack)).rule.mitre).toEqual({ id: ['T1110'], tactic: ['TA0006'] });
  });
});
