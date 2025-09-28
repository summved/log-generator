import { Config, LogEntry } from './types';
import { ConfigManager } from './config';
import { StorageManager } from './utils/storage';
import { OutputManager } from './utils/outputManager';
import { ReplayManager } from './replay';
import { logger } from './utils/logger';
import { mitreMapper } from './utils/mitreMapper';
import { ConfigValidator } from './utils/configValidator';
import * as cron from 'node-cron';
import {
  EndpointGenerator,
  ApplicationGenerator,
  ServerGenerator,
  FirewallGenerator,
  CloudGenerator,
  AuthenticationGenerator,
  DatabaseGenerator,
  WebServerGenerator,
  EmailGenerator,
  BackupGenerator,
  MicroservicesGenerator,
  IoTGenerator,
  BaseGenerator
} from './generators';
import { HighPerformanceGenerator } from './generators/HighPerformanceGenerator';
import { WorkerPoolManager } from './workers/LogGeneratorWorker';
import { MetricsCollector } from './utils/metricsCollector';
import { HttpServer } from './utils/httpServer';

export interface MitreFilterOptions {
  technique?: string;
  tactic?: string;
  enabledOnly?: boolean;
}

export class LogGeneratorManager {
  private configManager: ConfigManager;
  private storageManager: StorageManager;
  private outputManager: OutputManager;
  private replayManager: ReplayManager;
  private generators: Map<string, BaseGenerator> = new Map();
  private workerPool?: WorkerPoolManager;
  private isRunning: boolean = false;
  private cleanupCron?: cron.ScheduledTask;
  private rotationCron?: cron.ScheduledTask;
  private mitreFilter?: MitreFilterOptions;
  private useWorkerThreads: boolean = false;
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
      config.storage.retention
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
    const config = this.configManager.getConfig();
    
    // Original generators
    this.generators.set('endpoint', new EndpointGenerator(config.generators.endpoint));
    this.generators.set('application', new ApplicationGenerator(config.generators.application));
    this.generators.set('server', new ServerGenerator(config.generators.server));
    this.generators.set('firewall', new FirewallGenerator(config.generators.firewall));
    this.generators.set('cloud', new CloudGenerator(config.generators.cloud));
    
    // New generators
    this.generators.set('authentication', new AuthenticationGenerator(
      { type: 'authentication', name: 'auth-service', host: 'auth-01' }, 
      config.generators.authentication
    ));
    this.generators.set('database', new DatabaseGenerator(
      { type: 'database', name: 'postgres-primary', host: 'db-01' }, 
      config.generators.database
    ));
    this.generators.set('webserver', new WebServerGenerator(
      { type: 'webserver', name: 'nginx-proxy', host: 'web-01' }, 
      config.generators.webserver
    ));
    this.generators.set('email', new EmailGenerator(
      { type: 'email', name: 'mail-server', host: 'mail-01' }, 
      config.generators.email
    ));
    this.generators.set('backup', new BackupGenerator(
      { type: 'backup', name: 'backup-service', host: 'backup-01' }, 
      config.generators.backup
    ));
    this.generators.set('microservices', new MicroservicesGenerator(
      { type: 'microservices', name: 'service-mesh', host: 'k8s-01' }, 
      config.generators.microservices
    ));
    this.generators.set('iot', new IoTGenerator(
      { type: 'iot', name: 'iot-hub', host: 'iot-01' }, 
      config.generators.iot
    ));
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

    // Start generators
    for (const [name, generator] of this.generators) {
      this.metricsCollector.setGeneratorActive(name, true);
      generator.start(async (logEntry) => {
        try {
          // Record metrics for each log
          this.metricsCollector.recordLogGenerated(logEntry);
          
          // Apply MITRE filtering if specified
          if (this.shouldIncludeLogEntry(logEntry)) {
            await this.outputManager.outputLog(logEntry);
          }
        } catch (error) {
          logger.error(`Failed to output log from ${name}:`, error);
          this.metricsCollector.recordError();
        }
      });
    }

    // Start cron jobs
    this.cleanupCron?.start();
    this.rotationCron?.start();

    logger.info('Log generator started successfully');
  }

  /**
   * Determines if a log entry should be included based on MITRE filtering options
   */
  private shouldIncludeLogEntry(logEntry: LogEntry): boolean {
    if (!this.mitreFilter) {
      return true; // No filtering applied
    }

    // If MITRE-enabled only filter is set, only include logs with MITRE data
    if (this.mitreFilter.enabledOnly && !logEntry.mitre) {
      return false;
    }

    // If specific technique filter is set
    if (this.mitreFilter.technique && logEntry.mitre) {
      if (logEntry.mitre.technique !== this.mitreFilter.technique) {
        return false;
      }
    }

    // If specific tactic filter is set
    if (this.mitreFilter.tactic && logEntry.mitre) {
      if (logEntry.mitre.tactic !== this.mitreFilter.tactic) {
        return false;
      }
    }

    return true;
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping log generator');
    this.isRunning = false;

    // Stop generators
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
   * Enable high-performance mode with worker threads
   */
  public enableHighPerformanceMode(workerCount: number = 4): void {
    this.useWorkerThreads = true;
    this.workerPool = new WorkerPoolManager(workerCount);
    logger.info(`High-performance mode enabled with ${workerCount} worker threads`);
  }

  /**
   * Disable high-performance mode and cleanup worker threads
   */
  public async disableHighPerformanceMode(): Promise<void> {
    this.useWorkerThreads = false;
    if (this.workerPool) {
      await this.workerPool.terminate();
      this.workerPool = undefined;
    }
    logger.info('High-performance mode disabled');
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    isHighPerformanceMode: boolean;
    workerThreadsActive: boolean;
    generatorCount: number;
    runningGenerators: string[];
  } {
    const runningGenerators: string[] = [];
    this.generators.forEach((generator, name) => {
      if ((generator as any).isRunning) {
        runningGenerators.push(name);
      }
    });

    return {
      isHighPerformanceMode: this.useWorkerThreads,
      workerThreadsActive: !!this.workerPool,
      generatorCount: this.generators.size,
      runningGenerators
    };
  }
}
