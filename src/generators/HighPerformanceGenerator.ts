/**
 * High-Performance Log Generator
 * Uses worker threads and memory-first approach for maximum throughput
 * Maintains SIEM compatibility with JSON output
 */

import { LogEntry, LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';
import { WorkerPoolManager } from '../workers/LogGeneratorWorker';
import { logger } from '../utils/logger';

export class HighPerformanceGenerator extends BaseGenerator {
  private workerPool: WorkerPoolManager;
  private memoryBuffer: LogEntry[] = [];
  private readonly maxBufferSize: number;
  private flushCallback?: (log: LogEntry) => void;
  private highPerfIntervalId?: NodeJS.Timeout;
  
  constructor(source: LogSource, config: GeneratorConfig, workerCount: number = 4) {
    super(source, config);
    this.workerPool = new WorkerPoolManager(workerCount);
    this.maxBufferSize = 10000; // Large memory buffer
  }
  
  /**
   * Enhanced start method with worker thread support
   */
  public start(onLogGenerated: (log: LogEntry) => void): void {
    if (this.isRunning) {
      logger.warn(`Generator for ${this.source.name} is already running`);
      return;
    }
    
    this.isRunning = true;
    this.flushCallback = onLogGenerated;
    
    // Calculate optimal batch configuration for high performance
    const batchConfig = this.calculateHighPerformanceBatchConfig();
    
    logger.info(
      `Starting high-performance generator for ${this.source.name} with frequency ${this.config.frequency} logs/min ` +
      `(batch: ${batchConfig.logsPerBatch} logs every ${batchConfig.intervalMs}ms, ${batchConfig.workersUsed} workers)`
    );
    
    // Start high-frequency generation with worker threads
    this.highPerfIntervalId = setInterval(async () => {
      try {
        await this.generateBatchWithWorkers(batchConfig);
      } catch (error) {
        logger.error(`Error in high-performance batch generation for ${this.source.name}:`, error);
      }
    }, batchConfig.intervalMs);
  }
  
  /**
   * Generate logs using worker thread pool
   */
  private async generateBatchWithWorkers(batchConfig: {
    logsPerBatch: number;
    intervalMs: number;
    workersUsed: number;
  }): Promise<void> {
    const templates = this.config.templates || [{
      level: 'INFO' as const,
      messageTemplate: 'Default log message from {source}',
      probability: 1.0,
      metadata: { component: 'high-performance-generator' }
    }];
    
    // Generate logs in parallel using worker threads
    const logs = await this.workerPool.generateLogsParallel(
      this.source,
      templates,
      batchConfig.logsPerBatch
    );
    
    // Add to memory buffer
    this.memoryBuffer.push(...logs);
    
    // Flush buffer if it's getting large
    if (this.memoryBuffer.length >= this.maxBufferSize) {
      await this.flushMemoryBuffer();
    }
  }
  
  /**
   * Calculate optimal batch configuration for high performance
   */
  private calculateHighPerformanceBatchConfig(): {
    logsPerBatch: number;
    intervalMs: number;
    workersUsed: number;
  } {
    const targetFrequency = this.config.frequency || 60; // logs/minute
    const targetLogsPerSecond = targetFrequency / 60;
    
    let intervalMs: number;
    let workersUsed: number;
    
    if (targetLogsPerSecond <= 100) {
      // Low rate: Single worker, longer intervals
      intervalMs = 100;
      workersUsed = 1;
    } else if (targetLogsPerSecond <= 1000) {
      // Medium rate: 2 workers, medium intervals
      intervalMs = 50;
      workersUsed = 2;
    } else if (targetLogsPerSecond <= 5000) {
      // High rate: 4 workers, short intervals
      intervalMs = 20;
      workersUsed = 4;
    } else {
      // Extreme rate: All workers, minimum intervals
      intervalMs = 10;
      workersUsed = 4;
    }
    
    // Calculate logs per batch to achieve target frequency
    const batchesPerSecond = 1000 / intervalMs;
    const logsPerBatch = Math.max(1, Math.round(targetLogsPerSecond / batchesPerSecond));
    
    return {
      logsPerBatch,
      intervalMs,
      workersUsed
    };
  }
  
  /**
   * Flush memory buffer to output
   */
  private async flushMemoryBuffer(): Promise<void> {
    if (this.memoryBuffer.length === 0 || !this.flushCallback) {
      return;
    }
    
    const logsToFlush = this.memoryBuffer.splice(0); // Clear buffer atomically
    
    // Send logs in batches to avoid overwhelming the output system
    const batchSize = 1000;
    for (let i = 0; i < logsToFlush.length; i += batchSize) {
      const batch = logsToFlush.slice(i, i + batchSize);
      
      // Process batch asynchronously
      setImmediate(() => {
        batch.forEach(log => {
          if (this.flushCallback) {
            this.flushCallback(log);
          }
        });
      });
    }
    
    logger.debug(`Flushed ${logsToFlush.length} logs from memory buffer`);
  }
  
  /**
   * Enhanced stop method with proper cleanup
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.highPerfIntervalId) {
      clearInterval(this.highPerfIntervalId);
      this.highPerfIntervalId = undefined;
    }
    
    // Flush remaining logs
    this.flushMemoryBuffer().then(() => {
      logger.info(`Stopped high-performance generator for ${this.source.name}`);
    });
  }
  
  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stop();
    await this.flushMemoryBuffer();
    await this.workerPool.terminate();
  }
  
  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    bufferSize: number;
    maxBufferSize: number;
    bufferUtilization: number;
  } {
    return {
      bufferSize: this.memoryBuffer.length,
      maxBufferSize: this.maxBufferSize,
      bufferUtilization: (this.memoryBuffer.length / this.maxBufferSize) * 100
    };
  }
}
