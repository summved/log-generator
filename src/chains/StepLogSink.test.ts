import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { LogEntry } from '../types';
import { StorageLogSink } from './StepLogSink';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

function makeEntry(message: string): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    source: { type: 'endpoint', name: 'endpoint' },
    message,
    metadata: {}
  };
}

describe('StorageLogSink', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'chain-sink-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes entries as JSONL to a per-execution file and returns its path', async () => {
    const sink = new StorageLogSink(dir);

    const filePath = await sink.write('exec-1', [makeEntry('a'), makeEntry('b')]);

    expect(filePath).toBe(path.join(dir, 'attack-chain-exec-1.jsonl'));
    const lines = readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines.map(line => JSON.parse(line).message)).toEqual(['a', 'b']);
  });

  it('appends across writes for the same execution', async () => {
    const sink = new StorageLogSink(dir);

    await sink.write('exec-1', [makeEntry('a')]);
    const filePath = await sink.write('exec-1', [makeEntry('b'), makeEntry('c')]);

    expect(readFileSync(filePath, 'utf8').trim().split('\n')).toHaveLength(3);
  });

  it('keeps storage directories inside the output directory', () => {
    new StorageLogSink(dir);

    expect(existsSync(path.join(dir, 'historical'))).toBe(true);
  });
});

describe('OutputManagerLogSink', () => {
  let dir: string;

  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'chain-om-sink-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  function writeConfig(): string {
    const config = [
      'output:',
      '  format: json',
      '  destination: file',
      `  file:`,
      `    path: ${path.join(dir, 'out', 'chain.json')}`,
      'storage:',
      `  currentPath: ${path.join(dir, 'current')}`,
      `  historicalPath: ${path.join(dir, 'historical')}`,
      '  retention: 1',
      '  history: false'
    ].join('\n');
    const file = path.join(dir, 'config.yaml');
    require('fs').writeFileSync(file, config);
    return file;
  }

  it('sends entries to the config-defined destination and flushes on close', async () => {
    const { OutputManagerLogSink } = require('./StepLogSink');
    const sink = new OutputManagerLogSink(writeConfig());

    const where = await sink.write('exec-1', [makeEntry('a'), makeEntry('b')]);
    await sink.close();

    expect(where).toBe('file output');
    const lines = readFileSync(path.join(dir, 'out', 'chain.json'), 'utf8').trim().split('\n');
    expect(lines.map(line => JSON.parse(line).message)).toEqual(['a', 'b']);
  });
})
