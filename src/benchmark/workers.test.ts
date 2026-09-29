import { runWorkers, workerCounts } from './workers';

describe('runWorkers', () => {
  it('runs the real generators in each worker thread and adds up their logs', async () => {
    const one = await runWorkers(1, { durationMs: 300, format: 'json' });
    const two = await runWorkers(2, { durationMs: 300, format: 'json' });

    expect(one.name).toBe('1 worker');
    expect(two.name).toBe('2 workers');
    expect(one.logs).toBeGreaterThan(0);
    expect(two.logs).toBeGreaterThan(0);
    expect(two.bytesPerLog).toBeGreaterThan(50);
    expect(two.seconds).toBeGreaterThanOrEqual(0.3);
  }, 60000);

  it('fails with the worker error when the config cannot be loaded', async () => {
    await expect(runWorkers(1, { durationMs: 50, format: 'json', configPath: '/no/such/config.yaml' }))
      .rejects.toThrow(/Configuration loading failed/);
  }, 60000);
});

describe('workerCounts', () => {
  it('doubles from 1 up to the CPU count, always ending on the CPU count', () => {
    expect(workerCounts(8)).toEqual([1, 2, 4, 8]);
    expect(workerCounts(6)).toEqual([1, 2, 4, 6]);
    expect(workerCounts(1)).toEqual([1]);
  });
});
