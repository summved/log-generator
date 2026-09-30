/**
 * Step Log Sink
 * Destination for the log entries produced by attack chain steps
 */

import * as path from 'path';
import { LogEntry } from '../types';
import { ConfigManager } from '../config';
import { OutputManager } from '../utils/outputManager';
import { StorageManager } from '../utils/storage';

export interface StepLogSink {
  /** Persist entries for an execution and return the location they were written to */
  write(executionId: string, entries: LogEntry[]): Promise<string>;
  /** Flush and release any resources (sockets, file handles); called when the chain finishes */
  close?(): Promise<void>;
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

/**
 * Sends attack-chain step logs through the tool's OutputManager, using a log-generator config
 * file. This routes chain logs to the configured destination (file, HTTP, syslog, stdout) and
 * format, plus the usual history copy — the same path `generate` uses — so a chain can be
 * delivered straight to a SIEM with `attack-chains:execute <chain> -c <config>`.
 */
export class OutputManagerLogSink implements StepLogSink {
  private readonly output: OutputManager;
  private readonly config: ReturnType<ConfigManager['getConfig']>;

  constructor(configPath: string) {
    this.config = new ConfigManager(configPath).getConfig();
    const storage = new StorageManager(this.config.storage.currentPath, this.config.storage.historicalPath, this.config.storage.retention, { history: this.config.storage.history });
    this.output = new OutputManager(this.config.output, storage);
  }

  public async write(_executionId: string, entries: LogEntry[]): Promise<string> {
    await Promise.all(entries.map(entry => this.output.outputLog(entry)));
    return `${this.config.output.destination} output`;
  }

  public async close(): Promise<void> {
    await this.output.close();
  }
}
