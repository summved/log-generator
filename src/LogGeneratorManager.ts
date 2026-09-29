import { Config, LogEntry } from './types';
import { matchesMitreFilter, MitreFilterOptions } from './utils/mitreFilter';
import { ConfigManager } from './config';
import { StorageManager } from './utils/storage';
import { OutputManager } from './utils/outputManager';
import { ReplayManager } from './replay';
import { logger } from './utils/logger';
import { ConfigValidator } from './utils/configValidator';
import * as cron from 'node-cron';
import { BaseGenerator } from './generators';
import { createGenerators } from './generators/createGenerators';
import { GenerationWorkers } from './workers/GenerationWorkers';
import { Backpressure } from './workers/backpressure';

const MAX_PENDING_OUTPUTS = 50000;
import { MetricsCollector } from './utils/metricsCollector';
import { HttpServer } from './utils/httpServer';

export type { MitreFilterOptions };

export class LogGeneratorManager {
  private configManager: ConfigManager;
  private storageManager: StorageManager;
  private outputManager: OutputManager;
  private replayManager: ReplayManager;
  private generators: Map<string, BaseGenerator> = new Map();
  private generationWorkers?: GenerationWorkers;
  private workerCount: number = 1;
  /** Main-thread generators pause while this many logs are still being written, so memory stays bounded */
  private outputPressure = new Backpressure(MAX_PENDING_OUTPUTS,
    () => this.generators.forEach(generator => generator.pause()),
    () => this.generators.forEach(generator => generator.resume()));
  private isRunning: boolean = false;
  private cleanupCron?: cron.ScheduledTask;
  private rotationCron?: cron.ScheduledTask;
  private mitreFilter?: MitreFilterOptions;
  private metricsCollector: MetricsCollector;
  private httpServer?: HttpServer;

  constructor(configPath?: string, mitreFilter?: MitreFilterOptions) {
    this.configManager = new ConfigManager(configPath);
    const config = this.configManager.getConfig();
    this.mitreFilter = mitreFilter;
    
    // Validate configuration - Advisory only, does not block execution
    const validationResult = ConfigValidator.validateConfig(config);
    ConfigValidator.logValidationResults(validationResult);
    
    // Only block if there are actual configuration errors (missing required fields, etc.)
    // Performance warnings are advisory and don't prevent execution
    const criticalErrors = validationResult.errors.filter(error => 
      !error.includes('frequency') && !error.includes('batch size') && !error.includes('flush interval')
    );
    
    if (criticalErrors.length > 0) {
      throw new Error(`Critical configuration errors: ${criticalErrors.join(', ')}`);
    }
    
    this.storageManager = new StorageManager(
      config.storage.currentPath,
      config.storage.historicalPath,
      config.storage.retention,
      { history: config.storage.history }
    );
    
    this.outputManager = new OutputManager(config.output, this.storageManager);
    this.replayManager = new ReplayManager(config.replay, this.storageManager);
    this.metricsCollector = MetricsCollector.getInstance();
    
    this.initializeGenerators();
    this.setupCronJobs();
    
    // Only setup HTTP server if monitoring is enabled (default: true)
    const enableMonitoring = process.env.ENABLE_MONITORING !== 'false';
    if (enableMonitoring) {
      this.setupHttpServer();
    }
  }

  private initializeGenerators(): void {
    this.generators = createGenerators(this.configManager.getConfig().generators);
  }

  private setupCronJobs(): void {
    // Daily cleanup at 2 AM
    this.cleanupCron = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running daily log cleanup');
        await this.storageManager.cleanupOldLogs();
      } catch (error) {
        logger.error('Failed to run daily cleanup:', error);
      }
    }, { timezone: 'UTC' });

    // Daily rotation at 1 AM
    this.rotationCron = cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('Running daily log rotation');
        await this.outputManager.rotateLogFile();
      } catch (error) {
        logger.error('Failed to run daily rotation:', error);
      }
    }, { timezone: 'UTC' });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Log generator is already running');
      return;
    }

    logger.info('Starting log generator');
    this.isRunning = true;

    // Start HTTP server for metrics
    if (this.httpServer) {
      try {
        await this.httpServer.start();
      } catch (error) {
        logger.error('Failed to start HTTP server:', error);
      }
    }

    // Start generators, in worker threads when high-performance mode is enabled
    if (this.workerCount > 1) {
      const workers = new GenerationWorkers(this.workerCount);
      try {
        await workers.start(this.configManager.getConfig().generators, logs => Promise.all(logs.map(log => this.handleLog(log))));
      } catch (error) {
        this.isRunning = false;
        throw error;
      }
      this.generationWorkers = workers;
      for (const name of this.enabledGeneratorNames()) this.metricsCollector.setGeneratorActive(name, true);
    } else {
      for (const [name, generator] of this.generators) {
        this.metricsCollector.setGeneratorActive(name, true);
        generator.start(logEntry => { void this.handleLog(logEntry); });
      }
    }

    // Start cron jobs
    this.cleanupCron?.start();
    this.rotationCron?.start();

    logger.info('Log generator started successfully');
  }

  /**
   * Metrics, MITRE filtering and output for one generated log (from the main thread or a worker).
   * Resolves when the log is written; errors are logged and counted, never thrown.
   */
  private handleLog(logEntry: LogEntry): Promise<void> {
    this.metricsCollector.recordLogGenerated(logEntry);
    if (!this.shouldIncludeLogEntry(logEntry)) return Promise.resolve();
    return this.outputPressure.track(this.outputManager.outputLog(logEntry)).catch(error => {
      logger.error(`Failed to output log from ${logEntry.source.name}:`, error);
      this.metricsCollector.recordError();
    });
  }

  private enabledGeneratorNames(): string[] {
    const generators = this.configManager.getConfig().generators;
    return [...this.generators.keys()].filter(name => generators[name as keyof Config['generators']]?.enabled);
  }

  /** Whether a log passes the MITRE filter (a technique or tactic filter never lets unmapped logs through) */
  private shouldIncludeLogEntry(logEntry: LogEntry): boolean {
    return matchesMitreFilter(logEntry, this.mitreFilter);
  }


  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping log generator');
    this.isRunning = false;

    // Stop generators (worker threads first, which hand over their last logs)
    if (this.generationWorkers) {
      await this.generationWorkers.stop();
      this.generationWorkers = undefined;
    }
    for (const [name, generator] of this.generators) {
      generator.stop();
      this.metricsCollector.setGeneratorActive(name, false);
    }

    // Stop HTTP server
    if (this.httpServer) {
      try {
        await this.httpServer.stop();
      } catch (error) {
        logger.error('Failed to stop HTTP server:', error);
      }
    }

    // Stop replay if running
    this.replayManager.stopReplay();

    // Stop cron jobs
    this.cleanupCron?.stop();
    this.rotationCron?.stop();

    // Close output manager
    await this.outputManager.close();

    logger.info('Log generator stopped');
  }

  public async startReplay(historicalFile?: string): Promise<void> {
    logger.info(`Starting log replay${historicalFile ? ` from file: ${historicalFile}` : ''}`);
    
    await this.replayManager.startReplay(async (logEntry) => {
      await this.outputManager.outputLog(logEntry);
    }, historicalFile);
  }

  public stopReplay(): void {
    this.replayManager.stopReplay();
  }

  public getReplayStatus() {
    return this.replayManager.getReplayStatus();
  }

  public async getHistoricalFiles() {
    return this.replayManager.getAvailableHistoricalFiles();
  }

  public getGeneratorStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    for (const [name, generator] of this.generators) {
      status[name] = generator.isGeneratorRunning();
    }
    return status;
  }

  public updateConfig(configUpdates: Partial<Config>): void {
    this.configManager.updateConfig(configUpdates);
    const newConfig = this.configManager.getConfig();

    // Update managers with new config
    this.outputManager.updateConfig(newConfig.output);
    this.replayManager.updateConfig(newConfig.replay);

    // Update generators
    for (const [name, generator] of this.generators) {
      const generatorConfig = newConfig.generators[name as keyof Config['generators']];
      if (generatorConfig) {
        generator.updateConfig(generatorConfig);
      }
    }

    logger.info('Configuration updated');
  }

  public getConfig(): Config {
    return this.configManager.getConfig();
  }

  public async saveConfig(configPath?: string): Promise<void> {
    this.configManager.saveConfig(configPath);
    logger.info(`Configuration saved${configPath ? ` to ${configPath}` : ''}`);
  }

  public async rotateLogsManually(): Promise<void> {
    logger.info('Manual log rotation triggered');
    await this.outputManager.rotateLogFile();
  }

  public async cleanupLogsManually(): Promise<void> {
    logger.info('Manual log cleanup triggered');
    await this.storageManager.cleanupOldLogs();
  }

  private setupHttpServer(): void {
    const port = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000;
    this.httpServer = new HttpServer(port);
  }

  /**
   * Generate in `workerCount` worker threads from the next start(). Each thread runs every
   * generator at 1/workerCount of its configured rate, so the total rate stays the same.
   */
  public enableHighPerformanceMode(workerCount: number = 4): void {
    if (this.isRunning) {
      throw new Error('Stop the log generator before changing the number of worker threads');
    }
    this.workerCount = Math.max(1, Math.floor(workerCount));
    logger.info(`High-performance mode enabled with ${this.workerCount} worker threads`);
  }

  /** Generate on the main thread again from the next start() */
  public async disableHighPerformanceMode(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Stop the log generator before changing the number of worker threads');
    }
    this.workerCount = 1;
    logger.info('High-performance mode disabled');
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    isHighPerformanceMode: boolean;
    workerThreadsActive: boolean;
    workerThreads: number;
    generatorCount: number;
    runningGenerators: string[];
  } {
    const runningGenerators = this.generationWorkers
      ? this.enabledGeneratorNames()
      : [...this.generators].filter(([, generator]) => generator.isGeneratorRunning()).map(([name]) => name);

    return {
      isHighPerformanceMode: this.workerCount > 1,
      workerThreadsActive: !!this.generationWorkers,
      workerThreads: this.generationWorkers?.size ?? 0,
      generatorCount: this.generators.size,
      runningGenerators
    };
  }
}
