import * as fs from 'fs-extra';
import * as path from 'path';
import { LogEntry, HistoricalLogFile } from '../types';
import { logger } from './logger';
import moment from 'moment';

export class StorageManager {
  private currentPath: string;
  private historicalPath: string;
  private retentionDays: number;
  private pending?: { lines: string[]; done: Promise<string>; resolve: (file: string) => void; reject: (error: unknown) => void };
  private writeChain: Promise<void> = Promise.resolve();

  constructor(currentPath: string, historicalPath: string, retentionDays: number = 30) {
    this.currentPath = currentPath;
    this.historicalPath = historicalPath;
    this.retentionDays = retentionDays;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    fs.ensureDirSync(this.currentPath);
    fs.ensureDirSync(this.historicalPath);
  }

  public async storeLogs(logs: LogEntry[], filename?: string): Promise<string> {
    const filePath = path.join(this.currentPath, filename || this.defaultFilename());
    await this.appendLines(filePath, logs.map(log => JSON.stringify(log)));
    return filePath;
  }

  /**
   * Store one log in the current history file. Logs handed over in the same tick are joined and
   * written with a single append, in order; each promise resolves once its log is on disk.
   */
  public storeLog(log: LogEntry, filename?: string): Promise<string> {
    if (filename) {
      return this.storeLogs([log], filename);
    }
    if (!this.pending) {
      let resolve!: (file: string) => void;
      let reject!: (error: unknown) => void;
      const done = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
      this.pending = { lines: [], done, resolve, reject };
      setImmediate(() => this.writePending());
    }
    this.pending.lines.push(JSON.stringify(log));
    return this.pending.done;
  }

  /** Wait until every log handed to storeLog so far is on disk */
  public async flush(): Promise<void> {
    this.writePending();
    await this.writeChain;
  }

  private writePending(): void {
    const batch = this.pending;
    if (!batch) return;
    this.pending = undefined;
    const filePath = path.join(this.currentPath, this.defaultFilename());
    // Chained so batches reach the file in the order they were handed over
    this.writeChain = this.writeChain
      .then(() => this.appendLines(filePath, batch.lines))
      .then(() => batch.resolve(filePath), error => batch.reject(error));
    // Callers that never await storeLog must not cause an unhandled rejection; the error is logged in appendLines
    batch.done.catch(() => undefined);
  }

  private async appendLines(filePath: string, lines: string[]): Promise<void> {
    try {
      await fs.appendFile(filePath, lines.join('\n') + '\n');
      logger.debug(`Stored ${lines.length} logs to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to store ${lines.length} logs to ${filePath}:`, error);
      throw error;
    }
  }

  private defaultFilename(): string {
    return `logs_${moment().format('YYYY-MM-DD_HH-mm-ss')}.jsonl`;
  }

  public async rotateCurrentLogs(): Promise<void> {
    try {
      await this.flush();
      const files = await fs.readdir(this.currentPath);
      const logFiles = files.filter(file => file.endsWith('.jsonl') || file.endsWith('.json'));

      for (const file of logFiles) {
        const currentFilePath = path.join(this.currentPath, file);
        const historicalFilePath = path.join(this.historicalPath, file);
        
        await fs.move(currentFilePath, historicalFilePath);
        logger.info(`Rotated log file ${file} to historical storage`);
      }
    } catch (error) {
      logger.error('Failed to rotate log files:', error);
      throw error;
    }
  }

  public async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.historicalPath);
      const cutoffDate = moment().subtract(this.retentionDays, 'days');

      for (const file of files) {
        const filePath = path.join(this.historicalPath, file);
        const stats = await fs.stat(filePath);
        
        if (moment(stats.mtime).isBefore(cutoffDate)) {
          await fs.remove(filePath);
          logger.info(`Removed old log file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      throw error;
    }
  }

  public async getHistoricalLogFiles(): Promise<HistoricalLogFile[]> {
    try {
      const files = await fs.readdir(this.historicalPath);
      const logFiles: HistoricalLogFile[] = [];

      // Limit processing to prevent hangs with thousands of files
      const maxFiles = 100;
      const filesToProcess = files
        .filter(file => file.endsWith('.jsonl') || file.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a)) // Sort by name descending (newest first)
        .slice(0, maxFiles);

      for (const file of filesToProcess) {
        const filePath = path.join(this.historicalPath, file);
        const stats = await fs.stat(filePath);
        
        // Parse timestamps from filename or use file timestamps
        const timeMatch = file.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
        const startTime = timeMatch ? 
          moment(timeMatch[1], 'YYYY-MM-DD_HH-mm-ss').toISOString() : 
          moment(stats.birthtime).toISOString();

        // Count lines efficiently without loading entire file into memory
        let count = 0;
        try {
          const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
          let buffer = '';
          
          for await (const chunk of stream) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line
            count += lines.filter(line => line.trim()).length;
          }
          
          // Count final line if exists
          if (buffer.trim()) {
            count += 1;
          }
        } catch (streamError) {
          // Fallback to file size estimation if streaming fails
          count = Math.max(1, Math.floor(stats.size / 500)); // Estimate ~500 bytes per log
        }

        logFiles.push({
          filename: file,
          startTime,
          endTime: moment(stats.mtime).toISOString(),
          count,
          size: stats.size
        });
      }

      return logFiles.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (error) {
      logger.error('Failed to get historical log files:', error);
      throw error;
    }
  }

  public async readHistoricalLogs(filename: string): Promise<LogEntry[]> {
    try {
      const filePath = path.join(this.historicalPath, filename);
      const content = await fs.readFile(filePath, 'utf8');
      
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as LogEntry);
    } catch (error) {
      logger.error(`Failed to read historical logs from ${filename}:`, error);
      throw error;
    }
  }

  public async getCurrentLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.currentPath);
      return files.filter(file => file.endsWith('.jsonl') || file.endsWith('.json'));
    } catch (error) {
      logger.error('Failed to get current log files:', error);
      throw error;
    }
  }
}
