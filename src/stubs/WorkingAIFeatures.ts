/**
 * attack-chains:execute-ai / training / preview / ai-options / ai-statistics.
 *
 * There is no AI model. --mode and --ai-level set how much each step's duration, delay and log
 * rate vary (see variationProfile.ts), so repeated runs of a chain are not identical. Simulation
 * (the default) writes no logs; --full-execution runs the varied chain and writes real logs.
 * Executions are recorded to a JSONL file so ai-statistics works across processes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AttackChainManager } from '../chains/AttackChainManager';
import { calculateStepLogCount } from '../chains/StepLogFactory';
import { chainDurationMs } from '../chains/chainTiming';
import { AttackChainTemplate } from '../types/attackChain';
import { logger } from '../utils/logger';
import { applyVariation, VARIATION_LEVELS, VARIATION_MODES, variationSpread } from './variationProfile';

export interface PlannedChange {
  type: string;
  description: string;
}

export interface EnhancementPreview {
  chain: { id: string; name: string; category: string; difficulty: string; stepCount: number };
  mode: string;
  aiLevel: string;
  techniques: string[];
  plannedChanges: PlannedChange[];
  estimatedDurationMs: number;
  estimatedLogs: number;
}

export interface EnhancedOptions {
  mode?: string;
  aiLevel?: string;
  /** Default true: describe only, write no logs */
  simulation?: boolean;
  /** Log generator config file (-c) */
  config?: string;
}

export interface TrainingOptions extends EnhancedOptions {
  variationCount?: number;
  delayBetweenVariations?: number;
  /** Levels from basic to advanced across the variations (default true); otherwise they cycle */
  progressive?: boolean;
}

export interface EnhancedExecution {
  executionId: string;
  chainId: string;
  chainName: string;
  mode: string;
  aiLevel: string;
  variationSpread: number;
  executionMode: 'simulation' | 'full';
  status: string;
  plannedChanges: PlannedChange[];
  logsGenerated: number;
  estimatedLogs: number;
  stepsCompleted: number;
  startTime: string;
  endTime: string;
}

export interface AIExecutionRecord {
  executionId: string;
  chainId: string;
  chainName: string;
  mode: string;
  aiLevel: string;
  executionMode: 'simulation' | 'full';
  status: string;
  logsGenerated: number;
  startTime: string;
  endTime: string;
}

export interface AIExecutionHistory {
  executions: AIExecutionRecord[];
  statistics: {
    totalExecutions: number;
    modeDistribution: Record<string, number>;
    levelDistribution: Record<string, number>;
  };
}

const DEFAULT_HISTORY_FILE = path.join('logs', 'attack-chains', 'ai-executions.jsonl');

export class EnhancedAttackChainManager extends AttackChainManager {
  private readonly historyFile: string;

  constructor(templatesDirectory?: string, options: { historyFile?: string } = {}) {
    super(templatesDirectory);
    this.historyFile = options.historyFile || DEFAULT_HISTORY_FILE;
  }

  /** Run (or, by default, simulate) a chain with timing and log-rate variation for the mode and level */
  async executeEnhancedChain(name: string, options: EnhancedOptions = {}): Promise<EnhancedExecution> {
    const template = this.findTemplate(name);
    const mode = options.mode || 'enhanced';
    const aiLevel = options.aiLevel || 'medium';
    const spread = variationSpread(mode, aiLevel);
    const simulation = options.simulation !== false;
    const startTime = new Date();
    const estimatedLogs = template.chain.steps.reduce((total, step) => total + calculateStepLogCount(step), 0);

    let executionId: string;
    let status = 'completed';
    let logsGenerated = 0;
    let stepsCompleted = template.chain.steps.length;

    if (simulation) {
      logger.info(`🤖 Simulating ${template.name} (${mode}/${aiLevel}); writes no logs`);
      executionId = `ai-sim-${startTime.getTime()}`;
    } else {
      logger.info(`🤖 Running ${template.name} (${mode}/${aiLevel}); +/-${Math.round(spread * 100)}% timing and log-rate variation`);
      // Vary this run's timing and log rate; the steps, their order and their MITRE mapping are unchanged
      const chain = { ...template.chain, steps: applyVariation(template.chain.steps, spread) };
      const execution = await this.executeChainDefinition(chain, undefined, options.config);
      executionId = execution.executionId;
      status = execution.status;
      logsGenerated = execution.stats.logsGenerated;
      stepsCompleted = execution.stats.stepsCompleted;
    }

    const record: AIExecutionRecord = {
      executionId,
      chainId: template.chain.id,
      chainName: template.name,
      mode,
      aiLevel,
      executionMode: simulation ? 'simulation' : 'full',
      status,
      logsGenerated,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString()
    };
    this.record(record);

    return {
      ...record,
      variationSpread: spread,
      plannedChanges: this.plannedChanges(mode, aiLevel),
      estimatedLogs,
      stepsCompleted
    };
  }

  /** Run several variations of a chain. Progressive steps the level from basic to advanced. */
  async executeTrainingSession(name: string, options: TrainingOptions = {}): Promise<EnhancedExecution[]> {
    const variations = Math.max(1, options.variationCount ?? 5);
    const delay = options.delayBetweenVariations ?? 30000;
    const progressive = options.progressive !== false;

    const executions: EnhancedExecution[] = [];
    for (let i = 0; i < variations; i++) {
      executions.push(await this.executeEnhancedChain(name, {
        ...options,
        mode: 'enhanced',
        aiLevel: progressive ? this.progressiveLevel(i, variations) : this.cyclingLevel(i)
      }));
      if (i < variations - 1 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return executions;
  }

  /** Describe what a mode and level would do to a chain, without running it (deterministic) */
  async previewEnhancement(name: string, mode: string, aiLevel: string): Promise<EnhancementPreview> {
    const template = this.findTemplate(name);
    variationSpread(mode, aiLevel); // validates mode and level
    const steps = template.chain.steps;

    return {
      chain: { id: template.chain.id, name: template.name, category: template.category, difficulty: template.difficulty, stepCount: steps.length },
      mode,
      aiLevel,
      techniques: steps.map(step => step.mitre.technique),
      plannedChanges: this.plannedChanges(mode, aiLevel),
      estimatedDurationMs: chainDurationMs(steps),
      estimatedLogs: steps.reduce((total, step) => total + calculateStepLogCount(step), 0)
    };
  }

  /** The modes, levels and their variation spreads for a chain (no invented capabilities) */
  getEnhancementOptions(name: string): {
    chain: { id: string; name: string; category: string; difficulty: string };
    modes: string[];
    aiLevels: string[];
    levels: { level: string; variationSpread: number; description: string }[];
    note: string;
  } {
    const template = this.findTemplate(name);
    return {
      chain: { id: template.chain.id, name: template.name, category: template.category, difficulty: template.difficulty },
      modes: VARIATION_MODES,
      aiLevels: VARIATION_LEVELS,
      levels: VARIATION_LEVELS.map(level => ({
        level,
        variationSpread: variationSpread('enhanced', level),
        description: `+/-${Math.round(variationSpread('enhanced', level) * 100)}% variation on step duration, delay and log rate`
      })),
      note: 'Variations change only timing and log volume. Steps, their order and their MITRE ATT&CK mapping are never changed.'
    };
  }

  /** Recorded executions (most recent first) with summary statistics, read from the history file */
  getExecutionHistory(limit: number = 10): AIExecutionHistory {
    const records = this.readRecords();
    const countBy = (key: 'mode' | 'aiLevel'): Record<string, number> =>
      records.reduce<Record<string, number>>((counts, record) => ({ ...counts, [record[key]]: (counts[record[key]] || 0) + 1 }), {});

    return {
      executions: [...records].reverse().slice(0, limit),
      statistics: {
        totalExecutions: records.length,
        modeDistribution: countBy('mode'),
        levelDistribution: countBy('aiLevel')
      }
    };
  }

  private findTemplate(name: string): AttackChainTemplate {
    const template = this.getTemplate(name) || this.getTemplateByName(name);
    if (!template) {
      throw new Error(`Attack chain template not found: ${name}`);
    }
    return template;
  }

  /** The change a mode and level actually make: timing and log-rate variation only */
  private plannedChanges(mode: string, aiLevel: string): PlannedChange[] {
    const spread = variationSpread(mode, aiLevel);
    if (spread === 0) {
      return [{ type: 'none', description: 'static mode: run the chain exactly as defined, no variation' }];
    }
    return [{ type: 'timing_variation', description: `Vary each step's duration, delay and log rate by up to +/-${Math.round(spread * 100)}% (${mode}/${aiLevel})` }];
  }

  /** basic -> advanced spread across the variations */
  private progressiveLevel(index: number, total: number): string {
    const position = total <= 1 ? 0 : index / (total - 1);
    return VARIATION_LEVELS[Math.min(VARIATION_LEVELS.length - 1, Math.floor(position * VARIATION_LEVELS.length))];
  }

  private cyclingLevel(index: number): string {
    return VARIATION_LEVELS[index % VARIATION_LEVELS.length];
  }

  private record(record: AIExecutionRecord): void {
    try {
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
      fs.appendFileSync(this.historyFile, JSON.stringify(record) + '\n');
    } catch (error) {
      logger.warn(`Could not record AI execution history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private readRecords(): AIExecutionRecord[] {
    try {
      return fs.readFileSync(this.historyFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as AIExecutionRecord);
    } catch {
      return [];
    }
  }
}
