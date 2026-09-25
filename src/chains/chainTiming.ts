/**
 * Chain Timing
 * Wall-clock timing helpers for attack chains
 */

import { AttackChainStep } from '../types/attackChain';

/** Total run time of the steps at 1x speed: every step's delay plus its duration */
export function chainDurationMs(steps: AttackChainStep[]): number {
  return steps.reduce((total, step) => total + step.timing.delayAfterPrevious + step.timing.duration, 0);
}

/** Speed multiplier that makes the steps finish in `targetMs` of wall-clock time */
export function speedForTargetDuration(steps: AttackChainStep[], targetMs: number): number {
  if (!(targetMs > 0)) {
    throw new Error('Target duration must be greater than zero');
  }
  return chainDurationMs(steps) / targetMs;
}
