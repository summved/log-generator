/**
 * Append-only writer for the file output with size-based rotation: when the next write would take
 * the file past maxSize, logs.json becomes logs.json.1 (older ones move up, beyond maxFiles are
 * deleted) and a new logs.json starts. Rotated files can be gzipped. Writes are never split.
 */

import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import * as zlib from 'zlib';
import { logger } from './logger';

export interface RotatingFileOptions {
  path: string;
  /** Rotate before a write would take the file past this many bytes; no rotation when unset */
  maxSize?: number;
  /** Rotated files to keep (default 10) */
  maxFiles?: number;
  /** Gzip rotated files */
  compress?: boolean;
}

const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

/** "100MB" -> bytes (units are 1024-based) */
export function parseSize(value: string | number): number {
  const match = String(value).trim().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/);
  const bytes = match ? Math.floor(Number(match[1]) * UNITS[match[2] || 'B']) : 0;
  if (!(bytes > 0)) {
    throw new Error(`Invalid file size "${value}". Use e.g. 500KB, 100MB or 1GB`);
  }
  return bytes;
}

export class RotatingFileWriter {
  private stream: fs.WriteStream;
  private size: number;
  private chain: Promise<void> = Promise.resolve();
  private readonly maxFiles: number;

  constructor(private readonly options: RotatingFileOptions) {
    fs.mkdirSync(path.dirname(options.path), { recursive: true });
    this.maxFiles = Math.max(1, options.maxFiles ?? 10);
    this.size = fs.existsSync(options.path) ? fs.statSync(options.path).size : 0;
    this.stream = this.open();
  }

  /** Append data; writes happen in call order */
  public write(data: string): Promise<void> {
    const task = this.chain.then(async () => {
      const bytes = Buffer.byteLength(data);
      if (this.options.maxSize && this.size > 0 && this.size + bytes > this.options.maxSize) {
        await this.rotate();
      }
      await new Promise<void>((resolve, reject) => this.stream.write(data, error => (error ? reject(error) : resolve())));
      this.size += bytes;
    });
    // The caller gets the error from `task`; the chain carries on so later writes still happen
    this.chain = task.catch(() => undefined);
    return task;
  }

  public async close(): Promise<void> {
    await this.chain;
    await this.end();
  }

  private open(): fs.WriteStream {
    const stream = fs.createWriteStream(this.options.path, { flags: 'a', highWaterMark: 64 * 1024 });
    // Write errors also reach the caller through the write callback; this reports errors such as a failed open
    stream.on('error', error => logger.error(`File output error for ${this.options.path}:`, error));
    return stream;
  }

  private end(): Promise<void> {
    return new Promise(resolve => this.stream.end(() => resolve()));
  }

  private async rotate(): Promise<void> {
    await this.end();
    const suffix = this.options.compress ? '.gz' : '';
    const rotated = (n: number) => `${this.options.path}.${n}${suffix}`;

    await fs.promises.rm(rotated(this.maxFiles), { force: true });
    for (let n = this.maxFiles - 1; n >= 1; n--) {
      if (fs.existsSync(rotated(n))) await fs.promises.rename(rotated(n), rotated(n + 1));
    }
    if (this.options.compress) {
      await pipeline(fs.createReadStream(this.options.path), zlib.createGzip(), fs.createWriteStream(rotated(1)));
      await fs.promises.rm(this.options.path);
    } else {
      await fs.promises.rename(this.options.path, rotated(1));
    }

    this.size = 0;
    this.stream = this.open();
  }
}
