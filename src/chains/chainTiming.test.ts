import { AttackChainStep } from '../types/attackChain';
import { chainDurationMs, speedForTargetDuration } from './chainTiming';

function step(delayAfterPrevious: number, duration: number): AttackChainStep {
  return {
    id: `s${delayAfterPrevious}-${duration}`,
    name: 'step',
    description: 'step',
    mitre: { technique: 'T1059', tactic: 'TA0002' },
    timing: { delayAfterPrevious, duration, variance: 0 },
    logGeneration: { templates: ['t'], frequency: 1, sources: ['endpoint'] }
  };
}

describe('chainDurationMs', () => {
  it('adds every step delay and duration', () => {
    expect(chainDurationMs([step(0, 60000), step(30000, 90000)])).toBe(180000);
  });
});

describe('speedForTargetDuration', () => {
  const steps = [step(0, 60000), step(60000, 480000)]; // 10 minutes at 1x

  it('returns the speed multiplier that fits the chain into the target time', () => {
    expect(speedForTargetDuration(steps, 5 * 60000)).toBe(2);
    expect(speedForTargetDuration(steps, 20 * 60000)).toBe(0.5);
  });

  it('rejects a non-positive target', () => {
    expect(() => speedForTargetDuration(steps, 0)).toThrow('Target duration must be greater than zero');
  });
});
