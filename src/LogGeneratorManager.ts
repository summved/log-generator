import { Config } from './types';
import { ConfigManager } from './config';
import { StorageManager } from './utils/storage';
import { OutputManager } from './utils/outputManager';
import { ReplayManager } from './replay';
import { logger } from './utils/logger';
import * as cron from 'node-cron';
import {
  EndpointGenerator,
  ApplicationGenerator,
  ServerGenerator,
  FirewallGenerator,
  CloudGenerator,
  BaseGenerator
} from './generators';

export class LogGeneratorManager {
  private configManager: ConfigManager;
  private storageManager: StorageManager;
  private outputManager: OutputManager;
  private replayManager: ReplayManager;
  private generators: Map<string, BaseGenerator> = new Map();
  private isRunning: boolean = false;
  private cleanupCron?: cron.ScheduledTask;
  private rotationCron?: cron.ScheduledTask;

  constructor(configPath?: string) {
    this.configManager = new ConfigManager(configPath);
    const config = this.configManager.getConfig();
    
    this.storageManager = new StorageManager(
      config.storage.currentPath,
      config.storage.historicalPath,
      config.storage.retention
    );
    
    this.outputManager = new OutputManager(config.output, this.storageManager);
    this.replayManager = new ReplayManager(config.replay, this.storageManager);
    
    this.initializeGenerators();
    this.setupCronJobs();
  }

  private initializeGenerators(): void {
    const config = this.configManager.getConfig();
    
    this.generators.set('endpoint', new EndpointGenerator(config.generators.endpoint));
    this.generators.set('application', new ApplicationGenerator(config.generators.application));
    this.generators.set('server', new ServerGenerator(config.generators.server));
    this.generators.set('firewall', new FirewallGenerator(config.generators.firewall));
    this.generators.set('cloud', new CloudGenerator(config.generators.cloud));
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
    }, { scheduled: false });

    // Daily rotation at 1 AM
    this.rotationCron = cron.schedule('0 1 * * *', async () => {
      try {
        logger.info('Running daily log rotation');
        await this.outputManager.rotateLogFile();
      } catch (error) {
        logger.error('Failed to run daily rotation:', error);
      }
    }, { scheduled: false });
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Log generator is already running');
      return;
    }

    logger.info('Starting log generator');
    this.isRunning = true;

    // Start generators
    for (const [name, generator] of this.generators) {
      generator.start(async (logEntry) => {
        try {
          await this.outputManager.outputLog(logEntry);
        } catch (error) {
          logger.error(`Failed to output log from ${name}:`, error);
        }
      });
    }

    // Start cron jobs
    this.cleanupCron?.start();
    this.rotationCron?.start();

    logger.info('Log generator started successfully');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping log generator');
    this.isRunning = false;

    // Stop generators
    for (const generator of this.generators.values()) {
      generator.stop();
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
}
