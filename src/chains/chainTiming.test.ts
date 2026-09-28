import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AttackChainStep, AttackChainTemplate } from '../types/attackChain';
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

describe('shipped attack chain templates', () => {
  const templatesDir = path.join(__dirname, 'templates');
  const templates = readdirSync(templatesDir)
    .filter(file => file.endsWith('.yaml'))
    .map(file => ({ file, template: yaml.load(readFileSync(path.join(templatesDir, file), 'utf8')) as AttackChainTemplate }));

  it.each(templates.map(t => [t.file, t.template]))('%s states its real 1x run time', (_file, template) => {
    const minutes = Math.round(chainDurationMs(template.chain.steps) / 60000);
    expect(template.chain.metadata.estimated_duration).toBe(minutes);
  });

  it.each(templates.map(t => [t.file, t.template]))('%s fits within its max_duration', (_file, template) => {
    expect(chainDurationMs(template.chain.steps)).toBeLessThanOrEqual(template.chain.config.max_duration);
  });
});
