import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { toTemplate } from './logTemplates';
import { buildProfile, generateFromProfile, loadProfile, regenerateMessage, saveProfile } from './logProfile';

function sampleLogs() {
  const logs = [];
  for (let i = 0; i < 90; i++) {
    logs.push({ message: `Failed login for admin from 10.0.${i % 5}.${i}`, level: i % 10 === 0 ? 'ERROR' : 'WARN', source: { type: 'authentication', name: 'auth-service' }, timestamp: `2026-01-05T${String(9 + (i % 3)).padStart(2, '0')}:00:00.000Z` });
  }
  for (let i = 0; i < 9; i++) {
    logs.push({ message: `Request took ${100 + i}ms status 200`, level: 'INFO', source: { type: 'webserver', name: 'nginx' }, timestamp: '2026-01-05T14:30:00.000Z' });
  }
  logs.push({ message: 'Password policy changed by root', level: 'CRITICAL', source: { type: 'authentication', name: 'auth-service' }, timestamp: '2026-01-05T03:00:00.000Z' });
  return logs;
}

describe('buildProfile', () => {
  it('learns sources, levels, hourly shares and message patterns', () => {
    const profile = buildProfile(sampleLogs(), { files: ['a.jsonl'] });
    const auth = profile.sources['auth-service'];

    expect(profile.totalLogs).toBe(100);
    expect(Object.keys(profile.sources).sort()).toEqual(['auth-service', 'nginx']);
    expect(auth).toEqual(expect.objectContaining({ type: 'authentication', count: 91 }));
    expect(auth.levels).toEqual({ WARN: 81, ERROR: 9, CRITICAL: 1 });
    expect(auth.templates[0]).toEqual(expect.objectContaining({ template: 'Failed login for admin from <IP>', count: 90 }));
    expect(auth.hourly.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(auth.hourly[9]).toBeCloseTo(30 / 91);
    expect(profile.timeRange).toEqual({ start: '2026-01-05T03:00:00.000Z', end: '2026-01-05T14:30:00.000Z' });
  });

  it('keeps at most maxTemplatesPerSource patterns per source', () => {
    const profile = buildProfile(sampleLogs(), { maxTemplatesPerSource: 1 });

    expect(profile.sources['auth-service'].templates).toHaveLength(1);
  });

  it('only uses logs within maxHistoryDays of the newest log', () => {
    const logs = [...sampleLogs(), { message: 'Old event 1', level: 'INFO', source: { type: 'server', name: 'old' }, timestamp: '2025-06-01T00:00:00.000Z' }];

    const profile = buildProfile(logs, { maxHistoryDays: 30 });

    expect(profile.sources.old).toBeUndefined();
    expect(profile.totalLogs).toBe(100);
  });
});

describe('saveProfile / loadProfile', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'profile-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('round-trips a profile through a file', async () => {
    const file = path.join(dir, 'nested', 'profile.json');
    const profile = buildProfile(sampleLogs());

    await saveProfile(profile, file);

    expect(await loadProfile(file)).toEqual(profile);
  });

  it('rejects files that are not a learned profile', async () => {
    const file = path.join(dir, 'other.json');
    writeFileSync(file, '{"hello":1}');

    await expect(loadProfile(file)).rejects.toThrow('Not a learned profile');
  });
});

describe('regenerateMessage', () => {
  it('keeps the message pattern but changes its variable parts', () => {
    const example = 'Failed login for admin from 10.0.3.44 after 3 attempts in 1.5s';
    const random = () => 0.37;

    const fresh = regenerateMessage(example, random);

    expect(toTemplate(fresh)).toBe(toTemplate(example));
    expect(fresh).not.toBe(example);
  });
});

describe('learned numbers', () => {
  it('reuses observed values for number positions with few distinct values, and stays in range otherwise', () => {
    const logs = Array.from({ length: 60 }, (_, i) => ({
      message: `HTTP GET /api/items - ${[200, 404, 502][i % 3]} ${100 + i}ms`,
      level: 'INFO',
      source: { type: 'webserver', name: 'api' },
      timestamp: '2026-01-05T10:00:00.000Z'
    }));
    const profile = buildProfile(logs);

    const generated = generateFromProfile(profile, 'api', { count: 100, seed: 4, now: new Date('2026-02-01T00:00:00.000Z') });

    for (const log of generated) {
      const [, status, ms] = log.message.match(/- (\d+) (\d+)ms$/)!;
      expect(['200', '404', '502']).toContain(status);
      expect(Number(ms)).toBeGreaterThanOrEqual(100);
      expect(Number(ms)).toBeLessThanOrEqual(159);
    }
  });
});

describe('generateFromProfile', () => {
  const profile = buildProfile(sampleLogs());
  const now = new Date('2026-02-01T00:00:00.000Z');

  it('generates logs for a source from its learned patterns, levels and hours', () => {
    const logs = generateFromProfile(profile, 'auth-service', { count: 200, seed: 1, now });
    const patterns = new Set(profile.sources['auth-service'].templates.map(t => t.template));

    expect(logs).toHaveLength(200);
    expect(logs.every(log => log.source.name === 'auth-service' && log.source.type === 'authentication')).toBe(true);
    expect(logs.every(log => patterns.has(toTemplate(log.message)))).toBe(true);
    expect(logs.filter(log => log.level === 'WARN').length).toBeGreaterThan(140);
    expect(logs.every(log => log.timestamp.startsWith('2026-02-01T'))).toBe(true);
    expect(logs.filter(log => /T(09|10|11):/.test(log.timestamp)).length).toBeGreaterThan(180);
  });

  it('accepts a source type as well as a name', () => {
    expect(generateFromProfile(profile, 'webserver', { count: 3, seed: 1, now })[0].source.name).toBe('nginx');
  });

  it('marks anomalies drawn from rare patterns and levels', () => {
    const none = generateFromProfile(profile, 'auth-service', { count: 50, seed: 2, now, anomalyRate: 0 });
    const all = generateFromProfile(profile, 'auth-service', { count: 50, seed: 2, now, anomalyRate: 1 });

    expect(none.some(log => log.metadata.is_anomaly)).toBe(false);
    expect(all.every(log => log.metadata.is_anomaly === true)).toBe(true);
    expect(all.every(log => log.level === 'CRITICAL' || log.level === 'ERROR' || log.message.startsWith('Password policy'))).toBe(true);
  });

  it('sets user and system ids when given, and is deterministic for a seed', () => {
    const a = generateFromProfile(profile, 'nginx', { count: 5, seed: 9, now, userId: 'u-1', systemId: 'web-01' });
    const b = generateFromProfile(profile, 'nginx', { count: 5, seed: 9, now, userId: 'u-1', systemId: 'web-01' });

    expect(a).toEqual(b);
    expect(a[0].metadata).toEqual(expect.objectContaining({ userId: 'u-1', systemId: 'web-01' }));
  });

  it('rejects an unknown source and lists the learned ones', () => {
    expect(() => generateFromProfile(profile, 'mainframe', { count: 1, now })).toThrow('No learned patterns for source "mainframe". Learned sources: auth-service, nginx');
  });
});
