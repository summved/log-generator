import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const TS_NODE = path.join(ROOT, 'node_modules', '.bin', 'ts-node');

function run(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise(resolve => {
    execFile(TS_NODE, ['--transpile-only', path.join(__dirname, 'cli.ts'), ...args], {
      cwd: ROOT,
      env: { ...process.env, ENABLE_MONITORING: 'false' },
      maxBuffer: 20 * 1024 * 1024
    }, (error, stdout, stderr) => resolve({ stdout, stderr, code: error ? Number(error.code) || 1 : 0 }));
  });
}

describe('log-generator CLI', () => {
  it('with destination stdout, writes only generated logs to stdout (its own log lines go to stderr)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-stdout-'));
    const config = path.join(dir, 'config.yaml');
    const defaults = fs.readFileSync(path.join(__dirname, 'config', 'default.yaml'), 'utf8')
      .replace('destination: file', 'destination: stdout')
      .replace(/currentPath: .*/, `currentPath: ${path.join(dir, 'current')}`)
      .replace(/historicalPath: .*/, `historicalPath: ${path.join(dir, 'historical')}`)
      .replace(/frequency: \d+/g, 'frequency: 600');
    fs.writeFileSync(config, defaults);

    const { stdout, stderr, code } = await run(['generate', '-c', config, '--duration', '2s']);

    expect(code).toBe(0);
    const lines = stdout.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(stderr).toContain('Starting log generator');
  }, 90000);
});
