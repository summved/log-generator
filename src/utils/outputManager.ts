import * as fs from 'fs-extra';
import * as path from 'path';
import * as dgram from 'dgram';
const axios = require('axios');
import { LogEntry, Config } from '../types';
import { LogFormatters } from './formatters';
import { logger } from './logger';
import { StorageManager } from './storage';

export class OutputManager {
  private config: Config['output'];
  private storageManager: StorageManager;
  private fileStream?: fs.WriteStream;
  
  // Phase 1 Optimization: Batching and Buffer Management
  private logBuffer: string[] = [];
  private httpBuffer: { log: string; entry: LogEntry }[] = [];
  private syslogBuffer: string[] = [];
  private flushInterval?: NodeJS.Timeout;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private isShuttingDown: boolean = false;

  constructor(config: Config['output'], storageManager: StorageManager) {
    this.config = config;
    this.storageManager = storageManager;
    
    // Phase 1: Configure batching parameters
    this.maxBatchSize = (config as any).batching?.maxBatchSize || 100;
    this.flushIntervalMs = (config as any).batching?.flushIntervalMs || 1000;
    
    this.initializeOutput();
    
    // Only start periodic flush if batching is enabled
    if ((config as any).batching?.enabled) {
      this.startPeriodicFlush();
    }
  }

  private initializeOutput(): void {
    if (this.config.destination === 'file' && this.config.file) {
      const logDir = path.dirname(this.config.file.path);
      fs.ensureDirSync(logDir);
      
      // Phase 1: Enhanced stream configuration for better performance
      this.fileStream = fs.createWriteStream(this.config.file.path, { 
        flags: 'a',
        highWaterMark: 64 * 1024, // 64KB buffer for better performance
        autoClose: false // Keep stream open for better performance
      });
      
      // Handle stream errors
      this.fileStream.on('error', (error) => {
        logger.error('File stream error:', error);
      });
    }
  }

  public async outputLog(entry: LogEntry): Promise<void> {
    try {
      const formattedLog = this.formatLog(entry);
      
      // Phase 1: Use batching instead of immediate writes
      switch (this.config.destination) {
        case 'file':
          this.addToFileBuffer(formattedLog);
          break;
        case 'syslog':
          this.addToSyslogBuffer(formattedLog);
          break;
        case 'http':
          this.addToHttpBuffer(formattedLog, entry);
          break;
        case 'stdout':
          console.log(formattedLog); // stdout remains immediate
          break;
        default:
          logger.warn(`Unknown output destination: ${this.config.destination}`);
      }

      // Always store to local storage for historical purposes (batched separately)
      await this.storageManager.storeLog(entry);
    } catch (error) {
      logger.error('Failed to output log:', error);
      throw error;
    }
  }

  public async outputLogs(entries: LogEntry[]): Promise<void> {
    // Phase 1: Optimized batch processing
    for (const entry of entries) {
      await this.outputLog(entry);
    }
    // Force flush after batch processing
    await this.flushAllBuffers();
  }

  // Phase 1: New batching methods
  private addToFileBuffer(formattedLog: string): void {
    this.logBuffer.push(formattedLog);
    if (this.logBuffer.length >= this.maxBatchSize) {
      this.flushFileBuffer().catch(error => {
        logger.error('Failed to flush file buffer:', error);
      });
    }
  }

  private addToSyslogBuffer(formattedLog: string): void {
    this.syslogBuffer.push(formattedLog);
    if (this.syslogBuffer.length >= this.maxBatchSize) {
      this.flushSyslogBuffer().catch(error => {
        logger.error('Failed to flush syslog buffer:', error);
      });
    }
  }

  private addToHttpBuffer(formattedLog: string, entry: LogEntry): void {
    this.httpBuffer.push({ log: formattedLog, entry });
    if (this.httpBuffer.length >= this.maxBatchSize) {
      this.flushHttpBuffer().catch(error => {
        logger.error('Failed to flush HTTP buffer:', error);
      });
    }
  }

  // Phase 1: Enhanced streaming file operations
  private async flushFileBuffer(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.fileStream) {
      return;
    }

    const logsToWrite = this.logBuffer.splice(0); // Clear buffer atomically
    const batchData = logsToWrite.join('\n') + '\n';

    return new Promise((resolve, reject) => {
      this.fileStream!.write(batchData, (error) => {
        if (error) {
          logger.error(`Failed to write batch of ${logsToWrite.length} logs:`, error);
          reject(error);
        } else {
          logger.debug(`Successfully wrote batch of ${logsToWrite.length} logs`);
          resolve();
        }
      });
    });
  }

  // Phase 1: Batched syslog operations
  private async flushSyslogBuffer(): Promise<void> {
    if (this.syslogBuffer.length === 0 || !this.config.syslog) {
      return;
    }

    const logsToSend = this.syslogBuffer.splice(0); // Clear buffer atomically
    
    // Send logs in parallel for better performance
    const sendPromises = logsToSend.map(log => this.sendSyslogMessage(log));
    
    try {
      await Promise.all(sendPromises);
      logger.debug(`Successfully sent batch of ${logsToSend.length} syslog messages`);
    } catch (error) {
      logger.error(`Failed to send syslog batch of ${logsToSend.length} messages:`, error);
      throw error;
    }
  }

  // Phase 1: Batched HTTP operations
  private async flushHttpBuffer(): Promise<void> {
    if (this.httpBuffer.length === 0 || !this.config.http) {
      return;
    }

    const logsToSend = this.httpBuffer.splice(0); // Clear buffer atomically
    
    try {
      // Send as a batch to reduce HTTP overhead
      const batchPayload = logsToSend.map(item => 
        this.config.format === 'json' ? 
          JSON.parse(item.log) : 
          { message: item.log, original: item.entry }
      );

      await axios.post(this.config.http.url, { 
        logs: batchPayload,
        count: batchPayload.length,
        timestamp: new Date().toISOString()
      }, {
        headers: this.config.http.headers || {},
        timeout: 10000 // Increased timeout for batch operations
      });
      
      logger.debug(`Successfully sent batch of ${logsToSend.length} HTTP logs`);
    } catch (error) {
      logger.error(`Failed to send HTTP batch of ${logsToSend.length} logs:`, error);
      throw error;
    }
  }

  // Helper method for individual syslog messages (used by batch)
  private async sendSyslogMessage(formattedLog: string): Promise<void> {
    if (!this.config.syslog) {
      throw new Error('Syslog configuration not provided');
    }

    return new Promise((resolve, reject) => {
      const socketType = this.config.syslog!.protocol === 'tcp' ? 'udp4' : 'udp4';
      const client = dgram.createSocket(socketType);
      const message = Buffer.from(formattedLog);

      client.send(
        message,
        0,
        message.length,
        this.config.syslog!.port,
        this.config.syslog!.host,
        (error) => {
          client.close();
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Phase 1: Periodic buffer flushing
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        try {
          await this.flushAllBuffers();
        } catch (error) {
          logger.error('Failed to flush buffers during periodic flush:', error);
        }
      }
    }, this.flushIntervalMs);
  }

  // Phase 1: Flush all buffers
  private async flushAllBuffers(): Promise<void> {
    const flushPromises = [
      this.flushFileBuffer(),
      this.flushSyslogBuffer(),
      this.flushHttpBuffer()
    ];

    try {
      await Promise.all(flushPromises);
    } catch (error) {
      logger.error('Failed to flush one or more buffers:', error);
      throw error;
    }
  }

  private formatLog(entry: LogEntry): string {
    switch (this.config.format) {
      case 'json':
        return LogFormatters.formatAsJSON(entry);
      case 'syslog':
        return LogFormatters.formatAsSyslog(entry);
      case 'cef':
        return LogFormatters.formatAsCEF(entry);
      case 'wazuh':
        return LogFormatters.formatForWazuh(entry);
      default:
        return LogFormatters.formatAsJSON(entry);
    }
  }

  // Phase 1: Legacy method - now redirects to batching
  private async outputToFile(formattedLog: string): Promise<void> {
    // This method is kept for compatibility but now uses batching
    this.addToFileBuffer(formattedLog);
  }

  // Phase 1: Legacy method - now redirects to batching
  private async outputToSyslog(formattedLog: string): Promise<void> {
    // This method is kept for compatibility but now uses batching
    this.addToSyslogBuffer(formattedLog);
  }

  // Phase 1: Legacy method - now redirects to batching
  private async outputToHttp(formattedLog: string, originalEntry: LogEntry): Promise<void> {
    // This method is kept for compatibility but now uses batching
    this.addToHttpBuffer(formattedLog, originalEntry);
  }

  public async rotateLogFile(): Promise<void> {
    if (this.config.destination === 'file' && this.fileStream) {
      this.fileStream.end();
      
      // Rotate current logs to historical
      await this.storageManager.rotateCurrentLogs();
      
      // Reinitialize file stream
      this.initializeOutput();
    }
  }

  public async close(): Promise<void> {
    // Phase 1: Enhanced cleanup with buffer flushing
    this.isShuttingDown = true;
    
    // Stop periodic flushing
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
    
    try {
      // Flush all remaining buffers before closing
      await this.flushAllBuffers();
      logger.info('All buffers flushed during shutdown');
    } catch (error) {
      logger.error('Failed to flush buffers during shutdown:', error);
    }
    
    // Close file stream
    if (this.fileStream) {
      return new Promise((resolve) => {
        this.fileStream!.end(() => {
          logger.info('File stream closed successfully');
          resolve();
        });
      });
    }
  }

  public updateConfig(config: Config['output']): void {
    this.config = config;
    if (this.fileStream) {
      this.fileStream.end();
    }
    this.initializeOutput();
  }
}
