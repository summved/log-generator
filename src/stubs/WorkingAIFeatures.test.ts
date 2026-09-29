import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AttackChainManager } from '../chains/AttackChainManager';
import { calculateStepLogCount } from '../chains/StepLogFactory';
import { AttackChainExecution } from '../types/attackChain';
import { EnhancedAttackChainManager } from './WorkingAIFeatures';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const RYUK = 'ransomware-ryuk';
let historyFile: string;
const newManager = () => new EnhancedAttackChainManager(undefined, { historyFile });

beforeEach(() => { historyFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-hist-')), 'exec.jsonl'); });

describe('previewEnhancement', () => {
  const manager = new EnhancedAttackChainManager();
  const chain = manager.getTemplate(RYUK)!.chain;

  it('describes the real chain with estimates from its template', async () => {
    const preview = await manager.previewEnhancement(RYUK, 'enhanced', 'medium');

    expect(preview.chain).toEqual(expect.objectContaining({ id: 'ryuk-ransomware-campaign', name: 'Ryuk Ransomware Campaign', stepCount: chain.steps.length }));
    expect(preview.techniques).toEqual(chain.steps.map(step => step.mitre.technique));
    expect(preview.estimatedLogs).toBe(chain.steps.reduce((total, step) => total + calculateStepLogCount(step), 0));
  });

  it('is deterministic', async () => {
    expect(await manager.previewEnhancement(RYUK, 'dynamic', 'high')).toEqual(await manager.previewEnhancement(RYUK, 'dynamic', 'high'));
  });

  it('describes only timing/log-rate variation, with no invented capabilities', async () => {
    const advanced = await manager.previewEnhancement(RYUK, 'dynamic', 'advanced');
    const staticPreview = await manager.previewEnhancement(RYUK, 'static', 'basic');

    expect(advanced.plannedChanges).toEqual([{ type: 'timing_variation', description: expect.stringContaining('+/-50%') }]);
    expect(staticPreview.plannedChanges).toEqual([{ type: 'none', description: expect.stringContaining('no variation') }]);
    expect(JSON.stringify(advanced)).not.toMatch(/evasion|anti-forensics|substitut|detection/i);
  });

  it('rejects unknown chains, modes and levels', async () => {
    await expect(manager.previewEnhancement('no-such-chain', 'enhanced', 'medium')).rejects.toThrow('Attack chain template not found');
    await expect(manager.previewEnhancement(RYUK, 'turbo', 'medium')).rejects.toThrow('Unknown mode "turbo"');
    await expect(manager.previewEnhancement(RYUK, 'enhanced', 'godlike')).rejects.toThrow('Unknown level "godlike"');
  });
});

describe('executeEnhancedChain (simulation, the default)', () => {
  it('writes no logs and reports the real estimate', async () => {
    const manager = newManager();
    const chain = manager.getTemplate(RYUK)!.chain;

    const execution = await manager.executeEnhancedChain(RYUK, { mode: 'dynamic', aiLevel: 'advanced' });

    expect(execution.executionMode).toBe('simulation');
    expect(execution.logsGenerated).toBe(0);
    expect(execution.variationSpread).toBe(0.5);
    expect(execution.estimatedLogs).toBe(chain.steps.reduce((total, step) => total + calculateStepLogCount(step), 0));
  });

  it('returns quickly, without the configured delay', async () => {
    const start = Date.now();
    await newManager().executeEnhancedChain(RYUK, {});
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('executeEnhancedChain (full execution)', () => {
  it('runs a chain whose steps are varied for the level, keeping the MITRE mapping', async () => {
    const run = jest.spyOn(AttackChainManager.prototype, 'executeChainDefinition')
      .mockResolvedValue({ chainId: 'ryuk-ransomware-campaign', executionId: 'e1', status: 'completed', completedSteps: [], failedSteps: [], totalSteps: 0, stats: { logsGenerated: 42, stepsCompleted: 11, stepsFailed: 0, averageStepDuration: 0 } } as unknown as AttackChainExecution);
    try {
      const manager = newManager();
      const chain = manager.getTemplate(RYUK)!.chain;
      const execution = await manager.executeEnhancedChain(RYUK, { simulation: false, aiLevel: 'high', config: './c.yaml' });

      const passedChain = run.mock.calls[0][0];
      expect(run.mock.calls[0][2]).toBe('./c.yaml');
      expect(passedChain.steps.map(s => s.mitre)).toEqual(chain.steps.map(s => s.mitre));
      expect(passedChain.steps.some((s, i) => s.timing.duration !== chain.steps[i].timing.duration)).toBe(true);
      expect(execution.executionMode).toBe('full');
      expect(execution.logsGenerated).toBe(42);
    } finally {
      run.mockRestore();
    }
  });
});

describe('execution history (persisted)', () => {
  it('is empty when nothing has run', () => {
    expect(newManager().getExecutionHistory().statistics).toEqual({ totalExecutions: 0, modeDistribution: {}, levelDistribution: {} });
  });

  it('records runs and survives a new manager instance (a new process)', async () => {
    await newManager().executeEnhancedChain(RYUK, { mode: 'enhanced', aiLevel: 'high' });
    await newManager().executeEnhancedChain(RYUK, { mode: 'dynamic', aiLevel: 'high' });

    const history = newManager().getExecutionHistory(50);
    expect(history.statistics).toEqual({ totalExecutions: 2, modeDistribution: { enhanced: 1, dynamic: 1 }, levelDistribution: { high: 2 } });
    expect(history.executions[0].mode).toBe('dynamic'); // most recent first
  });
});

describe('executeTrainingSession', () => {
  it('runs the requested count with progressive levels and the requested delay', async () => {
    const start = Date.now();
    const executions = await newManager().executeTrainingSession(RYUK, { variationCount: 4, delayBetweenVariations: 0 });

    expect(executions.map(e => e.aiLevel)).toEqual(['basic', 'medium', 'high', 'advanced']);
    expect(executions.every(e => e.executionMode === 'simulation')).toBe(true);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('cycles the level when progressive is off', async () => {
    const executions = await newManager().executeTrainingSession(RYUK, { variationCount: 5, delayBetweenVariations: 0, progressive: false });

    expect(executions.map(e => e.aiLevel)).toEqual(['basic', 'medium', 'high', 'advanced', 'basic']);
  });
});

describe('getEnhancementOptions', () => {
  it('lists modes, levels and spreads without invented features', () => {
    const options = new EnhancedAttackChainManager().getEnhancementOptions(RYUK);

    expect(options.modes).toEqual(['static', 'enhanced', 'dynamic']);
    expect(options.levels.map(l => l.variationSpread)).toEqual([0.1, 0.2, 0.35, 0.5]);
    expect(JSON.stringify(options)).not.toMatch(/evasion|anti-forensics|real-time adaptation/i);
  });
});
