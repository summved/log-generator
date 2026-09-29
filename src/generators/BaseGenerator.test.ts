import { ConfigManager } from '../config';
import { LogEntry } from '../types';
import { createGenerators } from './createGenerators';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const endpoint = () => {
  const config = new ConfigManager().getConfig().generators;
  return createGenerators({ ...config, endpoint: { ...config.endpoint, enabled: true, frequency: 60000 } }).get('endpoint')!;
};
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('BaseGenerator pause and resume', () => {
  it('pause() stops new logs without stopping the generator, and resume() continues', async () => {
    const generator = endpoint();
    const logs: LogEntry[] = [];
    generator.start(log => logs.push(log));
    await wait(250);

    generator.pause();
    const atPause = logs.length;
    await wait(250);
    const whilePaused = logs.length - atPause;
    expect(generator.isGeneratorRunning()).toBe(true);
    expect(generator.isPaused()).toBe(true);

    generator.resume();
    await wait(250);
    generator.stop();

    expect(atPause).toBeGreaterThan(0);
    expect(whilePaused).toBe(0);
    expect(logs.length).toBeGreaterThan(atPause);
    expect(generator.isPaused()).toBe(false);
  });

  it('ignores resume() when not paused and pause() when stopped', async () => {
    const generator = endpoint();
    const logs: LogEntry[] = [];

    generator.pause();
    generator.start(log => logs.push(log));
    generator.resume();
    generator.resume();
    await wait(200);
    generator.stop();
    const total = logs.length;
    await wait(200);

    expect(total).toBeGreaterThan(0);
    // A single timer: stopping leaves nothing running
    expect(logs.length).toBe(total);
  });
});

describe('BaseGenerator rate', () => {
  beforeEach(() => jest.useFakeTimers({ now: Date.parse('2026-01-01T00:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  const generatorAt = (perMinute: number) => {
    const config = new ConfigManager().getConfig().generators;
    return createGenerators({ ...config, firewall: { ...config.firewall, enabled: true, frequency: perMinute } }).get('firewall')!;
  };

  it.each([8, 25, 40, 100, 300, 899, 1000, 10000, 60000])('produces %d logs per minute', perMinute => {
    const generator = generatorAt(perMinute);
    let count = 0;
    generator.start(() => { count++; });
    jest.advanceTimersByTime(60000);
    generator.stop();

    expect(Math.abs(count - perMinute)).toBeLessThanOrEqual(Math.max(1, perMinute * 0.01));
  });

  it('keeps the rate over several minutes, without drift', () => {
    const generator = generatorAt(250);
    let count = 0;
    generator.start(() => { count++; });
    jest.advanceTimersByTime(5 * 60000);
    generator.stop();

    expect(Math.abs(count - 1250)).toBeLessThanOrEqual(2);
  });

  it('does not burst to catch up after a pause', () => {
    const generator = generatorAt(6000);
    let count = 0;
    generator.start(() => { count++; });
    jest.advanceTimersByTime(10000);
    generator.pause();
    jest.advanceTimersByTime(30000);
    generator.resume();
    const atResume = count;
    jest.advanceTimersByTime(1000);
    generator.stop();

    // 6,000/min = 100/s: one second after resuming adds about 100 logs, not the 3,000 missed while paused
    expect(atResume).toBeGreaterThanOrEqual(990);
    expect(count - atResume).toBeLessThanOrEqual(110);
  });
});
