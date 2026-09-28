/**
 * Log Files
 * Reads JSON-lines log files and directories for the analysis commands
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { D3FENDInfo } from '../types';

/** A parsed log line; only `message` is guaranteed, other fields are read when present */
export interface ParsedLog {
  message: string;
  timestamp?: string;
  level?: string;
  source?: { type?: string; name?: string };
  metadata?: Record<string, unknown>;
  mitre?: { technique?: string; tactic?: string };
  d3fend?: D3FENDInfo;
}

export interface LogFilesResult {
  files: string[];
  logs: ParsedLog[];
  /** Non-empty lines that were not log entries */
  skipped: number;
}

/** Parse JSON-lines text into log entries; blank lines are ignored, other non-log lines are counted as skipped */
export function parseLogLines(text: string): { logs: ParsedLog[]; skipped: number } {
  const logs: ParsedLog[] = [];
  let skipped = 0;

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === 'object' && typeof (parsed as ParsedLog).message === 'string') {
        logs.push(parsed as ParsedLog);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { logs, skipped };
}

/** Read log files and the .jsonl/.json files directly inside any directories given */
export async function readLogFiles(targets: string[]): Promise<LogFilesResult> {
  const files: string[] = [];
  for (const target of targets) {
    if (!(await fs.pathExists(target))) {
      throw new Error(`Not found: ${target}`);
    }
    if ((await fs.stat(target)).isDirectory()) {
      const names = (await fs.readdir(target)).filter(name => name.endsWith('.jsonl') || name.endsWith('.json')).sort();
      files.push(...names.map(name => path.join(target, name)));
    } else {
      files.push(target);
    }
  }

  const logs: ParsedLog[] = [];
  let skipped = 0;
  for (const file of files) {
    const parsed = parseLogLines(await fs.readFile(file, 'utf8'));
    logs.push(...parsed.logs);
    skipped += parsed.skipped;
  }

  return { files, logs, skipped };
}
