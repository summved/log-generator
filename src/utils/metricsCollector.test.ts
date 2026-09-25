import { spawnSync } from 'child_process';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

describe('MetricsCollector', () => {
  it('does not keep the process alive once other work is done', () => {
    // A process that only creates the collector must exit on its own
    const result = spawnSync(
      process.execPath,
      [
        '-r', 'ts-node/register/transpile-only',
        '-e', "require('./src/utils/metricsCollector').MetricsCollector.getInstance()"
      ],
      { cwd: repoRoot, timeout: 8000, encoding: 'utf8' }
    );

    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
  }, 15000);
});
