import { GeneratorConfig } from '../types';
import { SecurityOperationsGenerator, SOC_INTENSITY_RATE, SOC_SCENARIOS } from './SecurityOperationsGenerator';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const config: GeneratorConfig = { enabled: true, frequency: 300, templates: [] } as unknown as GeneratorConfig;

describe('SecurityOperationsGenerator', () => {
  it('generates SOC logs from the soc-platform source with D3FEND data', () => {
    const logs = new SecurityOperationsGenerator(config).generateLogs(100);

    expect(logs).toHaveLength(100);
    expect(logs.every(log => log.source.name === 'soc-platform')).toBe(true);
    expect(logs.some(log => log.d3fend)).toBe(true);
    expect(logs.every(log => !/\{\{?\w+\}?\}/.test(log.message))).toBe(true);
  });

  it('limits the analyst pool to the requested count', () => {
    const logs = new SecurityOperationsGenerator(config, { analysts: 1 }).generateLogs(200);
    const analysts = new Set(logs.map(log => log.metadata.analyst).filter(Boolean));

    expect(analysts.size).toBe(1);
    expect([...analysts][0]).toBe('alice.security');
  });

  it.each(SOC_SCENARIOS)('for scenario %s produces only that scenario\'s activity types', scenario => {
    const logs = new SecurityOperationsGenerator(config, { scenario }).generateLogs(150);
    const components = new Set(logs.map(log => log.metadata.component).filter(Boolean));

    expect(logs.length).toBe(150);
    // Each scenario draws from a small fixed set of activities, never all eight
    expect(components.size).toBeGreaterThan(0);
    expect(components.size).toBeLessThanOrEqual(3);
  });

  it('maps intensity to a documented rate', () => {
    expect(SOC_INTENSITY_RATE).toEqual({ low: 60, medium: 300, high: 1200 });
  });
});
