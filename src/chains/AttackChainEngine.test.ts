import { mkdtempSync, readFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { LogEntry } from '../types';
import { AttackChain, AttackChainStep, AttackChainReport } from '../types/attackChain';
import { AttackChainEngine } from './AttackChainEngine';
import { StepLogSink } from './StepLogSink';

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

class MemorySink implements StepLogSink {
  public readonly writes: Array<{ executionId: string; entries: LogEntry[] }> = [];

  async write(executionId: string, entries: LogEntry[]): Promise<string> {
    this.writes.push({ executionId, entries });
    return `memory://${executionId}.jsonl`;
  }

  entries(): LogEntry[] {
    return this.writes.flatMap(write => write.entries);
  }
}

function makeStep(id: string, technique: string, sources: string[] = ['endpoint']): AttackChainStep {
  return {
    id,
    name: `Step ${id}`,
    description: `Step ${id}`,
    mitre: { technique, tactic: 'TA0001' },
    timing: { delayAfterPrevious: 1000, duration: 60000, variance: 0 },
    logGeneration: { templates: [`${id}_event`], frequency: 3, sources }
  };
}

function makeChain(steps: AttackChainStep[]): AttackChain {
  return {
    id: 'test-chain',
    name: 'Test Chain',
    description: 'Fixture chain',
    category: 'custom',
    metadata: {
      author: 'test', version: '1', created: '2026-01-01', tags: [],
      severity: 'low', estimated_duration: 3
    },
    mitre_mapping: { tactics: ['TA0001'], techniques: [], kill_chain_phases: [] },
    steps,
    config: {
      max_duration: 600000,
      abort_on_step_failure: false,
      log_chain_progress: false,
      cleanup_after_completion: true
    }
  };
}

function readReport(dir: string, executionId: string): AttackChainReport {
  return JSON.parse(readFileSync(path.join(dir, `${executionId}-report.json`), 'utf8'));
}

describe('AttackChainEngine', () => {
  let dir: string;
  let sink: MemorySink;
  let engine: AttackChainEngine;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'chain-engine-'));
    sink = new MemorySink();
    engine = new AttackChainEngine(
      { randomize_timing: false, output_directory: dir },
      { sink, sleep: async () => undefined }
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('emits technique-tagged logs for every step, correlated to the execution', async () => {
    const chain = makeChain([makeStep('one', 'T1566'), makeStep('two', 'T1059'), makeStep('three', 'T1003')]);

    const execution = await engine.executeChain(chain);

    expect(execution.status).toBe('completed');
    const entries = sink.entries();
    expect(entries).toHaveLength(9);
    expect(entries.map(entry => entry.mitre?.technique)).toEqual([
      'T1566', 'T1566', 'T1566', 'T1059', 'T1059', 'T1059', 'T1003', 'T1003', 'T1003'
    ]);
    for (const entry of entries) {
      expect(entry.metadata.attack_chain.execution_id).toBe(execution.executionId);
      expect(entry.metadata.attack_chain.chain_id).toBe('test-chain');
    }
    expect(execution.stats.logsGenerated).toBe(entries.length);
  });

  it('writes a step\'s logs progressively, each batch after its share of the step duration', async () => {
    const events: string[] = [];
    const recordingSink: StepLogSink = {
      write: async (_executionId, entries) => {
        events.push(`write:${entries.length}`);
        return 'memory://progressive.jsonl';
      }
    };
    const progressiveEngine = new AttackChainEngine(
      { randomize_timing: false, output_directory: dir },
      { sink: recordingSink, sleep: async ms => { events.push(`sleep:${ms}`); } }
    );

    await progressiveEngine.executeChain(makeChain([makeStep('one', 'T1566')]));

    // 1000ms delay before the step, then 3 logs over its 60000ms duration
    expect(events).toEqual([
      'sleep:1000',
      'sleep:20000', 'write:1',
      'sleep:20000', 'write:1',
      'sleep:20000', 'write:1'
    ]);
  });

  it('caps a busy step at 10 write batches that still span its full duration', async () => {
    const sleeps: number[] = [];
    const batchedEngine = new AttackChainEngine(
      { randomize_timing: false, output_directory: dir },
      { sink, sleep: async ms => { sleeps.push(ms); } }
    );
    const step = { ...makeStep('busy', 'T1486'), timing: { delayAfterPrevious: 0, duration: 60000, variance: 0 } };
    step.logGeneration = { ...step.logGeneration, frequency: 11 };

    await batchedEngine.executeChain(makeChain([step]));

    expect(sink.writes).toHaveLength(10);
    expect(sink.entries()).toHaveLength(11);
    expect(sleeps.reduce((total, ms) => total + ms, 0)).toBeCloseTo(60000);
  });

  it('writes a report with per-step results and the log and report file paths', async () => {
    const chain = makeChain([makeStep('one', 'T1566'), makeStep('two', 'T1059'), makeStep('three', 'T1003')]);

    const execution = await engine.executeChain(chain);
    const report = readReport(dir, execution.executionId);

    expect(report.step_results.map(result => [result.step.id, result.status, result.logs_generated])).toEqual([
      ['one', 'completed', 3], ['two', 'completed', 3], ['three', 'completed', 3]
    ]);
    for (const result of report.step_results) {
      expect(typeof result.duration).toBe('number');
      expect(new Date(result.end_time).getTime()).toBeGreaterThanOrEqual(new Date(result.start_time).getTime());
    }
    expect(report.summary.total_logs_generated).toBe(9);
    expect(report.output_files.logs).toEqual([`memory://${execution.executionId}.jsonl`]);

    const reportPath = path.join(dir, `${execution.executionId}-report.json`);
    expect(report.output_files.reports).toEqual([reportPath]);
    expect(execution.outputFiles).toEqual({ logs: report.output_files.logs, report: reportPath });
    expect(existsSync(reportPath)).toBe(true);
  });

  it('records a step with an unknown source as failed and continues the chain', async () => {
    const chain = makeChain([makeStep('one', 'T1566'), makeStep('bad', 'T1059', ['bogus']), makeStep('three', 'T1003')]);

    const execution = await engine.executeChain(chain);
    const report = readReport(dir, execution.executionId);

    expect(execution.status).toBe('completed');
    expect(execution.failedSteps).toEqual(['bad']);
    const bad = report.step_results.find(result => result.step.id === 'bad');
    expect(bad?.status).toBe('failed');
    expect(bad?.logs_generated).toBe(0);
    expect(bad?.errors).toEqual([expect.stringContaining('Unknown attack-chain source "bogus"')]);
    expect(execution.stats.logsGenerated).toBe(6);
  });

  it('keeps an aborted chain aborted, stops running steps and writes no report', async () => {
    const abortingEngine: AttackChainEngine = new AttackChainEngine(
      { randomize_timing: false, output_directory: dir },
      {
        sink,
        // Abort as soon as the first step starts holding for its duration
        sleep: async () => {
          const [running] = abortingEngine.getActiveExecutions();
          if (running && running.completedSteps.length === 0 && running.status === 'running') {
            await abortingEngine.abortChain(running.executionId);
          }
        }
      }
    );
    const chain = makeChain([makeStep('one', 'T1566'), makeStep('two', 'T1059')]);

    const execution = await abortingEngine.executeChain(chain);

    expect(execution.status).toBe('aborted');
    const stepsWritten = new Set(sink.entries().map(entry => entry.metadata.attack_chain.step_id));
    expect(stepsWritten).toEqual(new Set(['one']));
    expect(existsSync(path.join(dir, `${execution.executionId}-report.json`))).toBe(false);
  });

  it('fails a step whose success criteria are not met but still counts its logs', async () => {
    const step = { ...makeStep('one', 'T1566'), successCriteria: { minLogsGenerated: 100, requiredPatterns: [] } };

    const execution = await engine.executeChain(makeChain([step, makeStep('two', 'T1059')]));
    const report = readReport(dir, execution.executionId);

    expect(execution.failedSteps).toEqual(['one']);
    expect(report.step_results[0]).toEqual(expect.objectContaining({ status: 'failed', logs_generated: 3 }));
    expect(report.step_results[0].errors).toEqual([expect.stringContaining('expected 100 logs, got 3')]);
  });

  it('stops the chain and writes no report when abort_on_step_failure is set', async () => {
    const chain = makeChain([makeStep('bad', 'T1059', ['bogus']), makeStep('two', 'T1003')]);
    chain.config.abort_on_step_failure = true;

    const execution = await engine.executeChain(chain);

    expect(execution.status).toBe('failed');
    expect(execution.lastError?.message).toContain('Unknown attack-chain source "bogus"');
    expect(sink.writes).toHaveLength(0);
    expect(existsSync(path.join(dir, `${execution.executionId}-report.json`))).toBe(false);
  });

  it('gives separate executions distinct correlation ids', async () => {
    const chain = makeChain([makeStep('one', 'T1566')]);

    const first = await engine.executeChain(chain);
    const second = await engine.executeChain(chain);

    expect(first.executionId).not.toBe(second.executionId);
    const ids = new Set(sink.entries().map(entry => entry.metadata.attack_chain.execution_id));
    expect(ids).toEqual(new Set([first.executionId, second.executionId]));
  });
});
