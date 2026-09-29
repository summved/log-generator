import { ConfigManager } from '../config';
import { createGenerators } from '../generators/createGenerators';
import { LocalReceivers, startLocalReceivers } from './localReceivers';
import { benchmarkHistoryStorage, benchmarkOutput, OUTPUT_DESTINATIONS } from './outputs';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('output benchmarks (local only)', () => {
  const config = new ConfigManager().getConfig();
  const generators = createGenerators(config.generators);
  let receivers: LocalReceivers;

  beforeAll(async () => { receivers = await startLocalReceivers(); });
  afterAll(async () => { await receivers.stop(); });

  it('listens on 127.0.0.1 only', () => {
    expect(receivers.httpUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/logs$/);
    expect(receivers.syslogPort).toBeGreaterThan(0);
  });

  it.each(OUTPUT_DESTINATIONS)('sends logs to %s through the real OutputManager and counts what arrived', async destination => {
    const result = await benchmarkOutput(destination, { generators, output: config.output, durationMs: 200, receivers });

    expect(result.name).toBe(destination);
    expect(result.logs).toBeGreaterThan(0);
    expect(result.delivered).toBeGreaterThan(0);
    expect(result.delivered).toBeLessThanOrEqual(result.logs);
    if (destination !== 'syslog') {
      // File and HTTP are reliable; UDP syslog may drop datagrams under load
      expect(result.delivered).toBe(result.logs);
    }
  }, 60000);

  it('measures the per-log history storage on its own, keeping every log', async () => {
    const result = await benchmarkHistoryStorage(generators, 200);

    expect(result.logs).toBeGreaterThan(0);
    expect(result.delivered).toBe(result.logs);
  }, 60000);
});
