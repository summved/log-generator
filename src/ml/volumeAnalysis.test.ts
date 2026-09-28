import { bucketByWindow, chooseSeasonLength, detectVolumeAnomalies, forecastAuto, forecastSeasonal, forecastVolume, rareValues, VolumeBucket } from './volumeAnalysis';

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

describe('chooseSeasonLength', () => {
  const HOUR = 3600000;

  it('uses a daily cycle when there are at least two days of windows', () => {
    expect(chooseSeasonLength(HOUR, 48)).toBe(24);
    expect(chooseSeasonLength(15 * MINUTE, 200)).toBe(96);
  });

  it('uses a weekly cycle for day-sized windows with two weeks of history', () => {
    expect(chooseSeasonLength(24 * HOUR, 14)).toBe(7);
  });

  it('returns null when there is not enough history for two cycles', () => {
    expect(chooseSeasonLength(HOUR, 30)).toBeNull();
    expect(chooseSeasonLength(7 * MINUTE, 1000)).toBeNull();
  });
});

describe('forecastSeasonal', () => {
  const HOUR = 3600000;
  // Five days of hourly counts following a daily cycle: busy afternoons, quiet nights
  const daily = (hour: number) => Math.round(100 + 80 * Math.sin(((hour - 6) / 24) * 2 * Math.PI));
  const history = Array.from({ length: 24 * 5 }, (_, i) => ({ start: T0 + i * HOUR, count: daily(i % 24) + (i % 3) }));

  it('follows the daily cycle in its forecast', () => {
    const result = forecastSeasonal(history, 24, HOUR, 24);
    const expected = Array.from({ length: 24 }, (_, h) => daily(h));
    const error = result.forecast.reduce((sum, point, h) => sum + Math.abs(point.count - expected[h]), 0) / 24;

    expect(result.seasonLength).toBe(24);
    expect(error).toBeLessThan(10);
    expect(result.forecast[0].start).toBe(T0 + 24 * 5 * HOUR);
    expect(result.meanAbsoluteError).toBeGreaterThanOrEqual(0);
  });

  it('beats a straight trend line on seasonal data', () => {
    const seasonal = forecastSeasonal(history, 24, HOUR, 24);
    const linear = forecastVolume(history, 24, HOUR);
    const expected = Array.from({ length: 24 }, (_, h) => daily(h));
    const err = (points: VolumeBucket[]) => points.reduce((s, p, h) => s + Math.abs(p.count - expected[h]), 0);

    expect(err(seasonal.forecast)).toBeLessThan(err(linear.forecast) / 3);
  });

  it('needs two full cycles of history', () => {
    expect(() => forecastSeasonal(history.slice(0, 30), 5, HOUR, 24)).toThrow('At least 48 time windows are needed');
  });
});

describe('forecastAuto', () => {
  const HOUR = 3600000;
  const daily = (hour: number) => Math.round(100 + 80 * Math.sin(((hour - 6) / 24) * 2 * Math.PI));

  it('uses the seasonal model when it fits the history better', () => {
    const history = Array.from({ length: 24 * 5 }, (_, i) => ({ start: T0 + i * HOUR, count: daily(i % 24) }));

    const result = forecastAuto(history, 6, HOUR);

    expect(result.method).toBe('holt-winters');
    expect(result.meanAbsoluteError).toBeLessThan(result.alternativeError!);
  });

  it('falls back to the linear trend when that fits better, e.g. rare bursts', () => {
    const history = Array.from({ length: 24 * 5 }, (_, i) => ({ start: T0 + i * HOUR, count: [7, 50, 90].includes(i) ? 2000 : 0 }));

    const result = forecastAuto(history, 6, HOUR);

    expect(result.method).toBe('linear');
    expect(result.meanAbsoluteError).toBeLessThanOrEqual(result.alternativeError!);
  });

  it('uses the linear trend when there is not enough history for a cycle', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({ start: T0 + i * HOUR, count: i }));

    expect(forecastAuto(history, 2, HOUR)).toEqual(expect.objectContaining({ method: 'linear', alternativeError: undefined }));
  });
});
