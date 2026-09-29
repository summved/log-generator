import { timestampSequencer } from './timestampSequencer';

const NOW = Date.parse('2026-01-01T00:00:00.000Z');
const FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function leadMs(timestamp: string, nowMs: number): number {
  return Date.parse(timestamp) - nowMs;
}

describe('timestampSequencer.getUniqueTimestamp', () => {
  let clock: jest.SpyInstance<number, []>;

  beforeEach(() => {
    timestampSequencer.reset();
    clock = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => clock.mockRestore());

  it('uses ISO 8601 with six fractional digits', () => {
    const timestamp = timestampSequencer.getUniqueTimestamp();

    expect(timestamp).toMatch(FORMAT);
    expect(timestamp.startsWith('2026-01-01T00:00:00.000')).toBe(true);
  });

  it('gives unique, increasing timestamps to many logs in the same millisecond', () => {
    const timestamps = Array.from({ length: 5000 }, () => timestampSequencer.getUniqueTimestamp());

    expect(new Set(timestamps).size).toBe(5000);
    expect([...timestamps].sort()).toEqual(timestamps);
  });

  it('stays within a few milliseconds of the clock at high rates', () => {
    // 5,000 logs in one millisecond is 5 million logs per second
    let last = '';
    for (let i = 0; i < 5000; i++) last = timestampSequencer.getUniqueTimestamp();

    expect(leadMs(last, NOW)).toBeLessThanOrEqual(5);
  });

  it('keeps up with a steady 100,000 logs per second without drifting ahead', () => {
    let last = '';
    for (let ms = 0; ms < 1000; ms++) {
      clock.mockReturnValue(NOW + ms);
      for (let i = 0; i < 100; i++) last = timestampSequencer.getUniqueTimestamp();
    }

    expect(leadMs(last, NOW + 999)).toBe(0);
  });

  it('follows the clock when time moves on', () => {
    timestampSequencer.getUniqueTimestamp();
    timestampSequencer.getUniqueTimestamp();
    clock.mockReturnValue(NOW + 250);

    expect(timestampSequencer.getUniqueTimestamp()).toBe('2026-01-01T00:00:00.250000Z');
  });

  it('never goes backwards or repeats when the system clock steps back', () => {
    const before = timestampSequencer.getUniqueTimestamp();
    clock.mockReturnValue(NOW - 60000);
    const after = timestampSequencer.getUniqueTimestamp();

    expect(after > before).toBe(true);
  });
});
