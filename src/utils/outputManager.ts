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

  constructor(config: Config['output'], storageManager: StorageManager) {
    this.config = config;
    this.storageManager = storageManager;
    this.initializeOutput();
  }

  private initializeOutput(): void {
    if (this.config.destination === 'file' && this.config.file) {
      const logDir = path.dirname(this.config.file.path);
      fs.ensureDirSync(logDir);
      
      this.fileStream = fs.createWriteStream(this.config.file.path, { flags: 'a' });
    }
  }

  public async outputLog(entry: LogEntry): Promise<void> {
    try {
      const formattedLog = this.formatLog(entry);
      
      switch (this.config.destination) {
        case 'file':
          await this.outputToFile(formattedLog);
          break;
        case 'syslog':
          await this.outputToSyslog(formattedLog);
          break;
        case 'http':
          await this.outputToHttp(formattedLog, entry);
          break;
        case 'stdout':
          console.log(formattedLog);
          break;
        default:
          logger.warn(`Unknown output destination: ${this.config.destination}`);
      }

      // Always store to local storage for historical purposes
      await this.storageManager.storeLog(entry);
    } catch (error) {
      logger.error('Failed to output log:', error);
      throw error;
    }
  }

  public async outputLogs(entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.outputLog(entry);
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

  private async outputToFile(formattedLog: string): Promise<void> {
    if (!this.fileStream) {
      throw new Error('File stream not initialized');
    }

    return new Promise((resolve, reject) => {
      this.fileStream!.write(formattedLog + '\n', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async outputToSyslog(formattedLog: string): Promise<void> {
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

  private async outputToHttp(formattedLog: string, originalEntry: LogEntry): Promise<void> {
    if (!this.config.http) {
      throw new Error('HTTP configuration not provided');
    }

    try {
      const payload = this.config.format === 'json' ? 
        JSON.parse(formattedLog) : 
        { message: formattedLog, original: originalEntry };

      await axios.post(this.config.http.url, payload, {
        headers: this.config.http.headers || {},
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send log via HTTP:', error);
      throw error;
    }
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
    if (this.fileStream) {
      return new Promise((resolve) => {
        this.fileStream!.end(() => {
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
