import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { Config, LogEntry } from '../types';
import { OutputManager } from './outputManager';
import { StorageManager } from './storage';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const log = (i: number): LogEntry => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString(),
  level: 'INFO',
  source: { type: 'endpoint', name: 'test' },
  message: `log ${i}`,
  metadata: {}
});

async function lines(dir: string): Promise<string[]> {
  const all: string[] = [];
  for (const file of (await fs.readdir(dir)).sort()) {
    all.push(...(await fs.readFile(path.join(dir, file), 'utf8')).split('\n').filter(Boolean));
  }
  return all;
}

describe('OutputManager with file output', () => {
  let dir: string;

  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'output-test-')); });
  afterEach(async () => { await fs.remove(dir); });

  it('after close(), every log is in the output file and in the history copy, in order', async () => {
    const config = {
      format: 'json',
      destination: 'file',
      batching: { enabled: true, maxBatchSize: 100, flushIntervalMs: 50 },
      file: { path: path.join(dir, 'out', 'logs.json'), rotation: false, maxSize: '100MB', maxFiles: 1 }
    } as Config['output'];
    const history = path.join(dir, 'history');
    const output = new OutputManager(config, new StorageManager(history, path.join(dir, 'historical'), 1));

    // Like the generators: logs are handed over without waiting for each one
    for (let i = 0; i < 1000; i++) void output.outputLog(log(i));
    await output.close();

    const expected = Array.from({ length: 1000 }, (_, i) => `log ${i}`);
    expect((await lines(path.join(dir, 'out'))).map(line => JSON.parse(line).message)).toEqual(expected);
    expect((await lines(history)).map(line => JSON.parse(line).message)).toEqual(expected);
  });
});
