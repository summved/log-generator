import { groupByTemplate, numberValues, toTemplate } from './logTemplates';

describe('toTemplate', () => {
  it.each([
    ['Failed login for alice from 10.0.0.5', 'Failed login for alice from <IP>'],
    ['Request took 250ms status 503', 'Request took <NUM>ms status <NUM>'],
    ['Session 9f1c2b7e-3d4a-4b5c-8d9e-0f1a2b3c4d5e expired', 'Session <UUID> expired'],
    ['Mail from bob@example.com rejected', 'Mail from <EMAIL> rejected'],
    [`Hash ${'a'.repeat(64)} matched`, 'Hash <HEX> matched'],
    ['GET https://api.example.com/v1/users?id=7 returned 200', 'GET <URL> returned <NUM>'],
    ['Disk usage 93.5% on volume 3', 'Disk usage <NUM>% on volume <NUM>'],
    ['Started at 2026-01-01T10:00:00.000Z', 'Started at <TIME>']
  ])('masks variable parts: %s', (message, template) => {
    expect(toTemplate(message)).toBe(template);
  });

  it('keeps words that contain digits as part of identifiers', () => {
    expect(toTemplate('Service api-v2 on host web01 restarted')).toBe('Service api-v2 on host web01 restarted');
  });
});

describe('groupByTemplate', () => {
  const logs = [
    { message: 'Failed login for alice from 10.0.0.5', level: 'WARN', source: { name: 'auth' }, timestamp: '2026-01-01T00:00:00.000Z' },
    { message: 'Failed login for alice from 10.0.0.9', level: 'WARN', source: { name: 'auth' }, timestamp: '2026-01-01T00:05:00.000Z' },
    { message: 'Failed login for alice from 10.0.0.7', level: 'ERROR', source: { name: 'auth' }, timestamp: '2026-01-01T00:02:00.000Z' },
    { message: 'Request took 250ms status 200', level: 'INFO', source: { name: 'web' } }
  ];

  it('groups messages that share a template, most frequent first', () => {
    const groups = groupByTemplate(logs);

    expect(groups.map(g => [g.template, g.count])).toEqual([
      ['Failed login for alice from <IP>', 3],
      ['Request took <NUM>ms status <NUM>', 1]
    ]);
    expect(groups[0].share).toBeCloseTo(0.75);
  });

  it('summarises levels, sources, time range and examples for each group', () => {
    const [failed] = groupByTemplate(logs, { examples: 2 });

    expect(failed.levels).toEqual({ WARN: 2, ERROR: 1 });
    expect(failed.sources).toEqual({ auth: 3 });
    expect(failed.firstSeen).toBe('2026-01-01T00:00:00.000Z');
    expect(failed.lastSeen).toBe('2026-01-01T00:05:00.000Z');
    expect(failed.examples).toEqual(['Failed login for alice from 10.0.0.5', 'Failed login for alice from 10.0.0.9']);
  });
});

describe('numberValues', () => {
  it('returns the plain numbers in order, ignoring those inside IPs, UUIDs and timestamps', () => {
    expect(numberValues('GET /a from 10.0.0.5 - 404 in 12.5ms at 2026-01-01T10:00:00Z (3 retries)')).toEqual(['404', '12.5', '3']);
  });
});
