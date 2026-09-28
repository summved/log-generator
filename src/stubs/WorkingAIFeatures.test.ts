import { AttackChainManager } from '../chains/AttackChainManager';
import { calculateStepLogCount } from '../chains/StepLogFactory';
import { AttackChainExecution } from '../types/attackChain';
import { EnhancedAttackChainManager } from './WorkingAIFeatures';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('EnhancedAttackChainManager.previewEnhancement', () => {
  const manager = new EnhancedAttackChainManager();
  const chain = manager.getTemplate('ransomware-ryuk')!.chain;

  it('describes the real chain with estimates derived from its template', async () => {
    const preview = await manager.previewEnhancement('ransomware-ryuk', 'enhanced', 'medium');

    expect(preview.chain).toEqual(expect.objectContaining({
      id: 'ryuk-ransomware-campaign',
      name: 'Ryuk Ransomware Campaign',
      stepCount: chain.steps.length
    }));
    expect(preview.techniques).toEqual(chain.steps.map(step => step.mitre.technique));
    expect(preview.estimatedLogs).toBe(chain.steps.reduce((total, step) => total + calculateStepLogCount(step), 0));
    expect(preview.estimatedDurationMs).toBe(
      chain.steps.reduce((total, step) => total + step.timing.delayAfterPrevious + step.timing.duration, 0)
    );
  });

  it('is deterministic for the same inputs', async () => {
    const first = await manager.previewEnhancement('ransomware-ryuk', 'dynamic', 'high');
    const second = await manager.previewEnhancement('ransomware-ryuk', 'dynamic', 'high');

    expect(second).toEqual(first);
  });

  it('plans more changes for higher modes and levels', async () => {
    const basic = await manager.previewEnhancement('ransomware-ryuk', 'static', 'basic');
    const advanced = await manager.previewEnhancement('ransomware-ryuk', 'dynamic', 'advanced');

    expect(basic.plannedChanges.length).toBeGreaterThan(0);
    expect(advanced.plannedChanges.length).toBeGreaterThan(basic.plannedChanges.length);
    for (const change of advanced.plannedChanges) {
      expect(change).toEqual({ type: expect.any(String), description: expect.any(String) });
    }
  });

  it('rejects unknown chains, modes and levels', async () => {
    await expect(manager.previewEnhancement('no-such-chain', 'enhanced', 'medium')).rejects.toThrow('Attack chain template not found');
    await expect(manager.previewEnhancement('ransomware-ryuk', 'turbo', 'medium')).rejects.toThrow('Unknown enhancement mode "turbo"');
    await expect(manager.previewEnhancement('ransomware-ryuk', 'enhanced', 'godlike')).rejects.toThrow('Unknown AI level "godlike"');
  });
});

describe('EnhancedAttackChainManager.getExecutionHistory', () => {
  it('reports no executions when none have run', () => {
    const history = new EnhancedAttackChainManager().getExecutionHistory(50);

    expect(history.executions).toEqual([]);
    expect(history.statistics).toEqual({ totalExecutions: 0, modeDistribution: {}, levelDistribution: {} });
  });

  it('records the executions this manager actually ran', async () => {
    const manager = new EnhancedAttackChainManager();

    await manager.executeEnhancedChain('ransomware-ryuk', { mode: 'enhanced', aiLevel: 'high' });
    const history = manager.getExecutionHistory(50);

    expect(history.executions).toHaveLength(1);
    expect(history.executions[0]).toEqual(expect.objectContaining({
      chainId: 'ryuk-ransomware-campaign', mode: 'enhanced', aiLevel: 'high', executionMode: 'simulation'
    }));
    expect(history.statistics).toEqual({
      totalExecutions: 1, modeDistribution: { enhanced: 1 }, levelDistribution: { high: 1 }
    });
  }, 15000);
});

describe('EnhancedAttackChainManager full execution', () => {
  it('passes the config file as the log generator config, not as execution settings', async () => {
    const run = jest.spyOn(AttackChainManager.prototype, 'executeChain')
      .mockResolvedValue({ chainId: 'ryuk-ransomware-campaign', executionId: 'e1', status: 'completed', stats: {} } as unknown as AttackChainExecution);
    try {
      await new EnhancedAttackChainManager().executeEnhancedChain('ransomware-ryuk', { simulation: false, config: './my-config.yaml' });

      expect(run).toHaveBeenCalledWith('ransomware-ryuk', undefined, './my-config.yaml');
    } finally {
      run.mockRestore();
    }
  });
});

describe('EnhancedAttackChainManager simulation', () => {
  const manager = new EnhancedAttackChainManager();
  const chain = manager.getTemplate('ransomware-ryuk')!.chain;

  it('reports no logs written, with the real estimate from the template', async () => {
    const execution = await manager.executeEnhancedChain('ransomware-ryuk', { mode: 'enhanced', aiLevel: 'high' });

    expect(execution.executionMode).toBe('simulation');
    expect(execution.stats.logsGenerated).toBe(0);
    expect(execution.stats.estimatedLogs).toBe(chain.steps.reduce((total, step) => total + calculateStepLogCount(step), 0));
    expect(execution.chainId).toBe('ryuk-ransomware-campaign');
  });

  it('lists the planned changes from the preview instead of invented impact scores', async () => {
    const execution = await manager.executeEnhancedChain('ransomware-ryuk', { mode: 'dynamic', aiLevel: 'advanced' });
    const preview = await manager.previewEnhancement('ransomware-ryuk', 'dynamic', 'advanced');

    expect(execution.aiEnhancements).toEqual(preview.plannedChanges);
    expect(execution.stats.detectionEvasion).toBeUndefined();
    expect(JSON.stringify(execution)).not.toMatch(/Reduced detection|Improved stealth|Reduced SIEM/);
  });

  it('returns without an artificial delay', async () => {
    const start = Date.now();
    await manager.executeEnhancedChain('ransomware-ryuk', { mode: 'static', aiLevel: 'basic' });

    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('EnhancedAttackChainManager training session', () => {
  it('runs the requested number of variations with the requested delay', async () => {
    const start = Date.now();
    const executions = await new EnhancedAttackChainManager().executeTrainingSession('ransomware-ryuk', { variationCount: 2, delayBetweenVariations: 0 });

    expect(executions).toHaveLength(2);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
