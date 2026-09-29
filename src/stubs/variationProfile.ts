/**
 * What `--mode` and `--ai-level` do for execute-ai and training: vary each step's duration,
 * delay and log rate by up to ±spread, so repeated runs of a chain are not identical.
 * The steps, their order and their MITRE mapping never change.
 */

import { AttackChainStep } from '../types/attackChain';

export const VARIATION_MODES = ['static', 'enhanced', 'dynamic'];
export const VARIATION_LEVELS = ['basic', 'medium', 'high', 'advanced'];
const SPREAD: Record<string, number> = { basic: 0.1, medium: 0.2, high: 0.35, advanced: 0.5 };

/** ±fraction applied to timing and log rate; static mode means no variation */
export function variationSpread(mode: string, level: string): number {
  if (!VARIATION_MODES.includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Use one of: ${VARIATION_MODES.join(', ')}`);
  }
  if (!VARIATION_LEVELS.includes(level)) {
    throw new Error(`Unknown level "${level}". Use one of: ${VARIATION_LEVELS.join(', ')}`);
  }
  return mode === 'static' ? 0 : SPREAD[level];
}

/** Copies of the steps with duration, delay and log rate scaled by a random factor in [1-spread, 1+spread] */
export function applyVariation(steps: AttackChainStep[], spread: number, random: () => number = Math.random): AttackChainStep[] {
  if (spread <= 0) return steps.map(item => structuredClone(item));
  const factor = () => 1 + (random() * 2 - 1) * spread;
  return steps.map(item => {
    const copy = structuredClone(item);
    copy.timing.duration = Math.round(copy.timing.duration * factor());
    copy.timing.delayAfterPrevious = Math.round(copy.timing.delayAfterPrevious * factor());
    copy.logGeneration.frequency = copy.logGeneration.frequency * factor();
    return copy;
  });
}
