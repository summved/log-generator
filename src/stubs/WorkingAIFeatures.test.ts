import { calculateStepLogCount } from '../chains/StepLogFactory';
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
