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
          new winston.transports.Console({
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
