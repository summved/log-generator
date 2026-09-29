/**
 * TimestampSequencer ensures unique timestamps across all log generators
 * to prevent race conditions and duplicate timestamps in log entries.
 * 
 * Features:
 * - Unique across worker threads when each calls useSlots(index, count)
 * - Six fractional digits: up to 1,000 unique timestamps per millisecond
 * - Stays on the clock at high rates (no drift below 1M logs/s)
 * - Monotonic timestamp guarantee
 */

export class TimestampSequencer {
  private static instance: TimestampSequencer;
  private counter: number = 0;
  private lastTimestamp: number = 0;
  private subMillisecond: number = 0;
  private slotOffset: number = 0;
  private slotStride: number = 1;

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
      this.subMillisecond = this.slotOffset;
    } else if ((this.subMillisecond += this.slotStride) >= 1000) {
      // Same millisecond (or the clock stepped back): stay unique and increasing
      this.lastTimestamp++;
      this.subMillisecond = this.slotOffset;
    }

    this.counter++;

    // 2026-01-01T00:00:00.123Z -> 2026-01-01T00:00:00.123004Z
    const baseIsoString = new Date(this.lastTimestamp).toISOString();
    return baseIsoString.slice(0, -1) + String(this.subMillisecond).padStart(3, '0') + 'Z';
  }

  /**
   * Use every `stride`-th sub-millisecond slot starting at `offset`. Worker thread i of n calls
   * useSlots(i, n), so timestamps from different threads never collide.
   */
  public useSlots(offset: number, stride: number): void {
    if (!Number.isInteger(offset) || !Number.isInteger(stride) || stride < 1 || stride > 1000 || offset < 0 || offset >= stride) {
      throw new Error(`Invalid timestamp slots: offset ${offset}, stride ${stride}`);
    }
    this.slotOffset = offset;
    this.slotStride = stride;
    this.subMillisecond = offset;
  }

  /**
   * Reset the sequencer (mainly for testing purposes)
   */
  public reset(): void {
    this.counter = 0;
    this.lastTimestamp = 0;
    this.subMillisecond = this.slotOffset;
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
