import { applyVariation, VARIATION_LEVELS, variationSpread } from './variationProfile';
import { AttackChainStep } from '../types/attackChain';

const step = (): AttackChainStep => ({
  id: 's1',
  name: 'Step',
  description: '',
  mitre: { technique: 'T1110', tactic: 'TA0006', description: '' },
  timing: { delayAfterPrevious: 10000, duration: 60000, variance: 0.2 },
  logGeneration: { sources: ['authentication'], templates: ['t'], frequency: 100 }
} as unknown as AttackChainStep);

describe('variationSpread', () => {
  it('maps each level to a documented spread, and static mode to none', () => {
    expect(VARIATION_LEVELS).toEqual(['basic', 'medium', 'high', 'advanced']);
    expect(variationSpread('enhanced', 'basic')).toBe(0.1);
    expect(variationSpread('enhanced', 'medium')).toBe(0.2);
    expect(variationSpread('dynamic', 'high')).toBe(0.35);
    expect(variationSpread('dynamic', 'advanced')).toBe(0.5);
    expect(variationSpread('static', 'advanced')).toBe(0);
  });

  it('rejects unknown modes and levels', () => {
    expect(() => variationSpread('turbo', 'basic')).toThrow(/Unknown mode/);
    expect(() => variationSpread('enhanced', 'max')).toThrow(/Unknown level/);
  });
});

describe('applyVariation', () => {
  it('leaves steps unchanged with no spread', () => {
    const [varied] = applyVariation([step()], 0, () => 0.9);

    expect(varied).toEqual(step());
  });

  it('keeps duration, delay and log rate within the spread', () => {
    for (let i = 0; i < 200; i++) {
      const [varied] = applyVariation([step()], 0.35);
      expect(varied.timing.duration).toBeGreaterThanOrEqual(60000 * 0.65);
      expect(varied.timing.duration).toBeLessThanOrEqual(60000 * 1.35);
      expect(varied.timing.delayAfterPrevious).toBeGreaterThanOrEqual(10000 * 0.65);
      expect(varied.logGeneration.frequency).toBeGreaterThanOrEqual(100 * 0.65);
      expect(varied.logGeneration.frequency).toBeLessThanOrEqual(100 * 1.35);
    }
  });

  it('keeps the MITRE mapping and does not change the input', () => {
    const original = [step()];
    const [varied] = applyVariation(original, 0.5);

    expect(varied.mitre).toEqual(step().mitre);
    expect(original[0]).toEqual(step());
  });
});
