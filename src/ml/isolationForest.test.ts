import { IsolationForest } from './isolationForest';

function cluster(count: number, seed: number): number[][] {
  let state = seed;
  const next = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: count }, () => [10 + next(), 20 + next(), 5 + next()]);
}

describe('IsolationForest', () => {
  const data = [...cluster(300, 7), [30, 2, 40]];

  it('scores an obvious outlier far above points in the cluster', () => {
    const forest = new IsolationForest({ seed: 1 }).fit(data);
    const scores = data.map(point => forest.score(point));
    const outlier = scores[scores.length - 1];
    const inliers = scores.slice(0, -1);

    expect(outlier).toBeGreaterThan(0.65);
    expect(Math.max(...inliers)).toBeLessThan(outlier);
    expect(inliers.reduce((a, b) => a + b, 0) / inliers.length).toBeLessThan(0.5);
  });

  it('is deterministic for a given seed', () => {
    const a = new IsolationForest({ seed: 3 }).fit(data);
    const b = new IsolationForest({ seed: 3 }).fit(data);

    expect(data.map(p => a.score(p))).toEqual(data.map(p => b.score(p)));
  });

  it('handles features that never vary', () => {
    const constant = Array.from({ length: 50 }, (_, i) => [1, i % 5]);
    const forest = new IsolationForest({ seed: 1 }).fit(constant);

    expect(Number.isFinite(forest.score([1, 2]))).toBe(true);
  });

  it('must be fitted before scoring, on at least two points', () => {
    expect(() => new IsolationForest().score([1])).toThrow('fit() must be called before score()');
    expect(() => new IsolationForest().fit([[1]])).toThrow('Need at least 2 points');
  });
});
