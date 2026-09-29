/**
 * TimestampValidator provides utilities to detect and fix timestamp issues
 * in log data, particularly for historical replay files.
 */

import { LogEntry } from '../types';
import { logger } from './logger';
import moment from 'moment';


/** ISO 8601 timestamp (3 or 6 fractional digits) -> microseconds since the epoch */
function toMicros(timestamp: string): number {
  const match = timestamp.match(/\.(\d+)Z?$/);
  const fraction = match ? match[1].padEnd(6, '0').slice(0, 6) : '000000';
  const ms = Date.parse(timestamp);
  return (Number.isNaN(ms) ? 0 : Math.floor(ms / 1000) * 1000000) + Number(fraction);
}

/** Microseconds since the epoch -> ISO 8601 with six fractional digits */
function fromMicros(micros: number): string {
  const wholeMs = Math.floor(micros / 1000);
  const microTail = String(micros % 1000000).padStart(6, '0');
  return new Date(wholeMs).toISOString().replace(/\.\d+Z$/, `.${microTail}Z`);
}

export class TimestampValidator {
  
  /**
   * Validates timestamps in a log array and reports issues
   */
  public static validateTimestamps(logs: LogEntry[]): {
    isValid: boolean;
    duplicateCount: number;
    invalidCount: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;
    const seenTimestamps = new Set<string>();

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const timestamp = log.timestamp;

      // Check if timestamp is valid
      if (!timestamp || !moment(timestamp).isValid()) {
        invalidCount++;
        issues.push(`Log ${i + 1}: Invalid timestamp "${timestamp}"`);
        continue;
      }

      // Check for duplicates
      if (seenTimestamps.has(timestamp)) {
        duplicateCount++;
        issues.push(`Log ${i + 1}: Duplicate timestamp "${timestamp}"`);
      } else {
        seenTimestamps.add(timestamp);
      }

      // Check chronological order (optional warning)
      if (i > 0) {
        const prevTimestamp = logs[i - 1].timestamp;
        if (moment(timestamp).isBefore(moment(prevTimestamp))) {
          issues.push(`Log ${i + 1}: Timestamp "${timestamp}" is before previous timestamp "${prevTimestamp}" (non-chronological)`);
        }
      }
    }

    const isValid = duplicateCount === 0 && invalidCount === 0;
    
    return {
      isValid,
      duplicateCount,
      invalidCount,
      issues
    };
  }

  /**
   * Fixes duplicate timestamps by adding microsecond increments
   */
  public static fixDuplicateTimestamps(logs: LogEntry[]): {
    fixedLogs: LogEntry[];
    fixedCount: number;
  } {
    if (logs.length === 0) {
      return { fixedLogs: [], fixedCount: 0 };
    }

    const fixedLogs: LogEntry[] = [];
    let fixedCount = 0;
    let lastMicros = -1;

    for (const log of logs) {
      const originalTimestamp = log.timestamp;
      let micros = toMicros(originalTimestamp);

      // Keep timestamps strictly increasing; bump by one microsecond when they would repeat or go back
      if (micros <= lastMicros) {
        micros = lastMicros + 1;
      }
      lastMicros = micros;

      const newTimestamp = fromMicros(micros);
      const changed = newTimestamp !== originalTimestamp;
      if (changed) {
        fixedCount++;
        logger.debug(`Fixed timestamp: ${originalTimestamp} -> ${newTimestamp}`);
      }

      fixedLogs.push({
        ...log,
        timestamp: newTimestamp,
        metadata: {
          ...log.metadata,
          ...(changed && { originalTimestamp, timestampFixed: true })
        }
      });
    }

    return { fixedLogs, fixedCount };
  }

  /**
   * Analyzes timestamp distribution and patterns
   */
  public static analyzeTimestampPatterns(logs: LogEntry[]): {
    totalLogs: number;
    timeSpan: string;
    averageInterval: number;
    duplicateGroups: Array<{ timestamp: string; count: number }>;
  } {
    if (logs.length === 0) {
      return {
        totalLogs: 0,
        timeSpan: '0ms',
        averageInterval: 0,
        duplicateGroups: []
      };
    }

    const timestamps = logs.map(log => moment(log.timestamp)).sort();
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const timeSpan = moment.duration(lastTimestamp.diff(firstTimestamp)).humanize();
    
    const totalInterval = lastTimestamp.diff(firstTimestamp);
    const averageInterval = logs.length > 1 ? totalInterval / (logs.length - 1) : 0;

    // Find duplicate groups
    const timestampCounts = new Map<string, number>();
    logs.forEach(log => {
      const count = timestampCounts.get(log.timestamp) || 0;
      timestampCounts.set(log.timestamp, count + 1);
    });

    const duplicateGroups = Array.from(timestampCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalLogs: logs.length,
      timeSpan,
      averageInterval,
      duplicateGroups
    };
  }
}

export const timestampValidator = {
  validateTimestamps: TimestampValidator.validateTimestamps,
  fixDuplicateTimestamps: TimestampValidator.fixDuplicateTimestamps,
  analyzeTimestampPatterns: TimestampValidator.analyzeTimestampPatterns
};
