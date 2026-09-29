import { measureFor, toMeasurement } from './measure';

describe('toMeasurement', () => {
  it('derives logs per second and MB per second from the totals', () => {
    const result = toMeasurement('json', 5000, 2 * 1024 * 1024, 2);

    expect(result).toEqual({ name: 'json', logs: 5000, bytes: 2097152, seconds: 2, logsPerSecond: 2500, mbPerSecond: 1, bytesPerLog: 419 });
  });

  it('reports zero rates instead of dividing by zero', () => {
    const result = toMeasurement('empty', 0, 0, 0);

    expect(result.logsPerSecond).toBe(0);
    expect(result.mbPerSecond).toBe(0);
    expect(result.bytesPerLog).toBe(0);
  });
});

describe('measureFor', () => {
  it('repeats the step until the duration has passed and adds up what each step processed', () => {
    let calls = 0;
    const result = measureFor('step', 50, () => {
      calls++;
      return { logs: 10, bytes: 100 };
    });

    expect(calls).toBeGreaterThan(1);
    expect(result.logs).toBe(calls * 10);
    expect(result.bytes).toBe(calls * 100);
    expect(result.seconds).toBeGreaterThanOrEqual(0.05);
  });

  it('always runs the step at least once', () => {
    const result = measureFor('once', 0, () => ({ logs: 1, bytes: 1 }));

    expect(result.logs).toBeGreaterThanOrEqual(1);
  });
});
