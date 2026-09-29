import { ConfigManager } from '../config';
import { createGenerators, GENERATOR_NAMES } from '../generators/createGenerators';
import { LOG_FORMATS } from '../utils/formatters';
import { benchmarkFormats, benchmarkGenerators, benchmarkMixedGenerators, timestampLeadSeconds } from './inProcess';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const generators = () => createGenerators(new ConfigManager().getConfig().generators);

describe('in-process benchmarks', () => {
  it('measures each generator separately, including its average JSON size', () => {
    const results = benchmarkGenerators(generators(), 20);

    expect(results.map(r => r.name)).toEqual(GENERATOR_NAMES);
    for (const result of results) {
      expect(result.logs).toBeGreaterThan(0);
      expect(result.logsPerSecond).toBeGreaterThan(0);
      expect(result.bytesPerLog).toBeGreaterThan(50);
    }
  });

  it('measures all generators together, taking turns', () => {
    const result = benchmarkMixedGenerators(generators(), 20);

    expect(result.name).toBe('all 12 generators');
    expect(result.logs).toBeGreaterThanOrEqual(GENERATOR_NAMES.length);
  });

  it('measures every output format on the same sample logs', () => {
    const sample = [...generators().values()].flatMap(g => g.generateLogs(5));
    const results = benchmarkFormats(sample, 20);

    expect(results.map(r => r.name)).toEqual(LOG_FORMATS);
    for (const result of results) {
      expect(result.bytes).toBeGreaterThan(0);
      expect(result.logsPerSecond).toBeGreaterThan(0);
    }
  });
});

describe('timestampLeadSeconds', () => {
  it('reports how far the newest generated timestamp is ahead of the clock', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');

    expect(timestampLeadSeconds(now + 90000, now)).toBe(90);
    expect(timestampLeadSeconds(now - 5000, now)).toBe(0);
  });
});
