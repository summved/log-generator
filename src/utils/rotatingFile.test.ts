import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { parseSize, RotatingFileWriter } from './rotatingFile';

const tempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'rotating-'));
const line = (i: number): string => `${'x'.repeat(90)}${String(i).padStart(9, '0')}\n`; // 100 bytes

describe('parseSize', () => {
  it.each([
    ['100', 100], ['512B', 512], ['10KB', 10240], ['100MB', 104857600], ['1GB', 1073741824], ['1.5 mb', 1572864], [2048, 2048]
  ])('reads %p', (input, bytes) => {
    expect(parseSize(input as string | number)).toBe(bytes);
  });

  it.each(['', 'lots', '-5MB', '0'])('rejects %p', input => {
    expect(() => parseSize(input)).toThrow(/Invalid file size/);
  });
});

describe('RotatingFileWriter', () => {
  it('writes to the file until the next write would pass maxSize, then rotates', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file, maxSize: 1000, maxFiles: 5 });

    for (let i = 0; i < 25; i++) await writer.write(line(i));
    await writer.close();

    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['logs.json', 'logs.json.1', 'logs.json.2']);
    expect(fs.statSync(file).size).toBe(500);
    expect(fs.statSync(`${file}.1`).size).toBe(1000);
    // Newest data in logs.json, then .1, then .2
    expect(fs.readFileSync(`${file}.2`, 'utf8').startsWith(line(0))).toBe(true);
    expect(fs.readFileSync(file, 'utf8').endsWith(line(24))).toBe(true);
  });

  it('keeps only maxFiles rotated files', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file, maxSize: 200, maxFiles: 2 });

    for (let i = 0; i < 20; i++) await writer.write(line(i));
    await writer.close();

    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['logs.json', 'logs.json.1', 'logs.json.2']);
  });

  it('never splits a write across files, even when it is bigger than maxSize', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file, maxSize: 150, maxFiles: 3 });

    await writer.write(line(1));
    await writer.write(line(2) + line(3));
    await writer.close();

    expect(fs.readFileSync(file, 'utf8')).toBe(line(2) + line(3));
    expect(fs.readFileSync(`${file}.1`, 'utf8')).toBe(line(1));
  });

  it('gzips rotated files when compression is on', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file, maxSize: 300, maxFiles: 3, compress: true });

    for (let i = 0; i < 7; i++) await writer.write(line(i));
    await writer.close();

    expect(fs.readdirSync(path.dirname(file)).sort()).toEqual(['logs.json', 'logs.json.1.gz', 'logs.json.2.gz']);
    expect(zlib.gunzipSync(fs.readFileSync(`${file}.2.gz`)).toString()).toBe(line(0) + line(1) + line(2));
  });

  it('continues an existing file and counts its size', async () => {
    const file = path.join(tempDir(), 'logs.json');
    fs.writeFileSync(file, line(0).repeat(9));
    const writer = new RotatingFileWriter({ path: file, maxSize: 1000, maxFiles: 3 });

    await writer.write(line(1));
    await writer.write(line(2));
    await writer.close();

    expect(fs.statSync(file).size).toBe(100);
    expect(fs.statSync(`${file}.1`).size).toBe(1000);
  });

  it('never rotates without a maxSize', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file });

    for (let i = 0; i < 50; i++) await writer.write(line(i));
    await writer.close();

    expect(fs.readdirSync(path.dirname(file))).toEqual(['logs.json']);
    expect(fs.statSync(file).size).toBe(5000);
  });

  it('keeps the order of writes made without waiting for each other', async () => {
    const file = path.join(tempDir(), 'logs.json');
    const writer = new RotatingFileWriter({ path: file, maxSize: 500, maxFiles: 10 });

    await Promise.all(Array.from({ length: 30 }, (_, i) => writer.write(line(i))));
    await writer.close();

    const all = [9, 8, 7, 6, 5, 4, 3, 2, 1].filter(n => fs.existsSync(`${file}.${n}`)).map(n => fs.readFileSync(`${file}.${n}`, 'utf8')).join('')
      + fs.readFileSync(file, 'utf8');
    expect(all).toBe(Array.from({ length: 30 }, (_, i) => line(i)).join(''));
  });
});
