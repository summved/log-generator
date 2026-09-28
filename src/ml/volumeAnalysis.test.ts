import { bucketByWindow, detectVolumeAnomalies, forecastVolume, rareValues } from './volumeAnalysis';

const MINUTE = 60000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

function logsAt(minuteCounts: number[]): Array<{ message: string; timestamp: string }> {
  return minuteCounts.flatMap((count, minute) =>
    Array.from({ length: count }, (_, i) => ({
      message: `m${minute}-${i}`,
      timestamp: new Date(T0 + minute * MINUTE + i * 10).toISOString()
    }))
  );
}

describe('bucketByWindow', () => {
  it('counts logs per window, including empty windows in between', () => {
    const buckets = bucketByWindow(logsAt([2, 0, 3]), MINUTE);

    expect(buckets).toEqual([
      { start: T0, count: 2 },
      { start: T0 + MINUTE, count: 0 },
      { start: T0 + 2 * MINUTE, count: 3 }
    ]);
  });

  it('ignores logs without a valid timestamp and accepts microsecond timestamps', () => {
    const buckets = bucketByWindow([
      { message: 'a', timestamp: '2026-01-01T00:00:05.000123Z' },
      { message: 'b' },
      { message: 'c', timestamp: 'not a date' }
    ], MINUTE);

    expect(buckets).toEqual([{ start: T0, count: 1 }]);
  });

  it('rejects a non-positive window', () => {
    expect(() => bucketByWindow([], 0)).toThrow('Window must be greater than zero');
  });
});

describe('detectVolumeAnomalies', () => {
  it('flags windows far from the mean as spikes or drops', () => {
    const counts = [10, 11, 9, 10, 12, 10, 60, 10, 9, 11, 10, 0];
    const buckets = counts.map((count, i) => ({ start: T0 + i * MINUTE, count }));

    const result = detectVolumeAnomalies(buckets, 2);

    expect(result.anomalies.map(a => [a.count, a.direction])).toEqual([[60, 'spike']]);
    expect(result.anomalies[0].zScore).toBeGreaterThan(2);
    expect(result.mean).toBeCloseTo(counts.reduce((a, b) => a + b, 0) / counts.length);
  });

  it('reports no anomalies when every window has the same count', () => {
    const buckets = [5, 5, 5].map((count, i) => ({ start: T0 + i * MINUTE, count }));

    expect(detectVolumeAnomalies(buckets, 2)).toEqual(expect.objectContaining({ stdDev: 0, anomalies: [] }));
  });
});

describe('rareValues', () => {
  it('lists values whose share of logs is below the limit, rarest first', () => {
    const logs = [
      ...Array.from({ length: 97 }, () => ({ message: 'x', level: 'INFO', source: { name: 'web' } })),
      { message: 'y', level: 'ERROR', source: { name: 'db' } },
      { message: 'y', level: 'ERROR', source: { name: 'db' } },
      { message: 'z', level: 'CRITICAL', source: { name: 'db' } }
    ];

    expect(rareValues(logs, 'level', 0.05)).toEqual([
      { value: 'CRITICAL', count: 1, share: 0.01 },
      { value: 'ERROR', count: 2, share: 0.02 }
    ]);
    expect(rareValues(logs, 'source', 0.05)).toEqual([{ value: 'db', count: 3, share: 0.03 }]);
  });
});

describe('forecastVolume', () => {
  it('projects the next windows from a linear trend and reports the fit', () => {
    const buckets = [10, 12, 14, 16].map((count, i) => ({ start: T0 + i * MINUTE, count }));

    const result = forecastVolume(buckets, 2, MINUTE);

    expect(result.slopePerWindow).toBeCloseTo(2);
    expect(result.rSquared).toBeCloseTo(1);
    expect(result.forecast).toEqual([
      { start: T0 + 4 * MINUTE, count: 18 },
      { start: T0 + 5 * MINUTE, count: 20 }
    ]);
  });

  it('never forecasts a negative count', () => {
    const buckets = [6, 4, 2].map((count, i) => ({ start: T0 + i * MINUTE, count }));

    expect(forecastVolume(buckets, 3, MINUTE).forecast.map(f => f.count)).toEqual([0, 0, 0]);
  });

  it('needs at least two windows', () => {
    expect(() => forecastVolume([{ start: T0, count: 3 }], 1, MINUTE)).toThrow('At least 2 time windows are needed');
  });
});
