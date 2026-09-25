/**
 * Attack Chain Execution Engine
 * Orchestrates multi-stage MITRE ATT&CK technique sequences
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  AttackChain,
  AttackChainStep,
  AttackChainExecution,
  AttackChainExecutionConfig,
  AttackChainReport
} from '../types/attackChain';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { buildStepLogs } from './StepLogFactory';
import { StepLogSink, StorageLogSink } from './StepLogSink';

type StepResult = AttackChainReport['step_results'][number];

/**
 * Optional collaborators, injectable for testing
 */
export interface AttackChainEngineDeps {
  sink?: StepLogSink;
  sleep?: (ms: number) => Promise<void>;
}

const MAX_WRITE_BATCHES_PER_STEP = 10;

const defaultSleep =(ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Events emitted by the AttackChainEngine
 */
export interface AttackChainEngineEvents {
  'chain.started': (execution: AttackChainExecution) => void;
  'chain.completed': (execution: AttackChainExecution) => void;
  'chain.failed': (execution: AttackChainExecution, error: Error) => void;
  'chain.aborted': (execution: AttackChainExecution) => void;
  'step.started': (execution: AttackChainExecution, step: AttackChainStep) => void;
  'step.completed': (execution: AttackChainExecution, step: AttackChainStep) => void;
  'step.failed': (execution: AttackChainExecution, step: AttackChainStep, error: Error) => void;
  'progress.updated': (execution: AttackChainExecution) => void;
}

export declare interface AttackChainEngine {
  on<U extends keyof AttackChainEngineEvents>(event: U, listener: AttackChainEngineEvents[U]): this;
  emit<U extends keyof AttackChainEngineEvents>(event: U, ...args: Parameters<AttackChainEngineEvents[U]>): boolean;
}

/**
 * Main attack chain execution engine
 */
export class AttackChainEngine extends EventEmitter {
  private activeExecutions: Map<string, AttackChainExecution> = new Map();
  private stepResults: Map<string, StepResult[]> = new Map();
  private logFiles: Map<string, Set<string>> = new Map();
  private config: AttackChainExecutionConfig;
  private sink?: StepLogSink;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config?: Partial<AttackChainExecutionConfig>, deps: AttackChainEngineDeps = {}) {
    super();
    this.sink = deps.sink;
    this.sleep = deps.sleep || defaultSleep;

    this.config = {
      speed_multiplier: 1.0,
      enable_progress_logging: true,
      log_level: 'info',
      generate_execution_report: true,
      allow_step_skipping: false,
      continue_on_failure: false,
      randomize_timing: true,
      ...config
    };
    
    logger.info('AttackChainEngine initialized', { config: this.config });
  }

  /**
   * Execute an attack chain
   * @param _logGeneratorConfig Unused; kept for signature compatibility with existing callers
   */
  public async executeChain(
    chain: AttackChain,
    _logGeneratorConfig?: string
  ): Promise<AttackChainExecution> {
    const executionId = uuidv4();
    const execution: AttackChainExecution = {
      chainId: chain.id,
      executionId,
      status: 'pending',
      currentStep: undefined,
      completedSteps: [],
      failedSteps: [],
      totalSteps: chain.steps.length,
      stats: {
        logsGenerated: 0,
        stepsCompleted: 0,
        stepsFailed: 0,
        averageStepDuration: 0
      }
    };

    this.activeExecutions.set(executionId, execution);
    this.stepResults.set(executionId, []);
    this.logFiles.set(executionId, new Set());

    try {
      logger.info(`Starting attack chain execution: ${chain.name}`, { 
        executionId, 
        chainId: chain.id,
        totalSteps: chain.steps.length 
      });

      execution.status = 'running';
      execution.startTime = new Date();
      execution.estimatedEndTime = new Date(
        execution.startTime.getTime() + (chain.metadata.estimated_duration * 60 * 1000)
      );

      this.emit('chain.started', execution);

      // Execute steps in sequence
      for (const step of chain.steps) {
        // Check if execution has been aborted
        if (this.isAborted(executionId)) {
          break;
        }

        try {
          await this.executeStep(chain, step, execution);
          execution.completedSteps.push(step.id);
          execution.stats.stepsCompleted++;
        } catch (error) {
          execution.failedSteps.push(step.id);
          execution.stats.stepsFailed++;
          execution.lastError = {
            stepId: step.id,
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          };

          if (chain.config.abort_on_step_failure && !this.config.continue_on_failure) {
            throw error;
          }
          
          logger.warn(`Step failed but continuing: ${step.name}`, { 
            stepId: step.id, 
            error: execution.lastError.message 
          });
        }

        this.emit('progress.updated', execution);
      }

      // abortChain already set the aborted status and end time; don't report it as completed
      if (this.isAborted(executionId)) {
        execution.outputFiles = { logs: Array.from(this.logFiles.get(executionId) || []) };
        return execution;
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      
      // Calculate final statistics
      const totalDuration = execution.endTime.getTime() - execution.startTime!.getTime();
      execution.stats.averageStepDuration = execution.stats.stepsCompleted > 0
        ? totalDuration / execution.stats.stepsCompleted
        : 0;
      execution.outputFiles = { logs: Array.from(this.logFiles.get(executionId) || []) };

      logger.info(`Attack chain completed: ${chain.name}`, {
        executionId,
        duration: totalDuration,
        stepsCompleted: execution.stats.stepsCompleted,
        stepsFailed: execution.stats.stepsFailed,
        logsGenerated: execution.stats.logsGenerated
      });

      this.emit('chain.completed', execution);

      // Generate execution report if configured
      if (this.config.generate_execution_report) {
        await this.generateExecutionReport(chain, execution);
      }

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      
      logger.error(`Attack chain failed: ${chain.name}`, { 
        executionId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      this.emit('chain.failed', execution, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.stepResults.delete(executionId);
      this.logFiles.delete(executionId);

      // Cleanup
      if (chain.config.cleanup_after_completion) {
        await this.cleanup(execution);
      }
    }

    return execution;
  }

  /**
   * Execute a single attack chain step
   */
  private async executeStep(
    chain: AttackChain, 
    step: AttackChainStep, 
    execution: AttackChainExecution
  ): Promise<void> {
    execution.currentStep = step.id;
    
    logger.info(`Executing step: ${step.name}`, { 
      stepId: step.id, 
      executionId: execution.executionId,
      mitreTechnique: step.mitre.technique 
    });

    this.emit('step.started', execution, step);

    const stepStart = new Date();
    const stepStartTime = stepStart.getTime();
    let logsGenerated = 0;

    try {
      // Check dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!execution.completedSteps.includes(depId)) {
            throw new Error(`Dependency not met: step ${depId} must complete before ${step.id}`);
          }
        }
      }

      // Wait for delay after previous step
      if (step.timing.delayAfterPrevious > 0) {
        const delay = this.calculateActualDelay(step.timing.delayAfterPrevious, step.timing.variance);
        logger.debug(`Waiting ${delay}ms before executing step: ${step.name}`);
        await this.sleep(delay);
      }

      // Start log generation for this step's duration
      const stepDuration = this.calculateActualDelay(step.timing.duration, step.timing.variance);
      logger.debug(`Generating logs for ${stepDuration}ms for step: ${step.name}`, {
        frequency: step.logGeneration.frequency,
        sources: step.logGeneration.sources,
        templates: step.logGeneration.templates
      });

      // Execute the step (generate logs with MITRE technique)
      logsGenerated = await this.generateStepLogs(step, execution, stepDuration);
      execution.stats.logsGenerated += logsGenerated;

      // Check success criteria if defined
      if (step.successCriteria) {
        await this.validateStepSuccess(step, logsGenerated);
      }

      const stepEndTime = Date.now();
      const actualDuration = stepEndTime - stepStartTime;

      logger.info(`Step completed: ${step.name}`, { 
        stepId: step.id,
        duration: actualDuration,
        logsGenerated,
        mitreTechnique: step.mitre.technique
      });

      this.recordStepResult(execution, step, 'completed', stepStart, logsGenerated);
      this.emit('step.completed', execution, step);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Step failed: ${step.name}`, {
        stepId: step.id,
        error: message
      });

      this.recordStepResult(execution, step, 'failed', stepStart, logsGenerated, [message]);
      this.emit('step.failed', execution, step, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate the MITRE-tagged logs for a step and write them progressively over the
   * step's duration, so each batch lands only once its timestamps have been reached
   */
  private async generateStepLogs(
    step: AttackChainStep,
    execution: AttackChainExecution,
    duration: number
  ): Promise<number> {
    const entries = buildStepLogs(step, {
      chainId: execution.chainId,
      executionId: execution.executionId,
      startTime: new Date(),
      windowMs: duration
    });

    const batchCount = Math.min(entries.length, MAX_WRITE_BATCHES_PER_STEP);
    const interval = duration / batchCount;

    for (let batch = 0; batch < batchCount; batch++) {
      const start = Math.floor(batch * entries.length / batchCount);
      const end = Math.floor((batch + 1) * entries.length / batchCount);
      await this.sleep(interval);
      const filePath = await this.getSink().write(execution.executionId, entries.slice(start, end));
      this.logFiles.get(execution.executionId)?.add(filePath);
    }

    return entries.length;
  }

  private isAborted(executionId: string): boolean {
    return this.activeExecutions.get(executionId)?.status === 'aborted';
  }

  private getSink(): StepLogSink {
    if (!this.sink) {
      this.sink = new StorageLogSink(this.config.output_directory);
    }
    return this.sink;
  }

  private recordStepResult(
    execution: AttackChainExecution,
    step: AttackChainStep,
    status: StepResult['status'],
    startTime: Date,
    logsGenerated: number,
    errors?: string[]
  ): void {
    const endTime = new Date();
    this.stepResults.get(execution.executionId)?.push({
      step,
      status,
      start_time: startTime,
      end_time: endTime,
      duration: endTime.getTime() - startTime.getTime(),
      logs_generated: logsGenerated,
      ...(errors ? { errors } : {})
    });
  }

  /**
   * Validate step success criteria
   */
  private async validateStepSuccess(step: AttackChainStep, logsGenerated: number): Promise<void> {
    if (step.successCriteria!.minLogsGenerated > logsGenerated) {
      throw new Error(
        `Step success criteria not met: expected ${step.successCriteria!.minLogsGenerated} logs, got ${logsGenerated}`
      );
    }
    
    // TODO: Implement pattern matching for requiredPatterns
  }

  /**
   * Calculate actual delay with variance
   */
  private calculateActualDelay(baseDelay: number, variance: number): number {
    if (!this.config.randomize_timing || variance === 0) {
      return Math.round(baseDelay / this.config.speed_multiplier);
    }

    const varianceAmount = baseDelay * variance;
    const randomVariance = (Math.random() - 0.5) * 2 * varianceAmount;
    const actualDelay = baseDelay + randomVariance;
    
    return Math.round(Math.max(0, actualDelay) / this.config.speed_multiplier);
  }

  /**
   * Generate execution report
   */
  private async generateExecutionReport(chain: AttackChain, execution: AttackChainExecution): Promise<void> {
    // Ensure output directory exists
    const outputDir = this.config.output_directory || 'logs/attack-chains';
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const reportPath = path.join(outputDir, `${execution.executionId}-report.json`);
    const logPaths = execution.outputFiles?.logs || [];
    execution.outputFiles = { logs: logPaths, report: reportPath };

    const report: AttackChainReport = {
      execution,
      chain,
      step_results: this.stepResults.get(execution.executionId) || [],
      summary: {
        total_duration: execution.endTime!.getTime() - execution.startTime!.getTime(),
        success_rate: execution.stats.stepsCompleted / execution.totalSteps,
        total_logs_generated: execution.stats.logsGenerated,
        mitre_techniques_executed: chain.steps.map(s => s.mitre.technique),
        mitre_tactics_covered: [...new Set(chain.steps.map(s => s.mitre.tactic))]
      },
      output_files: {
        logs: logPaths,
        reports: [reportPath],
        artifacts: []
      }
    };

    // Write report to file
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logger.info(`Attack chain report generated: ${reportPath}`);
  }

  /**
   * Abort a running attack chain
   */
  public async abortChain(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`No active execution found with ID: ${executionId}`);
    }

    execution.status = 'aborted';
    execution.endTime = new Date();
    
    logger.info(`Attack chain aborted: ${executionId}`);
    this.emit('chain.aborted', execution);
  }

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): AttackChainExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * List all active executions
   */
  public getActiveExecutions(): AttackChainExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cleanup after execution
   */
  private async cleanup(execution: AttackChainExecution): Promise<void> {
    // Remove from active executions
    this.activeExecutions.delete(execution.executionId);
    
    logger.debug(`Cleaned up execution: ${execution.executionId}`);
  }
}
