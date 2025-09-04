import { LogEntry } from '../types';
import moment from 'moment';

export class LogFormatters {
  public static formatAsJSON(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  public static formatAsSyslog(entry: LogEntry): string {
    const priority = this.calculateSyslogPriority(entry.level);
    const timestamp = moment(entry.timestamp).format('MMM DD HH:mm:ss');
    const hostname = entry.source.host || 'localhost';
    const tag = `${entry.source.name}[${entry.source.component || 'main'}]`;
    
    return `<${priority}>${timestamp} ${hostname} ${tag}: ${entry.message}`;
  }

  public static formatAsCEF(entry: LogEntry): string {
    const deviceVendor = 'LogGenerator';
    const deviceProduct = 'LogGen';
    const deviceVersion = '1.0';
    const signatureId = entry.source.type.toUpperCase();
    const name = entry.message.substring(0, 50);
    const severity = this.mapLevelToCEFSeverity(entry.level);
    
    const extensions = Object.entries(entry.metadata)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    
    return `CEF:0|${deviceVendor}|${deviceProduct}|${deviceVersion}|${signatureId}|${name}|${severity}|${extensions}`;
  }

  public static formatForWazuh(entry: LogEntry): string {
    // Ensure source exists and has required properties
    const source = entry.source || { type: 'unknown', name: 'unknown' };
    
    const wazuhEntry = {
      timestamp: entry.timestamp,
      agent: {
        name: source.host || source.name || 'log-generator',
        id: '001'
      },
      rule: {
        level: this.mapLevelToWazuhLevel(entry.level),
        description: entry.message || 'No message',
        groups: [source.type, source.component || 'general']
      },
      decoder: {
        name: source.type
      },
      data: {
        ...entry.metadata,
        original_message: entry.message || 'No message',
        log_source: source.name
      },
      location: source.name,
      full_log: entry.raw || entry.message
    };

    return JSON.stringify(wazuhEntry);
  }

  private static calculateSyslogPriority(level: LogEntry['level']): number {
    const facility = 16; // local0
    const severityMap = {
      'CRITICAL': 2,
      'ERROR': 3,
      'WARN': 4,
      'INFO': 6,
      'DEBUG': 7
    };
    
    return facility * 8 + severityMap[level];
  }

  private static mapLevelToCEFSeverity(level: LogEntry['level']): number {
    const severityMap = {
      'CRITICAL': 10,
      'ERROR': 7,
      'WARN': 5,
      'INFO': 3,
      'DEBUG': 1
    };
    
    return severityMap[level];
  }

  private static mapLevelToWazuhLevel(level: LogEntry['level']): number {
    const levelMap = {
      'DEBUG': 1,
      'INFO': 3,
      'WARN': 5,
      'ERROR': 7,
      'CRITICAL': 10
    };
    
    return levelMap[level];
  }
}
