import { LogEntry } from '../types';
import { buildHttpPayload, HTTP_PAYLOADS } from './httpPayload';

const entry = (i: number): LogEntry => ({
  timestamp: `2026-01-01T00:00:0${i}.123456Z`,
  level: 'WARN',
  source: { type: 'firewall', name: 'pfsense-fw', host: 'firewall-01' },
  message: `blocked ${i}`,
  metadata: { rule: i }
});
const item = (i: number, format: 'json' | 'cef' = 'json') => ({
  entry: entry(i),
  log: format === 'json' ? JSON.stringify(entry(i)) : `CEF:0|LogGenerator|LogGen|1.0|FIREWALL|blocked ${i}|5|`
});

describe('buildHttpPayload', () => {
  it('supports four payload shapes', () => {
    expect(HTTP_PAYLOADS).toEqual(['batch', 'ndjson', 'splunk-hec', 'elasticsearch-bulk']);
  });

  it('batch: the original {logs, count, timestamp} JSON body', () => {
    const json = JSON.parse(buildHttpPayload('batch', [item(1), item(2)], 'json').body);
    const cef = JSON.parse(buildHttpPayload('batch', [item(2, 'cef')], 'cef').body);

    expect(buildHttpPayload('batch', [item(1)], 'json').contentType).toBe('application/json');
    expect(json.count).toBe(2);
    expect(json.logs[0]).toEqual(entry(1));
    expect(cef.logs[0]).toEqual({ message: item(2, 'cef').log, original: entry(2) });
    expect(typeof json.timestamp).toBe('string');
  });

  it('ndjson: one formatted log per line', () => {
    const { body, contentType } = buildHttpPayload('ndjson', [item(1), item(2)], 'json');

    expect(contentType).toBe('application/x-ndjson');
    expect(body).toBe(`${item(1).log}\n${item(2).log}\n`);
  });

  it('splunk-hec: one {"event": ...} object per log with time, host, source and sourcetype', () => {
    const { body, contentType } = buildHttpPayload('splunk-hec', [item(1), item(2)], 'json');
    const events = body.trim().split('\n').map(line => JSON.parse(line));
    const cef = JSON.parse(buildHttpPayload('splunk-hec', [item(2, 'cef')], 'cef').body);

    expect(contentType).toBe('application/json');
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ time: 1767225601.123, host: 'firewall-01', source: 'pfsense-fw', sourcetype: 'log-generator:firewall', event: entry(1) });
    expect(cef.event).toBe(item(2, 'cef').log);
  });

  it('elasticsearch-bulk: an index action line followed by the document, with @timestamp', () => {
    const { body, contentType } = buildHttpPayload('elasticsearch-bulk', [item(1), item(2)], 'json', 'siem-test');
    const lines = body.split('\n');
    const cef = buildHttpPayload('elasticsearch-bulk', [item(2, 'cef')], 'cef', 'siem-test').body.split('\n');

    expect(contentType).toBe('application/x-ndjson');
    expect(body.endsWith('\n')).toBe(true);
    expect(lines).toHaveLength(5);
    expect(JSON.parse(lines[0])).toEqual({ index: { _index: 'siem-test' } });
    expect(JSON.parse(lines[1])).toEqual({ '@timestamp': entry(1).timestamp, ...entry(1) });
    expect(JSON.parse(cef[1])).toEqual({ '@timestamp': entry(2).timestamp, message: item(2, 'cef').log, original: entry(2) });
  });

  it('elasticsearch-bulk: defaults the index to log-generator', () => {
    const { body } = buildHttpPayload('elasticsearch-bulk', [item(1)], 'json');

    expect(JSON.parse(body.split('\n')[0])).toEqual({ index: { _index: 'log-generator' } });
  });
});
