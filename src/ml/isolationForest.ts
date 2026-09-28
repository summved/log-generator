/**
 * Isolation Forest
 * Unsupervised outlier detection (Liu, Ting & Zhou, 2008). Points that are isolated by
 * few random splits are unusual. Scores are in (0, 1]: near 1 is an outlier, below 0.5 is normal.
 */

export interface IsolationForestOptions {
  /** Number of trees (default 100) */
  trees?: number;
  /** Points sampled per tree (default 256, capped at the data size) */
  sampleSize?: number;
  /** Seed for reproducible results (default 42) */
  seed?: number;
}

type TreeNode =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: TreeNode; right: TreeNode };

const EULER_GAMMA = 0.5772156649;

/** Average path length of an unsuccessful search in a binary search tree of n points */
function averagePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
}

/** Small seeded pseudo-random generator (mulberry32) */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class IsolationForest {
  private readonly treeCount: number;
  private readonly requestedSampleSize: number;
  private readonly random: () => number;
  private trees: TreeNode[] = [];
  private sampleSize = 0;

  constructor(options: IsolationForestOptions = {}) {
    this.treeCount = options.trees ?? 100;
    this.requestedSampleSize = options.sampleSize ?? 256;
    this.random = seededRandom(options.seed ?? 42);
  }

  fit(data: number[][]): this {
    if (data.length < 2) {
      throw new Error('Need at least 2 points to fit an isolation forest');
    }
    this.sampleSize = Math.min(this.requestedSampleSize, data.length);
    const maxDepth = Math.ceil(Math.log2(this.sampleSize));
    this.trees = Array.from({ length: this.treeCount }, () => this.buildTree(this.sample(data), 0, maxDepth));
    return this;
  }

  /** Outlier score in (0, 1]; higher means more unusual */
  score(point: number[]): number {
    if (this.trees.length === 0) {
      throw new Error('fit() must be called before score()');
    }
    const meanPath = this.trees.reduce((sum, tree) => sum + this.pathLength(point, tree, 0), 0) / this.trees.length;
    return Math.pow(2, -meanPath / averagePathLength(this.sampleSize));
  }

  private sample(data: number[][]): number[][] {
    const indices = data.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, this.sampleSize).map(i => data[i]);
  }

  private buildTree(points: number[][], depth: number, maxDepth: number): TreeNode {
    if (depth >= maxDepth || points.length <= 1) {
      return { leaf: true, size: points.length };
    }

    // Only features that vary in this subset can split it
    const dimensions = points[0].length;
    const candidates: Array<{ feature: number; min: number; max: number }> = [];
    for (let feature = 0; feature < dimensions; feature++) {
      let min = Infinity;
      let max = -Infinity;
      for (const point of points) {
        min = Math.min(min, point[feature]);
        max = Math.max(max, point[feature]);
      }
      if (max > min) candidates.push({ feature, min, max });
    }
    if (candidates.length === 0) {
      return { leaf: true, size: points.length };
    }

    const { feature, min, max } = candidates[Math.floor(this.random() * candidates.length)];
    const split = min + this.random() * (max - min);
    return {
      leaf: false,
      feature,
      split,
      left: this.buildTree(points.filter(point => point[feature] < split), depth + 1, maxDepth),
      right: this.buildTree(points.filter(point => point[feature] >= split), depth + 1, maxDepth)
    };
  }

  private pathLength(point: number[], node: TreeNode, depth: number): number {
    if (node.leaf) {
      return depth + averagePathLength(node.size);
    }
    return this.pathLength(point, point[node.feature] < node.split ? node.left : node.right, depth + 1);
  }
}
