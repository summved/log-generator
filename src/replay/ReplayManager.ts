import { LogEntry, ReplayConfig, HistoricalLogFile } from '../types';
import { StorageManager } from '../utils/storage';
import { logger } from '../utils/logger';
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
        
        // Handle duplicate timestamps by adding a minimum delay
        if (delay <= 0) {
          delay = 10; // Minimum 10ms delay for duplicate timestamps
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
