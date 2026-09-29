import { Backpressure } from './backpressure';

describe('Backpressure', () => {
  it('pauses once the limit of logs in flight is reached, and resumes when half have finished', async () => {
    const events: string[] = [];
    const pressure = new Backpressure(4, () => events.push('pause'), () => events.push('resume'));
    const finish: (() => void)[] = [];
    const task = () => pressure.track(new Promise<void>(resolve => finish.push(resolve)));

    task(); task(); task();
    expect(events).toEqual([]);
    task();
    expect(events).toEqual(['pause']);
    expect(pressure.inFlight).toBe(4);

    finish.shift()!();
    await Promise.resolve(); await Promise.resolve();
    expect(events).toEqual(['pause']);

    finish.shift()!();
    await Promise.resolve(); await Promise.resolve();
    expect(events).toEqual(['pause', 'resume']);
    expect(pressure.inFlight).toBe(2);
  });

  it('counts failed work as finished too', async () => {
    const events: string[] = [];
    const pressure = new Backpressure(2, () => events.push('pause'), () => events.push('resume'));

    await Promise.allSettled([
      pressure.track(Promise.reject(new Error('write failed'))),
      pressure.track(Promise.reject(new Error('write failed')))
    ]);

    expect(pressure.inFlight).toBe(0);
    expect(events).toEqual(['pause', 'resume']);
  });

  it('can count a whole batch as one unit of weight', async () => {
    const events: string[] = [];
    const pressure = new Backpressure(1000, () => events.push('pause'), () => events.push('resume'));

    const batch = pressure.track(Promise.resolve(), 1500);
    expect(events).toEqual(['pause']);
    await batch;

    expect(events).toEqual(['pause', 'resume']);
  });

  it('rejects a limit below 1', () => {
    expect(() => new Backpressure(0, () => undefined, () => undefined)).toThrow(/limit/);
  });
});
