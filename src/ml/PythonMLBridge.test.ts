import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { PythonMLBridge } from './PythonMLBridge';
import { PatternLearningEngine } from './PatternLearningEngine';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

describe('PythonMLBridge without a Python environment', () => {
  const missing = path.join(tmpdir(), 'no-such-ml-env');

  it('can be created, and reports that Python is unavailable', () => {
    const bridge = new PythonMLBridge({ virtualEnvPath: missing });

    expect(bridge.isAvailable()).toBe(false);
  });

  it('fails with a clear message only when a Python feature is used', async () => {
    const bridge = new PythonMLBridge({ virtualEnvPath: missing });

    await expect(bridge.learnPatterns(['x.jsonl'])).rejects.toThrow(`Python virtual environment not found at: ${path.join(missing, 'bin', 'python3')}`);
  });
});

describe('PatternLearningEngine without a Python environment', () => {
  const originalCwd = process.cwd();
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'engine-cwd-'));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('can be created on a fresh clone with no ml-env folder', () => {
    expect(() => new PatternLearningEngine()).not.toThrow();
  });
});
