import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { AttackChainExecution } from '../types/attackChain';
import { AttackChainEngine } from './AttackChainEngine';
import { AttackChainManager } from './AttackChainManager';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('AttackChainManager template lookup', () => {
  const manager = new AttackChainManager();

  it.each([
    ['apt29-cozy-bear-campaign', 'apt29-cozy-bear-campaign'],
    ['apt29-cozy-bear', 'apt29-cozy-bear-campaign'],
    ['ransomware-ryuk', 'ryuk-ransomware-campaign'],
    ['insider-threat', 'malicious-insider-data-theft'],
    ['insider-threat-data-theft', 'malicious-insider-data-theft']
  ])('resolves %s to chain %s', (name, chainId) => {
    expect(manager.getTemplate(name)?.chain.id).toBe(chainId);
  });

  it('returns undefined for an unknown chain', () => {
    expect(manager.getTemplate('no-such-chain')).toBeUndefined();
  });

  it('executes the resolved chain when called with an alias', async () => {
    const run = jest.spyOn(AttackChainEngine.prototype, 'executeChain')
      .mockImplementation(async chain => ({ chainId: chain.id } as AttackChainExecution));
    try {
      const execution = await manager.executeChain('insider-threat');

      expect(execution.chainId).toBe('malicious-insider-data-theft');
    } finally {
      run.mockRestore();
    }
  });

  it('rejects execution of an unknown chain', async () => {
    await expect(manager.executeChain('no-such-chain')).rejects.toThrow('Attack chain template not found: no-such-chain');
  });

  it('keeps the first template when two templates claim the same alias', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chain-templates-'));
    try {
      const source = readFileSync(path.join(__dirname, 'templates', 'apt29-cozy-bear.yaml'), 'utf8');
      writeFileSync(path.join(dir, 'a.yaml'), source);
      writeFileSync(path.join(dir, 'b.yaml'), source.replace(/APT29 Cozy Bear Campaign/g, 'APT29 Copy'));

      const conflicted = new AttackChainManager(dir);

      expect(conflicted.getTemplate('apt29-copy')).toBeDefined();
      expect(conflicted.getTemplate('apt29-cozy-bear')?.chain.id).toBe('apt29-cozy-bear-campaign');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
