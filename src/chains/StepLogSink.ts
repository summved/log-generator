/**
 * Step Log Sink
 * Destination for the log entries produced by attack chain steps
 */

import * as path from 'path';
import { LogEntry } from '../types';
import { StorageManager } from '../utils/storage';

export interface StepLogSink {
  /** Persist entries for an execution and return the location they were written to */
  write(executionId: string, entries: LogEntry[]): Promise<string>;
}

const DEFAULT_CURRENT_PATH = './logs/current';
const DEFAULT_HISTORICAL_PATH = './logs/historical';

/**
 * Writes each execution's logs to `<dir>/attack-chain-<executionId>.jsonl`.
 * `<dir>` is the given output directory, or ./logs/current by default.
 */
export class StorageLogSink implements StepLogSink {
  private storage: StorageManager;

  constructor(outputDirectory?: string) {
    const currentPath = outputDirectory || DEFAULT_CURRENT_PATH;
    const historicalPath = outputDirectory ? path.join(outputDirectory, 'historical') : DEFAULT_HISTORICAL_PATH;
    this.storage = new StorageManager(currentPath, historicalPath);
  }

  public async write(executionId: string, entries: LogEntry[]): Promise<string> {
    return this.storage.storeLogs(entries, `attack-chain-${executionId}.jsonl`);
  }
}
