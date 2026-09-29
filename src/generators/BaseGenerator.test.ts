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
