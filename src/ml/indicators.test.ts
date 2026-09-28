import { extractIndicators, matchIndicators, parseIndicatorList } from './indicators';

const SHA256 = 'a'.repeat(64);
const MD5 = 'b'.repeat(32);

describe('extractIndicators', () => {
  const logs = [
    { message: 'Connection from 203.0.113.7 to 10.0.0.5 blocked', metadata: { host: 'files.example.com' } },
    { message: 'Download from evil.example.net of invoice.pdf.exe', metadata: { sha256: SHA256 } },
    { message: `Repeat 203.0.113.7 hash ${MD5}`, metadata: { nested: { ignored: '198.51.100.1' } } },
    { message: 'Version 1.2.3 and address 999.1.1.1 are not indicators' }
  ];

  it('extracts IPv4 addresses, domains and hashes with counts', () => {
    const indicators = extractIndicators(logs);
    const find = (value: string) => indicators.find(i => i.value === value);

    expect(find('203.0.113.7')).toEqual({ type: 'ipv4', value: '203.0.113.7', count: 2, scope: 'public' });
    expect(find('10.0.0.5')).toEqual({ type: 'ipv4', value: '10.0.0.5', count: 1, scope: 'private' });
    expect(find('evil.example.net')).toEqual(expect.objectContaining({ type: 'domain', count: 1 }));
    expect(find('files.example.com')).toEqual(expect.objectContaining({ type: 'domain', count: 1 }));
    expect(find(SHA256)).toEqual(expect.objectContaining({ type: 'sha256', count: 1 }));
    expect(find(MD5)).toEqual(expect.objectContaining({ type: 'md5', count: 1 }));
  });

  it('ignores file names, version numbers, invalid addresses and nested metadata', () => {
    const values = extractIndicators(logs).map(i => i.value);

    expect(values).not.toContain('invoice.pdf.exe');
    expect(values).not.toContain('pdf.exe');
    expect(values).not.toContain('999.1.1.1');
    expect(values).not.toContain('1.2.3');
    expect(values).not.toContain('198.51.100.1');
  });

  it('marks non-publicly-routable IPv4 ranges as private', () => {
    const addresses = ['0.110.150.26', '100.64.1.2', '127.0.0.1', '169.254.1.1', '172.20.0.1', '192.168.1.1', '224.0.0.5', '240.1.1.1', '8.8.8.8', '100.128.0.1'];
    const scopes = Object.fromEntries(extractIndicators(addresses.map(ip => ({ message: `from ${ip}` }))).map(i => [i.value, i.scope]));

    expect(scopes).toEqual({
      '0.110.150.26': 'private', '100.64.1.2': 'private', '127.0.0.1': 'private', '169.254.1.1': 'private',
      '172.20.0.1': 'private', '192.168.1.1': 'private', '224.0.0.5': 'private', '240.1.1.1': 'private',
      '8.8.8.8': 'public', '100.128.0.1': 'public'
    });
  });

  it('sorts by count, most frequent first', () => {
    const counts = extractIndicators(logs).map(i => i.count);

    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});

describe('parseIndicatorList', () => {
  it('reads one indicator per line, ignoring blanks and # comments, case-insensitively', () => {
    const list = parseIndicatorList('# known bad\nEVIL.example.net\n\n203.0.113.7  \n');

    expect([...list].sort()).toEqual(['203.0.113.7', 'evil.example.net']);
  });
});

describe('matchIndicators', () => {
  it('returns the extracted indicators that are on the list', () => {
    const indicators = extractIndicators([{ message: 'to evil.example.net from 203.0.113.7 and 10.0.0.5' }]);

    const matches = matchIndicators(indicators, parseIndicatorList('evil.example.net\n203.0.113.7'));

    expect(matches.map(m => m.value).sort()).toEqual(['203.0.113.7', 'evil.example.net']);
  });
});
