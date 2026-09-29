import * as winston from 'winston';
import * as path from 'path';

export class Logger {
  private static instance: winston.Logger;

  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: 'log-generator' },
        transports: [
          new winston.transports.File({ 
            filename: path.join('logs', 'error.log'), 
            level: 'error' 
          }),
          new winston.transports.File({ 
            filename: path.join('logs', 'combined.log') 
          }),
          // stderr, so stdout carries only generated logs (destination: stdout) and command output
          new winston.transports.Console({
            stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          })
        ]
      });
    }
    return Logger.instance;
  }
}

export const logger = Logger.getInstance();
