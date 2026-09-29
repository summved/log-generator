import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';
import { LogGeneratorManager } from './LogGeneratorManager';

jest.mock('./utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

async function lineCount(dir: string): Promise<number> {
  let total = 0;
  for (const file of await fs.readdir(dir)) {
    total += (await fs.readFile(path.join(dir, file), 'utf8')).split('\n').filter(Boolean).length;
  }
  return total;
}

describe('LogGeneratorManager', () => {
  let dir: string;
  let configPath: string;

  beforeAll(() => { process.env.ENABLE_MONITORING = 'false'; });

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'manager-test-'));
    const config = yaml.parse(await fs.readFile(path.join(__dirname, 'config', 'default.yaml'), 'utf8'));
    for (const generator of Object.values(config.generators) as { enabled: boolean; frequency: number }[]) {
      generator.enabled = true;
      generator.frequency = 30000;
    }
    config.output.destination = 'file';
    config.output.file.path = path.join(dir, 'out', 'logs.json');
    config.storage.currentPath = path.join(dir, 'current');
    config.storage.historicalPath = path.join(dir, 'historical');
    configPath = path.join(dir, 'config.yaml');
    await fs.writeFile(configPath, yaml.stringify(config));
  });
  afterEach(async () => { await fs.remove(dir); });

  async function runFor(manager: LogGeneratorManager, ms: number): Promise<void> {
    await manager.start();
    await new Promise(resolve => setTimeout(resolve, ms));
    await manager.stop();
  }

  it('generates in worker threads when high-performance mode is enabled', async () => {
    const manager = new LogGeneratorManager(configPath);
    manager.enableHighPerformanceMode(2);

    await manager.start();
    const running = manager.getPerformanceStats();
    await new Promise(resolve => setTimeout(resolve, 800));
    await manager.stop();

    expect(running.workerThreads).toBe(2);
    expect(running.runningGenerators).toHaveLength(12);
    expect(manager.getPerformanceStats().workerThreads).toBe(0);
    const written = await lineCount(path.join(dir, 'out'));
    expect(written).toBeGreaterThan(0);
    expect(await lineCount(path.join(dir, 'current'))).toBe(written);
  }, 60000);

  it('still generates on the main thread by default', async () => {
    const manager = new LogGeneratorManager(configPath);

    await manager.start();
    const running = manager.getPerformanceStats();
    await new Promise(resolve => setTimeout(resolve, 500));
    await manager.stop();

    expect(running.workerThreads).toBe(0);
    expect(running.runningGenerators).toHaveLength(12);
    expect(await lineCount(path.join(dir, 'out'))).toBeGreaterThan(0);
  }, 60000);

  it('refuses to change the worker count while running', async () => {
    const manager = new LogGeneratorManager(configPath);
    await manager.start();

    expect(() => manager.enableHighPerformanceMode(4)).toThrow(/Stop the log generator/);
    await manager.stop();
  }, 60000);

  it('writes only logs with the filtered technique (and its sub-techniques), never unmapped logs', async () => {
    const manager = new LogGeneratorManager(configPath, { technique: 'T1110' });

    await runFor(manager, 1500);

    const lines = (await fs.readFile(path.join(dir, 'out', 'logs.json'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(log => log.mitre && (log.mitre.technique === 'T1110' || log.mitre.technique.startsWith('T1110.')))).toBe(true);
  }, 60000);

  it('applies MITRE filters to logs from worker threads', async () => {
    const manager = new LogGeneratorManager(configPath, { enabledOnly: true });
    manager.enableHighPerformanceMode(2);

    await runFor(manager, 800);

    const lines = (await fs.readFile(path.join(dir, 'out', 'logs.json'), 'utf8')).split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(line => JSON.parse(line).mitre)).toBe(true);
  }, 60000);

  it('SOC mode writes SOC-platform logs for the chosen scenario', async () => {
    const manager = new LogGeneratorManager(configPath, undefined, { scenario: 'incident-response', analysts: 2, intensity: 'high' });

    await manager.start();
    const running = manager.getPerformanceStats();
    await new Promise(resolve => setTimeout(resolve, 800));
    await manager.stop();

    expect(running.runningGenerators).toEqual(['soc']);
    const logs = (await fs.readFile(path.join(dir, 'out', 'logs.json'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(log => log.source.name === 'soc-platform')).toBe(true);
    expect(logs.some(log => log.d3fend)).toBe(true);
    const analysts = new Set(logs.map(log => log.metadata.analyst).filter(Boolean));
    expect(analysts.size).toBeLessThanOrEqual(2);
  }, 60000);
});
