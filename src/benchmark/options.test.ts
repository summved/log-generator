import { parseBenchmarkOptions } from './options';

describe('parseBenchmarkOptions', () => {
  it('uses 3s per measurement, all phases and JSON workers by default', () => {
    expect(parseBenchmarkOptions({})).toEqual({
      durationMs: 3000,
      phases: ['generators', 'formats', 'outputs', 'workers'],
      workerCounts: undefined,
      workerFormat: 'json',
      configPath: undefined
    });
  });

  it('reads durations in ms, s and m', () => {
    expect(parseBenchmarkOptions({ duration: '500ms' }).durationMs).toBe(500);
    expect(parseBenchmarkOptions({ duration: '10s' }).durationMs).toBe(10000);
    expect(parseBenchmarkOptions({ duration: '2m' }).durationMs).toBe(120000);
  });

  it('reads comma-separated phases and worker counts', () => {
    const options = parseBenchmarkOptions({ phases: 'workers, formats', workers: '1,2, 8', format: 'cef', config: 'my.yaml' });

    expect(options.phases).toEqual(['workers', 'formats']);
    expect(options.workerCounts).toEqual([1, 2, 8]);
    expect(options.workerFormat).toBe('cef');
    expect(options.configPath).toBe('my.yaml');
  });

  it.each([
    [{ duration: 'soon' }, /Invalid duration "soon"/],
    [{ duration: '0s' }, /Invalid duration "0s"/],
    [{ duration: '11m' }, /at most 10m/],
    [{ phases: 'generators,speed' }, /Unknown phase "speed"/],
    [{ workers: '1,0' }, /Invalid worker count "0"/],
    [{ workers: '1,999' }, /Invalid worker count "999"/],
    [{ workers: 'two' }, /Invalid worker count "two"/],
    [{ format: 'xml' }, /Unknown format "xml"/]
  ])('rejects %p', (raw, message) => {
    expect(() => parseBenchmarkOptions(raw)).toThrow(message);
  });
});
