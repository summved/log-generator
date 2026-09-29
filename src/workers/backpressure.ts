/**
 * Flow control for generation: counts logs whose output is still in flight, calls `pause` when
 * `limit` is reached and `resume` once they are down to half. Keeps memory bounded at full speed.
 */
export class Backpressure {
  private count = 0;
  private paused = false;

  constructor(private readonly limit: number, private readonly pause: () => void, private readonly resume: () => void) {
    if (!(limit >= 1)) throw new Error(`Backpressure limit must be at least 1 (got ${limit})`);
  }

  /** Count `weight` logs as in flight until `work` settles (fulfilled or rejected) */
  public track<T>(work: Promise<T>, weight: number = 1): Promise<T> {
    this.count += weight;
    if (!this.paused && this.count >= this.limit) {
      this.paused = true;
      this.pause();
    }
    const done = () => {
      this.count -= weight;
      if (this.paused && this.count <= this.limit / 2) {
        this.paused = false;
        this.resume();
      }
    };
    work.then(done, done);
    return work;
  }

  public get inFlight(): number {
    return this.count;
  }
}
