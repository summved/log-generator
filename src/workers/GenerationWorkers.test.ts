import { ConfigManager } from '../config';
import { Config, LogEntry } from '../types';
import { BATCH_LIMIT, MAX_UNACKED_LOGS } from './generationWorker';
import { GenerationWorkers } from './GenerationWorkers';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

/** Every generator enabled at the given rate (logs per minute) */
function generatorsAt(perMinute: number): Config['generators'] {
  const generators = new ConfigManager().getConfig().generators;
  return Object.fromEntries(
    Object.entries(generators).map(([name, config]) => [name, { ...config, enabled: true, frequency: perMinute }])
  ) as Config['generators'];
}

async function collect(workers: GenerationWorkers, generators: Config['generators'], ms: number): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  await workers.start(generators, batch => logs.push(...batch));
  await new Promise(resolve => setTimeout(resolve, ms));
  await workers.stop();
  return logs;
}

describe('GenerationWorkers', () => {
  it('runs every generator in the workers and delivers their logs to the main thread', async () => {
    const logs = await collect(new GenerationWorkers(2), generatorsAt(60000), 600);

    expect(logs.length).toBeGreaterThan(0);
    expect(new Set(logs.map(log => log.source.type)).size).toBe(12);
  }, 60000);

  it('never gives two logs the same timestamp, even across workers', async () => {
    const logs = await collect(new GenerationWorkers(4), generatorsAt(120000), 600);

    expect(new Set(logs.map(log => log.timestamp)).size).toBe(logs.length);
  }, 60000);

  it('keeps the configured total rate when it is split across workers', async () => {
    // 12 generators x 6,000/min = 1,200 logs/s in total, whatever the worker count
    const one = await collect(new GenerationWorkers(1), generatorsAt(6000), 1500);
    const three = await collect(new GenerationWorkers(3), generatorsAt(6000), 1500);

    // Timer-based, so allow for slow machines; without the split, 3 workers would give ~3x
    expect(three.length / one.length).toBeGreaterThan(0.5);
    expect(three.length / one.length).toBeLessThan(2);
  }, 60000);

  it('stops promptly and sends no logs after stop() resolves', async () => {
    const workers = new GenerationWorkers(2);
    let afterStop = 0;
    let stopped = false;
    await workers.start(generatorsAt(60000), batch => { if (stopped) afterStop += batch.length; });
    await new Promise(resolve => setTimeout(resolve, 200));

    const started = Date.now();
    await workers.stop();
    stopped = true;
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(Date.now() - started).toBeLessThan(3000);
    expect(afterStop).toBe(0);
    expect(workers.size).toBe(0);
  }, 60000);

  it('pauses the workers while the main thread has not finished their logs, and resumes after', async () => {
    const workers = new GenerationWorkers(2);
    let received = 0;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    // Demand far more than can be taken: 12 generators x 100,000 logs/s
    await workers.start(generatorsAt(6000000), batch => { received += batch.length; return held; });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const whileHeld = received;

    release();
    await new Promise(resolve => setTimeout(resolve, 500));
    await workers.stop();

    // Each worker stops at MAX_UNACKED_LOGS, plus at most one batch per generator tick
    expect(whileHeld).toBeGreaterThan(0);
    expect(whileHeld).toBeLessThanOrEqual(2 * (MAX_UNACKED_LOGS + BATCH_LIMIT + 12 * 1000));
    expect(received).toBeGreaterThan(whileHeld);
  }, 60000);

  it('fails start() with the worker error when the generators config is unusable', async () => {
    const workers = new GenerationWorkers(1);

    await expect(workers.start(null as unknown as Config['generators'], () => undefined)).rejects.toThrow(/Generation worker 0 failed/);
    expect(workers.size).toBe(0);
  }, 60000);
});
