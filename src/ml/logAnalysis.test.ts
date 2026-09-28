import { analyzeLogs } from './logAnalysis';

function logs() {
  const out = [];
  for (let i = 0; i < 40; i++) {
    out.push({ message: `Failed password for root from 203.0.113.${i}`, level: 'WARN', source: { type: 'authentication', name: 'auth' }, timestamp: `2026-01-05T09:${String(i).padStart(2, '0')}:00.000Z`, metadata: { user: 'root' } });
    out.push({ message: `GET /page/${i} 200`, level: 'INFO', source: { type: 'webserver', name: 'nginx' }, timestamp: `2026-01-05T14:${String(i).padStart(2, '0')}:00.000Z` });
    out.push({ message: `CPU at ${50 + i}%`, level: 'INFO', source: { type: 'server', name: 'host1' }, timestamp: `2026-01-05T14:${String(i).padStart(2, '0')}:30.000Z` });
  }
  return out;
}

describe('analyzeLogs', () => {
  it('summarises patterns, levels, sources, busiest hours and indicators', () => {
    const report = analyzeLogs(logs());

    expect(report.analyzedLogs).toBe(120);
    expect(report.templates.map(t => t.template)).toEqual(expect.arrayContaining(['Failed password for root from <IP>', 'GET /page/<NUM> <NUM>', 'CPU at <NUM>%']));
    expect(report.levels).toEqual({ WARN: 40, INFO: 80 });
    expect(report.sources).toEqual({ auth: 40, nginx: 40, host1: 40 });
    expect(report.busiestHours[0]).toEqual({ hour: 14, share: 80 / 120 });
    expect(report.indicators.ipv4).toBe(40);
    expect(report.outliers.length).toBeGreaterThan(0);
  });

  it.each([
    ['security', ['auth']],
    ['user', ['auth']],
    ['system', ['host1']],
    ['application', ['nginx']]
  ])('focus %s keeps only the relevant logs', (focus, sources) => {
    const report = analyzeLogs(logs(), { focus: focus as 'security' });

    expect(Object.keys(report.sources)).toEqual(sources);
    expect(report.totalLogs).toBe(120);
  });

  it('treats API gateway (endpoint) traffic as application, and only its elevated or MITRE-tagged logs as security', () => {
    const gateway = [
      { message: 'GET /a 200', level: 'INFO', source: { type: 'endpoint', name: 'api-gateway' } },
      { message: 'GET /b 500', level: 'ERROR', source: { type: 'endpoint', name: 'api-gateway' } },
      { message: 'GET /c 200', level: 'INFO', source: { type: 'endpoint', name: 'api-gateway' }, mitre: { technique: 'T1190' } }
    ];

    expect(analyzeLogs(gateway, { focus: 'application' }).analyzedLogs).toBe(3);
    expect(analyzeLogs(gateway, { focus: 'security' }).analyzedLogs).toBe(2);
  });

  it('rejects an unknown focus', () => {
    expect(() => analyzeLogs(logs(), { focus: 'finance' as 'security' })).toThrow('Unknown focus "finance". Use user, system, security or application');
  });

  it('works on small inputs without outlier scoring', () => {
    const report = analyzeLogs(logs().slice(0, 5));

    expect(report.analyzedLogs).toBe(5);
    expect(report.outliers).toEqual([]);
  });
});
