import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { LogEntry } from '../types';
import { StorageManager } from './storage';

// appendFile passes through to the real one, so tests can count calls or make one fail
jest.mock('fs-extra', () => {
  const actual = jest.requireActual('fs-extra');
  return { ...actual, appendFile: jest.fn((...args: unknown[]) => actual.appendFile(...args)) };
});
const appendFile = fs.appendFile as unknown as jest.Mock;

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

async function storedMessages(dir: string): Promise<string[]> {
  const messages: string[] = [];
  for (const file of (await fs.readdir(dir)).sort()) {
    const content = await fs.readFile(path.join(dir, file), 'utf8');
    content.split('\n').filter(Boolean).forEach(line => messages.push(JSON.parse(line).message));
  }
  return messages;
}

describe('StorageManager.storeLog (history copy)', () => {
  let dir: string;
  let storage: StorageManager;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    storage = new StorageManager(path.join(dir, 'current'), path.join(dir, 'historical'), 1);
  });
  afterEach(async () => {
    appendFile.mockClear();
    await fs.remove(dir);
  });

  it('keeps every log, in order, when many are handed over at once', async () => {
    await Promise.all(Array.from({ length: 2000 }, (_, i) => storage.storeLog(log(i))));

    expect(await storedMessages(path.join(dir, 'current'))).toEqual(Array.from({ length: 2000 }, (_, i) => `log ${i}`));
  });

  it('writes logs handed over together with one append instead of one per log', async () => {
    appendFile.mockClear();

    await Promise.all(Array.from({ length: 500 }, (_, i) => storage.storeLog(log(i))));

    expect(appendFile).toHaveBeenCalledTimes(1);
  });

  it('resolves only after the log is on disk, with the file it went to', async () => {
    const file = await storage.storeLog(log(1));

    expect(path.dirname(file)).toBe(path.join(dir, 'current'));
    expect(await fs.readFile(file, 'utf8')).toContain('"message":"log 1"');
  });

  it('keeps order across separate batches', async () => {
    await Promise.all([storage.storeLog(log(1)), storage.storeLog(log(2))]);
    await storage.storeLog(log(3));
    await Promise.all([storage.storeLog(log(4)), storage.storeLog(log(5))]);

    expect(await storedMessages(path.join(dir, 'current'))).toEqual(['log 1', 'log 2', 'log 3', 'log 4', 'log 5']);
  });

  it('rejects every log in a batch when the write fails, and keeps working afterwards', async () => {
    appendFile.mockImplementationOnce(() => Promise.reject(new Error('disk full')));

    const results = await Promise.allSettled([storage.storeLog(log(1)), storage.storeLog(log(2))]);

    expect(results.map(r => r.status)).toEqual(['rejected', 'rejected']);
    expect((results[0] as PromiseRejectedResult).reason.message).toBe('disk full');
    await storage.storeLog(log(3));
    expect(await storedMessages(path.join(dir, 'current'))).toEqual(['log 3']);
  });

  it('flush() waits for logs that were handed over but not yet written', async () => {
    const pending = storage.storeLog(log(7));
    await storage.flush();

    expect(await storedMessages(path.join(dir, 'current'))).toEqual(['log 7']);
    await pending;
  });

  it('still writes straight to a named file with storeLogs', async () => {
    const file = await storage.storeLogs([log(1), log(2)], 'named.jsonl');

    expect(path.basename(file)).toBe('named.jsonl');
    expect(await storedMessages(path.join(dir, 'current'))).toEqual(['log 1', 'log 2']);
  });
});
