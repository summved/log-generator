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
