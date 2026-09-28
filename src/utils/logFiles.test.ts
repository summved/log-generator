import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { parseLogLines, readLogFiles } from './logFiles';

describe('parseLogLines', () => {
  it('parses JSON lines and counts lines that are not log entries', () => {
    const text = [
      JSON.stringify({ message: 'one', metadata: {} }),
      '',
      'not json',
      JSON.stringify({ unrelated: true }),
      JSON.stringify({ message: 'two', level: 'WARN' })
    ].join('\n');

    const { logs, skipped } = parseLogLines(text);

    expect(logs.map(l => l.message)).toEqual(['one', 'two']);
    expect(logs[1].level).toBe('WARN');
    expect(skipped).toBe(2);
  });
});

describe('readLogFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'log-files-'));
    mkdirSync(path.join(dir, 'folder'));
    writeFileSync(path.join(dir, 'folder', 'b.jsonl'), `${JSON.stringify({ message: 'b' })}\n`);
    writeFileSync(path.join(dir, 'folder', 'a.json'), `${JSON.stringify({ message: 'a' })}\nbad\n`);
    writeFileSync(path.join(dir, 'folder', 'notes.txt'), 'ignored');
    writeFileSync(path.join(dir, 'single.jsonl'), `${JSON.stringify({ message: 'c' })}\n`);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads files and .jsonl/.json files inside directories, in order', async () => {
    const result = await readLogFiles([path.join(dir, 'folder'), path.join(dir, 'single.jsonl')]);

    expect(result.files).toEqual([
      path.join(dir, 'folder', 'a.json'),
      path.join(dir, 'folder', 'b.jsonl'),
      path.join(dir, 'single.jsonl')
    ]);
    expect(result.logs.map(l => l.message)).toEqual(['a', 'b', 'c']);
    expect(result.skipped).toBe(1);
  });

  it('fails with the missing path', async () => {
    await expect(readLogFiles([path.join(dir, 'nope')])).rejects.toThrow(`Not found: ${path.join(dir, 'nope')}`);
  });
});
