/**
 * TimestampSequencer ensures unique timestamps across all log generators
 * to prevent race conditions and duplicate timestamps in log entries.
 * 
 * Features:
 * - Unique within one thread (each worker thread has its own sequencer)
 * - Six fractional digits: up to 1,000 unique timestamps per millisecond
 * - Stays on the clock at high rates (no drift below 1M logs/s)
 * - Monotonic timestamp guarantee
 */

export class TimestampSequencer {
  private static instance: TimestampSequencer;
  private counter: number = 0;
  private lastTimestamp: number = 0;
  private subMillisecond: number = 0;

  private constructor() {}

  public static getInstance(): TimestampSequencer {
    if (!TimestampSequencer.instance) {
      TimestampSequencer.instance = new TimestampSequencer();
    }
    return TimestampSequencer.instance;
  }

  /**
   * Generates a unique, increasing timestamp with six fractional digits.
   * Logs in the same millisecond take the next of the 1,000 sub-millisecond slots; the
   * millisecond only moves ahead of the clock after all 1,000 are used (above 1M logs/s).
   */
  public getUniqueTimestamp(): string {
    const now = Date.now();

    if (now > this.lastTimestamp) {
      this.lastTimestamp = now;
      this.subMillisecond = 0;
    } else if (++this.subMillisecond >= 1000) {
      // Same millisecond (or the clock stepped back): stay unique and increasing
      this.lastTimestamp++;
      this.subMillisecond = 0;
    }

    this.counter++;

    // 2026-01-01T00:00:00.123Z -> 2026-01-01T00:00:00.123004Z
    const baseIsoString = new Date(this.lastTimestamp).toISOString();
    return baseIsoString.slice(0, -1) + String(this.subMillisecond).padStart(3, '0') + 'Z';
  }

  /**
   * Reset the sequencer (mainly for testing purposes)
   */
  public reset(): void {
    this.counter = 0;
    this.lastTimestamp = 0;
    this.subMillisecond = 0;
  }

  /**
   * Get current counter info (for debugging)
   */
  public getCounterInfo(): { counter: number; lastTimestamp: number } {
    return {
      counter: this.counter,
      lastTimestamp: this.lastTimestamp
    };
  }
}

// Export singleton instance for convenience
export const timestampSequencer = TimestampSequencer.getInstance();
