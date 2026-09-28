import { detectLogOutliers, LOG_FEATURES } from './logOutliers';

function normalLogs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    message: `User u${i % 20} viewed page ${i}`,
    level: 'INFO',
    source: { name: 'web' },
    timestamp: new Date(Date.UTC(2026, 0, 5, 10 + (i % 6), i % 60)).toISOString(),
    metadata: { user: `u${i % 20}` }
  }));
}

const odd = {
  message: 'CRITICAL kernel panic: failed to mount root filesystem after error, unable to continue boot sequence on node',
  level: 'CRITICAL',
  source: { name: 'kernel' },
  timestamp: '2026-01-10T03:17:00.000Z',
  metadata: { a: 1, b: 2, c: 3, d: 4, e: 5, ip: '10.1.1.1' }
};

describe('detectLogOutliers', () => {
  it('ranks the unusual log first and explains which features stand out', () => {
    const logs = [...normalLogs(300), odd];

    const result = detectLogOutliers(logs, { top: 3, seed: 1 });

    expect(result.outliers[0].message).toBe(odd.message);
    expect(result.outliers[0].score).toBeGreaterThan(0.6);
    expect(result.outliers[0].reasons.length).toBeGreaterThan(0);
    expect(result.outliers[0].reasons.map(r => r.feature)).toEqual(expect.arrayContaining(['levelRank', 'sourceRarity']));
    expect(result.outliers[0].reasons.length).toBeLessThanOrEqual(3);
    expect(result.analyzed).toBe(301);
  });

  it('is deterministic for a given seed', () => {
    const logs = [...normalLogs(120), odd];

    expect(detectLogOutliers(logs, { seed: 5 })).toEqual(detectLogOutliers(logs, { seed: 5 }));
  });

  it('describes every feature it uses', () => {
    expect(LOG_FEATURES.map(f => f.name)).toEqual(expect.arrayContaining(['hour', 'levelRank', 'templateRarity', 'sourceRarity']));
  });

  it('needs enough logs to learn what is normal', () => {
    expect(() => detectLogOutliers(normalLogs(5))).toThrow('Need at least 20 logs');
  });
});
