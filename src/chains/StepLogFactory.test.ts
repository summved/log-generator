import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AttackChainStep, AttackChainTemplate } from '../types/attackChain';
import { buildStepLogs, resolveSourceType, calculateStepLogCount } from './StepLogFactory';

function makeStep(overrides: Partial<AttackChainStep> = {}): AttackChainStep {
  return {
    id: 'credential_dumping',
    name: 'LSASS Memory Dump',
    description: 'Dump credentials from LSASS',
    mitre: { technique: 'T1003.001', tactic: 'TA0006', subtechnique: 'LSASS Memory' },
    timing: { delayAfterPrevious: 0, duration: 120000, variance: 0 },
    logGeneration: {
      templates: ['lsass_access', 'mimikatz_execution'],
      frequency: 10,
      sources: ['endpoint', 'windows-server'],
      customData: { tool: 'mimikatz' }
    },
    ...overrides
  };
}

const startTime = new Date('2026-01-01T00:00:00.000Z');
const ctx = { chainId: 'apt29-cozy-bear-campaign', executionId: 'exec-123', startTime, windowMs: 60000 };

describe('calculateStepLogCount', () => {
  it('derives the count from logical step duration and per-minute frequency', () => {
    expect(calculateStepLogCount(makeStep())).toBe(20);
  });

  it('emits at least one log for very short steps', () => {
    const step = makeStep({ timing: { delayAfterPrevious: 0, duration: 0, variance: 0 } });
    expect(calculateStepLogCount(step)).toBe(1);
  });
});

describe('buildStepLogs', () => {
  it('tags every entry with the step MITRE technique and tactic', () => {
    const logs = buildStepLogs(makeStep(), ctx);

    expect(logs).toHaveLength(20);
    for (const log of logs) {
      expect(log.mitre).toEqual(expect.objectContaining({ technique: 'T1003.001', tactic: 'TA0006' }));
    }
  });

  it('adds attack-chain correlation metadata and step custom data to every entry', () => {
    const logs = buildStepLogs(makeStep(), ctx);

    for (const log of logs) {
      expect(log.metadata.attack_chain).toEqual(expect.objectContaining({
        chain_id: 'apt29-cozy-bear-campaign',
        execution_id: 'exec-123',
        step_id: 'credential_dumping'
      }));
      expect(log.metadata.tool).toBe('mimikatz');
    }
  });

  it('spreads timestamps evenly across the step window, in order', () => {
    const logs = buildStepLogs(makeStep(), ctx);

    const offsets = logs.map(log => Date.parse(log.timestamp) - startTime.getTime());
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(3000);
    expect(offsets[19]).toBe(57000);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    expect(new Set(logs.map(log => log.timestamp)).size).toBe(logs.length);
  });

  it('rotates through the configured templates and sources', () => {
    const logs = buildStepLogs(makeStep(), ctx);

    const templates = new Set(logs.map(log => log.metadata.attack_chain.template));
    const sourceTypes = new Set(logs.map(log => log.source.type));
    expect(templates).toEqual(new Set(['lsass_access', 'mimikatz_execution']));
    expect(sourceTypes).toEqual(new Set(['endpoint', 'server']));
  });

  it('fails loudly when a step uses an unknown source', () => {
    const step = makeStep({
      logGeneration: { templates: ['x'], frequency: 1, sources: ['bogus-source'] }
    });

    expect(() => buildStepLogs(step, ctx)).toThrow('Unknown attack-chain source "bogus-source"');
  });
});

describe('resolveSourceType', () => {
  it.each([
    ['windows-server', 'server'],
    ['file-server', 'server'],
    ['mail-server', 'email'],
    ['backup-server', 'backup'],
    ['proxy-server', 'webserver'],
    ['proxy', 'webserver'],
    ['firewall', 'firewall']
  ])('maps %s to %s', (source, expected) => {
    expect(resolveSourceType(source)).toBe(expected);
  });

  it('resolves every source used by the shipped attack chain templates', () => {
    const templatesDir = path.join(__dirname, 'templates');
    const files = readdirSync(templatesDir).filter(file => file.endsWith('.yaml'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const template = yaml.load(readFileSync(path.join(templatesDir, file), 'utf8')) as AttackChainTemplate;
      for (const step of template.chain.steps) {
        for (const source of step.logGeneration.sources) {
          expect(() => resolveSourceType(source)).not.toThrow();
        }
      }
    }
  });
});
