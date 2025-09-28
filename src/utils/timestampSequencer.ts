/**
 * TimestampSequencer ensures unique timestamps across all log generators
 * to prevent race conditions and duplicate timestamps in log entries.
 * 
 * Features:
 * - Thread-safe timestamp generation
 * - Microsecond precision simulation
 * - Automatic sequence increment for simultaneous calls
 * - Monotonic timestamp guarantee
 */

export class TimestampSequencer {
  private static instance: TimestampSequencer;
  private counter: number = 0;
  private lastTimestamp: number = 0;

  private constructor() {}

  public static getInstance(): TimestampSequencer {
    if (!TimestampSequencer.instance) {
      TimestampSequencer.instance = new TimestampSequencer();
    }
    return TimestampSequencer.instance;
  }

  /**
   * Generates a unique timestamp - GUARANTEED uniqueness
   * Uses monotonic incrementing timestamp to ensure no duplicates
   */
  public getUniqueTimestamp(): string {
    const now = Date.now();
    
    // Ensure monotonic timestamps - always increment
    if (now <= this.lastTimestamp) {
      this.lastTimestamp = this.lastTimestamp + 1;
    } else {
      this.lastTimestamp = now;
    }
    
    this.counter++;
    
    // Create unique timestamp with microsecond precision
    const baseIsoString = new Date(this.lastTimestamp).toISOString();
    const microseconds = String(this.counter % 1000).padStart(3, '0');
    
    // Insert microseconds: 2025-09-19T08:20:00.123Z -> 2025-09-19T08:20:00.123456Z
    const result = baseIsoString.slice(0, -1) + microseconds + 'Z';
    
    return result;
  }

  /**
   * Reset the sequencer (mainly for testing purposes)
   */
  public reset(): void {
    this.counter = 0;
    this.lastTimestamp = 0;
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
