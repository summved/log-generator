import { tmpdir } from 'os';
import * as path from 'path';
import { PythonMLBridge } from './PythonMLBridge';

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
