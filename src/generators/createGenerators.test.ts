import { ConfigManager } from '../config';
import { createGenerators, GENERATOR_NAMES } from './createGenerators';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('createGenerators', () => {
  const generatorsConfig = new ConfigManager().getConfig().generators;

  it('creates one generator for each of the 12 log types', () => {
    const generators = createGenerators(generatorsConfig);

    expect([...generators.keys()]).toEqual(GENERATOR_NAMES);
    expect(GENERATOR_NAMES).toHaveLength(12);
  });

  it('generates the requested number of logs synchronously, without a timer', () => {
    const generators = createGenerators(generatorsConfig);

    for (const [name, generator] of generators) {
      const logs = generator.generateLogs(25);
      expect(logs).toHaveLength(25);
      expect(logs[0].metadata.generator).toBeDefined();
      expect(logs[0].source.type).toBe(generator.getSource().type);
      expect(name).toBeTruthy();
    }
  });

  it('keeps each generator stopped until start() is called', () => {
    for (const generator of createGenerators(generatorsConfig).values()) {
      expect(generator.isGeneratorRunning()).toBe(false);
    }
  });
});

describe('generated logs', () => {
  const config = new ConfigManager().getConfig().generators;

  it('carry the full source identity, including the component, for all 12 generators', () => {
    for (const [name, generator] of createGenerators(config)) {
      const [log] = generator.generateLogs(1);
      expect({ name, component: log.source.component, host: log.source.host }).toEqual({
        name,
        component: expect.any(String),
        host: expect.any(String)
      });
    }
  });

  it('report the source host in metadata.host', () => {
    for (const generator of createGenerators(config).values()) {
      for (const log of generator.generateLogs(5)) {
        expect(log.metadata.host).toBe(log.source.host);
      }
    }
  });

  it('never contain an unfilled {placeholder} in the message or metadata', () => {
    for (const generator of createGenerators(config).values()) {
      for (const log of generator.generateLogs(200)) {
        expect(`${log.message} ${JSON.stringify(log.metadata)}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('default to 238 logs per minute across all generators', () => {
    const total = Object.values(config).reduce((sum, generator) => sum + (generator.enabled ? generator.frequency : 0), 0);

    expect(total).toBe(238);
  });
});
