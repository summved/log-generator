import { ConfigManager } from '../config';
import { LogEntry } from '../types';
import { matchesMitreFilter, producibleMitre, unreachableFilterWarning } from './mitreFilter';

const log = (mitre?: { technique: string; tactic: string }): LogEntry => ({
  timestamp: '2026-01-01T00:00:00.000000Z',
  level: 'WARN',
  source: { type: 'authentication', name: 'auth-service' },
  message: 'x',
  metadata: {},
  ...(mitre ? { mitre: { ...mitre, description: '' } } : {})
});

describe('matchesMitreFilter', () => {
  const bruteForce = log({ technique: 'T1110', tactic: 'TA0006' });
  const guessing = log({ technique: 'T1110.001', tactic: 'TA0006' });
  const firewall = log({ technique: 'T1562.004', tactic: 'TA0005' });
  const plain = log();

  it('keeps everything when there is no filter', () => {
    expect([bruteForce, plain].every(entry => matchesMitreFilter(entry, undefined))).toBe(true);
  });

  it('keeps only logs with the technique, never logs without MITRE data', () => {
    const filter = { technique: 'T1110.001' };

    expect(matchesMitreFilter(guessing, filter)).toBe(true);
    expect(matchesMitreFilter(bruteForce, filter)).toBe(false);
    expect(matchesMitreFilter(plain, filter)).toBe(false);
  });

  it('matches sub-techniques when filtering on the parent technique', () => {
    const filter = { technique: 'T1110' };

    expect(matchesMitreFilter(bruteForce, filter)).toBe(true);
    expect(matchesMitreFilter(guessing, filter)).toBe(true);
    expect(matchesMitreFilter(log({ technique: 'T11100', tactic: 'TA0006' }), filter)).toBe(false);
    expect(matchesMitreFilter(firewall, filter)).toBe(false);
  });

  it('keeps only logs with the tactic, never logs without MITRE data', () => {
    const filter = { tactic: 'TA0005' };

    expect(matchesMitreFilter(firewall, filter)).toBe(true);
    expect(matchesMitreFilter(bruteForce, filter)).toBe(false);
    expect(matchesMitreFilter(plain, filter)).toBe(false);
  });

  it('requires both when technique and tactic are given', () => {
    expect(matchesMitreFilter(bruteForce, { technique: 'T1110', tactic: 'TA0006' })).toBe(true);
    expect(matchesMitreFilter(bruteForce, { technique: 'T1110', tactic: 'TA0005' })).toBe(false);
  });

  it('keeps any log with MITRE data for enabledOnly', () => {
    expect(matchesMitreFilter(firewall, { enabledOnly: true })).toBe(true);
    expect(matchesMitreFilter(plain, { enabledOnly: true })).toBe(false);
  });
});

describe('producibleMitre', () => {
  const generators = new ConfigManager().getConfig().generators;

  it('lists the techniques and tactics that the enabled templates and the auto-mapper can produce', () => {
    const { techniques, tactics } = producibleMitre(generators);

    expect(techniques.has('T1110.001')).toBe(true);
    expect(techniques.has('T1046')).toBe(true);
    expect(tactics.has('TA0006')).toBe(true);
    expect(techniques.has('T1021')).toBe(false);
  });

  it('ignores disabled generators', () => {
    const onlyFirewall = Object.fromEntries(Object.entries(generators).map(([name, config]) => [name, { ...config, enabled: name === 'firewall' }]));
    const { techniques } = producibleMitre(onlyFirewall as typeof generators);

    expect(techniques.has('T1046')).toBe(true);
    expect(techniques.has('T1110.001')).toBe(true); // the auto-mapper can still produce it
  });
});

describe('unreachableFilterWarning', () => {
  const generators = new ConfigManager().getConfig().generators;

  it('warns when nothing can produce the technique', () => {
    expect(unreachableFilterWarning(generators, { technique: 'T1021' })).toMatch(/No enabled template produces T1021/);
  });

  it('stays quiet for techniques that can be produced, including a parent of a sub-technique', () => {
    expect(unreachableFilterWarning(generators, { technique: 'T1110.001' })).toBeUndefined();
    expect(unreachableFilterWarning(generators, { technique: 'T1562' })).toBeUndefined();
    expect(unreachableFilterWarning(generators, { tactic: 'TA0006' })).toBeUndefined();
  });
});
