import { runBenchmark } from './runBenchmark';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('runBenchmark', () => {
  it('runs only the requested phases and reports progress', async () => {
    const progress: string[] = [];
    const report = await runBenchmark({ durationMs: 50, phases: ['generators', 'formats'], onProgress: message => progress.push(message) });

    expect(report.generators).toHaveLength(12);
    expect(report.mixed?.logs).toBeGreaterThan(0);
    expect(report.timestampLeadSeconds).toBeGreaterThanOrEqual(0);
    expect(report.formats?.map(f => f.name)).toEqual(['json', 'syslog', 'cef', 'wazuh']);
    expect(report.outputs).toBeUndefined();
    expect(report.workers).toBeUndefined();
    expect(progress).toHaveLength(2);
    expect(report.system.cpus).toBeGreaterThan(0);
  }, 60000);

  it('runs every output and the requested worker counts', async () => {
    const report = await runBenchmark({ durationMs: 100, phases: ['outputs', 'workers'], workerCounts: [1, 2], workerFormat: 'cef' });

    expect(report.outputs?.map(o => o.name)).toEqual(['file', 'http', 'syslog', 'history storage only']);
    expect(report.workers?.map(w => w.name)).toEqual(['1 worker', '2 workers']);
    expect(report.workerFormat).toBe('cef');
    expect(report.generators).toBeUndefined();
  }, 120000);
});
