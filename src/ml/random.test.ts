import { seededRandom, weightedPick } from './random';

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed, within [0, 1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const values = Array.from({ length: 100 }, () => a());

    expect(Array.from({ length: 100 }, () => b())).toEqual(values);
    expect(values.every(v => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBe(100);
  });
});

describe('weightedPick', () => {
  it('picks keys in proportion to their weights', () => {
    const random = seededRandom(1);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[weightedPick({ a: 3, b: 1 }, random)]++;

    expect(counts.a / 4000).toBeCloseTo(0.75, 1);
  });
});
