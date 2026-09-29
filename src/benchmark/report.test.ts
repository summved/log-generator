import { toMeasurement } from './measure';
import { renderReport } from './report';
import { BenchmarkReport } from './runBenchmark';

const base: BenchmarkReport = {
  startedAt: '2026-01-01T00:00:00.000Z',
  system: { node: 'v22.12.0', platform: 'linux x64', cpus: 4, cpuModel: 'Test CPU' },
  durationPerMeasurementMs: 2000
};

describe('renderReport', () => {
  it('shows each section that was measured, with logs per second', () => {
    const text = renderReport({
      ...base,
      generators: [toMeasurement('endpoint', 200000, 60000000, 2)],
      mixed: toMeasurement('all 12 generators', 150000, 45000000, 2),
      timestampLeadSeconds: 0,
      formats: [toMeasurement('cef', 400000, 80000000, 2)],
      outputs: [{ ...toMeasurement('file', 40000, 12000000, 2), delivered: 40000 }],
      workers: [toMeasurement('1 worker', 100000, 1, 2), toMeasurement('4 workers', 360000, 1, 2)],
      workerFormat: 'json'
    });

    expect(text).toContain('Test CPU');
    expect(text).toMatch(/endpoint\s+100,000/);
    expect(text).toMatch(/cef\s+200,000/);
    expect(text).toMatch(/file\s+20,000.*100%/);
    expect(text).toMatch(/4 workers\s+180,000/);
    expect(text).toContain('Peak: 180,000 logs/s with 4 workers');
  });

  it('warns when generated timestamps ran ahead of the clock', () => {
    const text = renderReport({ ...base, mixed: toMeasurement('all 12 generators', 100, 1, 1), timestampLeadSeconds: 95 });

    expect(text).toContain('95s ahead of the clock');
  });

  it('shows how much of a UDP syslog run was delivered', () => {
    const text = renderReport({ ...base, outputs: [{ ...toMeasurement('syslog', 1000, 1, 1), delivered: 250 }] });

    expect(text).toMatch(/syslog.*25%/);
  });

  it('leaves out sections that were not measured', () => {
    const text = renderReport(base);

    expect(text).not.toContain('Worker threads');
    expect(text).not.toContain('Peak:');
  });
});
