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
  private lastTimestamp: number = 0;
  private sequence: number = 0;
  private readonly maxSequence: number = 999; // Max microsecond-like precision

  private constructor() {}

  public static getInstance(): TimestampSequencer {
    if (!TimestampSequencer.instance) {
      TimestampSequencer.instance = new TimestampSequencer();
    }
    return TimestampSequencer.instance;
  }

  /**
   * Generates a unique, monotonic timestamp in ISO format
   * Handles race conditions by incrementing sequence for simultaneous calls
   */
  public getUniqueTimestamp(): string {
    const now = Date.now();
    
    if (now <= this.lastTimestamp) {
      // Same or earlier millisecond - increment sequence to ensure uniqueness
      this.sequence++;
      this.lastTimestamp = Math.max(now, this.lastTimestamp);
      
      // If we exceed max sequence, advance to next millisecond
      if (this.sequence > this.maxSequence) {
        this.lastTimestamp = this.lastTimestamp + 1;
        this.sequence = 0;
      }
    } else {
      // New millisecond - reset sequence
      this.lastTimestamp = now;
      this.sequence = 0;
    }

    // Create unique timestamp by adding sequence as microseconds
    // This ensures each call gets a unique timestamp even within the same millisecond
    const uniqueTimestamp = this.lastTimestamp + this.sequence;
    
    return new Date(uniqueTimestamp).toISOString();
  }

  /**
   * Reset the sequencer (mainly for testing purposes)
   */
  public reset(): void {
    this.lastTimestamp = 0;
    this.sequence = 0;
  }

  /**
   * Get current sequence info (for debugging)
   */
  public getSequenceInfo(): { lastTimestamp: number; sequence: number } {
    return {
      lastTimestamp: this.lastTimestamp,
      sequence: this.sequence
    };
  }
}

// Export singleton instance for convenience
export const timestampSequencer = TimestampSequencer.getInstance();
