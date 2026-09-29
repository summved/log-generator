import { LogEntry } from '../types';
import { TimestampValidator } from './timestampValidator';

jest.mock('./logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const log = (timestamp: string): LogEntry => ({
  timestamp,
  level: 'INFO',
  source: { type: 'endpoint', name: 'test' },
  message: 'x',
  metadata: {}
});

const SIX_DIGITS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

describe('TimestampValidator.fixDuplicateTimestamps', () => {
  it('makes duplicates unique while keeping six fractional digits', () => {
    const { fixedLogs, fixedCount } = TimestampValidator.fixDuplicateTimestamps(
      ['2026-01-01T00:00:00.000000Z', '2026-01-01T00:00:00.000000Z', '2026-01-01T00:00:00.000000Z'].map(log)
    );

    expect(fixedCount).toBe(2);
    expect(fixedLogs.map(l => l.timestamp)).toEqual([
      '2026-01-01T00:00:00.000000Z', '2026-01-01T00:00:00.000001Z', '2026-01-01T00:00:00.000002Z'
    ]);
    expect(fixedLogs.every(l => SIX_DIGITS.test(l.timestamp))).toBe(true);
  });

  it('keeps every timestamp unique and in order', () => {
    const timestamps = Array.from({ length: 5000 }, () => '2026-01-01T00:00:00.000000Z');
    const { fixedLogs } = TimestampValidator.fixDuplicateTimestamps(timestamps.map(log));

    const out = fixedLogs.map(l => l.timestamp);
    expect(new Set(out).size).toBe(5000);
    expect([...out].sort()).toEqual(out);
  });

  it('does not collide a fixed timestamp with a real later one', () => {
    const { fixedLogs } = TimestampValidator.fixDuplicateTimestamps([
      log('2026-01-01T00:00:00.000000Z'),
      log('2026-01-01T00:00:00.000000Z'),
      log('2026-01-01T00:00:00.000001Z')
    ]);

    const out = fixedLogs.map(l => l.timestamp);
    expect(new Set(out).size).toBe(3);
    expect([...out].sort()).toEqual(out);
  });

  it('marks fixed logs in metadata and leaves untouched logs alone', () => {
    const { fixedLogs } = TimestampValidator.fixDuplicateTimestamps([
      log('2026-01-01T00:00:00.000000Z'),
      log('2026-01-01T00:00:00.000000Z')
    ]);

    expect(fixedLogs[0].metadata.timestampFixed).toBeUndefined();
    expect(fixedLogs[1].metadata).toMatchObject({ timestampFixed: true, originalTimestamp: '2026-01-01T00:00:00.000000Z' });
  });

  it('handles 3-digit input timestamps too', () => {
    const { fixedLogs } = TimestampValidator.fixDuplicateTimestamps([log('2026-01-01T00:00:00.000Z'), log('2026-01-01T00:00:00.000Z')]);

    expect(fixedLogs.every(l => SIX_DIGITS.test(l.timestamp))).toBe(true);
    expect(new Set(fixedLogs.map(l => l.timestamp)).size).toBe(2);
  });
});
