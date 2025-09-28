import { LogEntry, ReplayConfig, HistoricalLogFile } from '../types';
import { StorageManager } from '../utils/storage';
import { logger } from '../utils/logger';
import { timestampValidator } from '../utils/timestampValidator';
import moment from 'moment';

export class ReplayManager {
  private config: ReplayConfig;
  private storageManager: StorageManager;
  private isReplaying: boolean = false;
  private replayTimeoutId?: NodeJS.Timeout;
  private currentReplayIndex: number = 0;
  private replayLogs: LogEntry[] = [];
  private replayStartTime?: moment.Moment;
  private originalStartTime?: moment.Moment;

  constructor(config: ReplayConfig, storageManager: StorageManager) {
    this.config = config;
    this.storageManager = storageManager;
  }

  public async startReplay(
    onLogReplayed: (log: LogEntry) => Promise<void>,
    historicalFile?: string
  ): Promise<void> {
    if (this.isReplaying) {
      logger.warn('Replay is already in progress');
      return;
    }

    if (!this.config.enabled) {
      logger.info('Replay is disabled in configuration');
      return;
    }

    try {
      await this.loadReplayLogs(historicalFile);
      
      if (this.replayLogs.length === 0) {
        logger.warn('No logs found for replay');
        return;
      }

      this.isReplaying = true;
      this.currentReplayIndex = 0;
      this.replayStartTime = moment();
      this.originalStartTime = moment(this.replayLogs[0].timestamp);

      logger.info(`Starting replay of ${this.replayLogs.length} logs at ${this.config.speed}x speed`);
      
      await this.scheduleNextReplay(onLogReplayed);
    } catch (error) {
      logger.error('Failed to start replay:', error);
      throw error;
    }
  }

  public stopReplay(): void {
    if (!this.isReplaying) {
      return;
    }

    this.isReplaying = false;
    if (this.replayTimeoutId) {
      clearTimeout(this.replayTimeoutId);
      this.replayTimeoutId = undefined;
    }

    logger.info('Stopped log replay');
  }

  private async loadReplayLogs(historicalFile?: string): Promise<void> {
    try {
      let logs: LogEntry[] = [];

      if (historicalFile) {
        // Load specific historical file
        logs = await this.storageManager.readHistoricalLogs(historicalFile);
      } else {
        // Load all historical files within the configured time range
        const historicalFiles = await this.storageManager.getHistoricalLogFiles();
        
        for (const file of historicalFiles) {
          if (this.isFileInTimeRange(file)) {
            const fileLogs = await this.storageManager.readHistoricalLogs(file.filename);
            logs.push(...fileLogs);
          }
        }
      }

      // Validate and fix timestamp issues in historical data
      const validation = timestampValidator.validateTimestamps(logs);
      if (!validation.isValid) {
        logger.warn(`Historical data has timestamp issues: ${validation.duplicateCount} duplicates, ${validation.invalidCount} invalid timestamps`);
        
        if (validation.duplicateCount > 0) {
          const { fixedLogs, fixedCount } = timestampValidator.fixDuplicateTimestamps(logs);
          logs = fixedLogs;
          logger.info(`Fixed ${fixedCount} duplicate timestamps in historical data`);
        }
      }

      // Apply filters
      logs = this.applyFilters(logs);

      // Sort by timestamp
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      this.replayLogs = logs;
      logger.info(`Loaded ${logs.length} logs for replay`);
    } catch (error) {
      logger.error('Failed to load replay logs:', error);
      throw error;
    }
  }

  private isFileInTimeRange(file: HistoricalLogFile): boolean {
    if (!this.config.startTime && !this.config.endTime) {
      return true;
    }

    const fileStart = moment(file.startTime);
    const fileEnd = moment(file.endTime);

    if (this.config.startTime) {
      const configStart = moment(this.config.startTime);
      if (fileEnd.isBefore(configStart)) {
        return false;
      }
    }

    if (this.config.endTime) {
      const configEnd = moment(this.config.endTime);
      if (fileStart.isAfter(configEnd)) {
        return false;
      }
    }

    return true;
  }

  private applyFilters(logs: LogEntry[]): LogEntry[] {
    let filteredLogs = logs;

    // Filter by sources
    if (this.config.filters?.sources && this.config.filters.sources.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        this.config.filters!.sources!.includes(log.source.name) ||
        this.config.filters!.sources!.includes(log.source.type)
      );
    }

    // Filter by levels
    if (this.config.filters?.levels && this.config.filters.levels.length > 0) {
      filteredLogs = filteredLogs.filter(log => 
        this.config.filters!.levels!.includes(log.level)
      );
    }

    // Filter by time range
    if (this.config.startTime) {
      const startTime = moment(this.config.startTime);
      filteredLogs = filteredLogs.filter(log => 
        moment(log.timestamp).isSameOrAfter(startTime)
      );
    }

    if (this.config.endTime) {
      const endTime = moment(this.config.endTime);
      filteredLogs = filteredLogs.filter(log => 
        moment(log.timestamp).isSameOrBefore(endTime)
      );
    }

    return filteredLogs;
  }

  private async scheduleNextReplay(onLogReplayed: (log: LogEntry) => Promise<void>): Promise<void> {
    if (!this.isReplaying || this.currentReplayIndex >= this.replayLogs.length) {
      if (this.config.loop && this.replayLogs.length > 0) {
        logger.info('Restarting replay loop');
        this.currentReplayIndex = 0;
        this.replayStartTime = moment();
        this.originalStartTime = moment(this.replayLogs[0].timestamp);
        
        // Add a small delay before restarting to prevent infinite recursion
        this.replayTimeoutId = setTimeout(() => {
          this.scheduleNextReplay(onLogReplayed);
        }, 100); // 100ms delay between loop iterations
      } else {
        logger.info('Replay completed');
        this.isReplaying = false;
      }
      return;
    }

    // Get batch size (default to 1 for backward compatibility)
    const batchSize = this.config.batchSize || 1;
    
    if (batchSize === 1) {
      // Original single-log processing for compatibility
      await this.processSingleLog(onLogReplayed);
    } else {
      // Batch processing for performance with timing
      await this.processBatchLogs(onLogReplayed, batchSize);
    }
  }

  private async processSingleLog(onLogReplayed: (log: LogEntry) => Promise<void>): Promise<void> {
    const currentLog = this.replayLogs[this.currentReplayIndex];
    const nextLog = this.replayLogs[this.currentReplayIndex + 1];

    // Update timestamp to current replay time
    const elapsedOriginalTime = moment(currentLog.timestamp).diff(this.originalStartTime!);
    const elapsedReplayTime = elapsedOriginalTime / this.config.speed;
    const replayTimestamp = this.replayStartTime!.clone().add(elapsedReplayTime, 'milliseconds');
    
    const replayLog: LogEntry = {
      ...currentLog,
      timestamp: replayTimestamp.toISOString(),
      metadata: {
        ...currentLog.metadata,
        replay: true,
        originalTimestamp: currentLog.timestamp,
        replaySpeed: this.config.speed
      }
    };

    try {
      await onLogReplayed(replayLog);
      this.currentReplayIndex++;

      // Calculate delay until next log
      let delay = 0;
      if (nextLog) {
        const originalDelay = moment(nextLog.timestamp).diff(moment(currentLog.timestamp));
        delay = originalDelay / this.config.speed;
        
        // Handle duplicate timestamps and ensure minimum delay
        if (delay <= 0) {
          // Duplicate or invalid timestamp detected
          delay = Math.max(10, 1000 / this.config.speed); // Minimum 10ms or based on speed
          logger.warn(`Duplicate timestamp detected in replay data: ${currentLog.timestamp} -> ${nextLog.timestamp}, using ${delay}ms delay`);
        }
        
        // Cap maximum delay to prevent appearing frozen (max 5 seconds)
        const maxDelay = 5000;
        if (delay > maxDelay) {
          logger.info(`Large delay detected (${Math.round(delay/1000)}s), capping to ${maxDelay/1000}s for better UX`);
          delay = maxDelay;
        }
      }
      
      // Schedule next replay iteration
      this.replayTimeoutId = setTimeout(() => {
        this.scheduleNextReplay(onLogReplayed);
      }, Math.max(delay, 1)); // Always use at least 1ms delay
    } catch (error) {
      logger.error('Error during log replay:', error);
      this.stopReplay();
    }
  }

  private async processBatchLogs(onLogReplayed: (log: LogEntry) => Promise<void>, batchSize: number): Promise<void> {
    try {
      const remainingLogs = this.replayLogs.length - this.currentReplayIndex;
      const actualBatchSize = Math.min(batchSize, remainingLogs);
      const batch = this.replayLogs.slice(this.currentReplayIndex, this.currentReplayIndex + actualBatchSize);
      
      // Process entire batch instantly
      const batchPromises = batch.map(async (currentLog, batchIndex) => {
        const globalIndex = this.currentReplayIndex + batchIndex;
        
        // Update timestamp to current replay time
        const elapsedOriginalTime = moment(currentLog.timestamp).diff(this.originalStartTime!);
        const elapsedReplayTime = elapsedOriginalTime / this.config.speed;
        const replayTimestamp = this.replayStartTime!.clone().add(elapsedReplayTime, 'milliseconds');
        
        const replayLog: LogEntry = {
          ...currentLog,
          timestamp: replayTimestamp.toISOString(),
          metadata: {
            ...currentLog.metadata,
            replay: true,
            originalTimestamp: currentLog.timestamp,
            replaySpeed: this.config.speed,
            batchIndex: batchIndex,
            batchSize: actualBatchSize
          }
        };

        return onLogReplayed(replayLog);
      });

      // Wait for all logs in the batch to be processed
      await Promise.all(batchPromises);
      
      // Update index after processing the entire batch
      this.currentReplayIndex += actualBatchSize;

      // Calculate delay for the entire batch based on time difference between first and last log
      let batchDelay = 0;
      if (actualBatchSize > 1) {
        const firstLog = batch[0];
        const lastLog = batch[actualBatchSize - 1];
        const originalBatchDuration = moment(lastLog.timestamp).diff(moment(firstLog.timestamp));
        batchDelay = originalBatchDuration / this.config.speed;
      }

      // If there's a next batch, calculate delay to the first log of next batch
      const nextLog = this.replayLogs[this.currentReplayIndex];
      if (nextLog) {
        const lastBatchLog = batch[actualBatchSize - 1];
        const originalDelay = moment(nextLog.timestamp).diff(moment(lastBatchLog.timestamp));
        const additionalDelay = originalDelay / this.config.speed;
        batchDelay += additionalDelay;
      }

      // Cap maximum batch delay to prevent appearing frozen (max 5 seconds)
      const maxBatchDelay = 5000;
      if (batchDelay > maxBatchDelay) {
        logger.info(`Large batch delay detected (${Math.round(batchDelay/1000)}s), capping to ${maxBatchDelay/1000}s for better UX`);
        batchDelay = maxBatchDelay;
      }

      // Ensure minimum delay and handle edge cases
      batchDelay = Math.max(batchDelay, 1); // Minimum 1ms delay
      
      logger.debug(`Processed batch of ${actualBatchSize} logs, next delay: ${batchDelay}ms`);
      
      // Schedule next batch
      this.replayTimeoutId = setTimeout(() => {
        this.scheduleNextReplay(onLogReplayed);
      }, batchDelay);
      
    } catch (error) {
      logger.error('Error during batch log replay:', error);
      this.stopReplay();
    }
  }


  public getReplayStatus(): {
    isReplaying: boolean;
    totalLogs: number;
    currentIndex: number;
    progress: number;
  } {
    return {
      isReplaying: this.isReplaying,
      totalLogs: this.replayLogs.length,
      currentIndex: this.currentReplayIndex,
      progress: this.replayLogs.length > 0 ? (this.currentReplayIndex / this.replayLogs.length) * 100 : 0
    };
  }

  public updateConfig(config: ReplayConfig): void {
    this.config = config;
    if (this.isReplaying && !config.enabled) {
      this.stopReplay();
    }
  }

  public async getAvailableHistoricalFiles(): Promise<HistoricalLogFile[]> {
    return this.storageManager.getHistoricalLogFiles();
  }
}
