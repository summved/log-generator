import { ConfigManager } from '../config';
import { Config } from '../types';
import { parseWorkerCount, splitGenerators } from './splitGenerators';

const generators = (): Config['generators'] => new ConfigManager().getConfig().generators;

describe('splitGenerators', () => {
  it('gives each worker an equal share of every generator rate, so the total stays the same', () => {
    const original = generators();
    const shares = splitGenerators(original, 4);

    expect(shares).toHaveLength(4);
    for (const name of Object.keys(original) as (keyof Config['generators'])[]) {
      const total = shares.reduce((sum, share) => sum + share[name].frequency, 0);
      expect(total).toBeCloseTo(original[name].frequency, 6);
      expect(shares[0][name].enabled).toBe(original[name].enabled);
      expect(shares[0][name].templates).toEqual(original[name].templates);
    }
  });

  it('does not change the config it was given', () => {
    const original = generators();
    const before = JSON.stringify(original);

    splitGenerators(original, 3);

    expect(JSON.stringify(original)).toBe(before);
  });

  it('returns the config unchanged for one worker', () => {
    const original = generators();

    expect(splitGenerators(original, 1)).toEqual([original]);
  });
});

describe('parseWorkerCount', () => {
  it('accepts whole numbers from 1 to 256', () => {
    expect(parseWorkerCount('1')).toBe(1);
    expect(parseWorkerCount('8')).toBe(8);
    expect(parseWorkerCount('256')).toBe(256);
  });

  it.each(['0', '257', '-2', '2.5', 'four', ''])('rejects %p', value => {
    expect(() => parseWorkerCount(value)).toThrow(/Invalid worker count/);
  });
});
