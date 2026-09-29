import { Config, LogEntry } from '../types';
import moment from 'moment';

export type LogFormat = Config['output']['format'];

export const LOG_FORMATS: LogFormat[] = ['json', 'syslog', 'cef', 'wazuh'];

export interface SyslogFormatOptions {
  /** Facility name (local0, auth, daemon, ...) or number 0-23 (default local0) */
  facility?: string | number;
  /** APP-NAME / tag; default is the source name (RFC 3164 adds [component]) */
  tag?: string;
  /** RFC3164 (default) or RFC5424 */
  timestampFormat?: string;
  /** RFC 5424 only: add MITRE ATT&CK data as structured data */
  structuredData?: boolean;
}

export interface FormatOptions {
  syslog?: SyslogFormatOptions;
}

const SYSLOG_FACILITIES: Record<string, number> = {
  kern: 0, user: 1, mail: 2, daemon: 3, auth: 4, syslog: 5, lpr: 6, news: 7, uucp: 8, cron: 9, authpriv: 10, ftp: 11,
  ntp: 12, security: 13, console: 14, solaris: 15, local0: 16, local1: 17, local2: 18, local3: 19, local4: 20,
  local5: 21, local6: 22, local7: 23
};
const SYSLOG_SEVERITY: Record<LogEntry['level'], number> = { CRITICAL: 2, ERROR: 3, WARN: 4, INFO: 6, DEBUG: 7 };
/** Private enterprise number 32473 is reserved by IANA for documentation and examples */
const SD_ID = 'mitre@32473';
const CEF_NAME_MAX = 512;
const CEF_KEY = /^[A-Za-z0-9_]+$/;

export function syslogFacility(value: string | number | undefined): number {
  if (value === undefined) return SYSLOG_FACILITIES.local0;
  const facility = typeof value === 'number' ? value : (SYSLOG_FACILITIES[value.toLowerCase()] ?? Number(value));
  if (!Number.isInteger(facility) || facility < 0 || facility > 23) {
    throw new Error(`Unknown syslog facility "${value}". Use a name such as local0 or auth, or a number 0-23`);
  }
  return facility;
}

const oneLine = (text: string): string => text.replace(/\r?\n/g, ' ');
/** CEF header fields: escape \ and | */
const cefHeader = (text: string): string => oneLine(text).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
/** CEF extension values: escape \, = and line breaks */
const cefValue = (value: unknown): string => {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  return text.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/\r?\n/g, '\\n');
};
/** RFC 5424 structured data values: escape ", \ and ] */
const sdValue = (text: string): string => text.replace(/["\\\]]/g, match => `\\${match}`);

export class LogFormatters {
  /** Format a log for the configured output format (JSON for anything unknown) */
  public static format(format: LogFormat, entry: LogEntry, options: FormatOptions = {}): string {
    switch (format) {
      case 'syslog':
        return LogFormatters.formatAsSyslog(entry, options.syslog);
      case 'cef':
        return LogFormatters.formatAsCEF(entry);
      case 'wazuh':
        return LogFormatters.formatForWazuh(entry);
      default:
        return LogFormatters.formatAsJSON(entry);
    }
  }

  public static formatAsJSON(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  public static formatAsSyslog(entry: LogEntry, options: SyslogFormatOptions = {}): string {
    const priority = syslogFacility(options.facility) * 8 + SYSLOG_SEVERITY[entry.level];
    const hostname = entry.source.host || 'localhost';
    const message = oneLine(entry.message);

    if (String(options.timestampFormat).toUpperCase() === 'RFC5424') {
      const app = options.tag || entry.source.name;
      const msgId = entry.source.component || '-';
      const sd = options.structuredData && entry.mitre
        ? `[${SD_ID} technique="${sdValue(entry.mitre.technique)}" tactic="${sdValue(entry.mitre.tactic)}"]`
        : '-';
      return `<${priority}>1 ${entry.timestamp} ${hostname} ${app} - ${msgId} ${sd} ${message}`;
    }

    const timestamp = moment(entry.timestamp).format('MMM DD HH:mm:ss');
    const tag = options.tag || `${entry.source.name}[${entry.source.component || 'main'}]`;
    return `<${priority}>${timestamp} ${hostname} ${tag}: ${message}`;
  }

  public static formatAsCEF(entry: LogEntry): string {
    const severity = this.mapLevelToCEFSeverity(entry.level);
    const header = ['CEF:0', 'LogGenerator', 'LogGen', '1.0', entry.source.type.toUpperCase(), oneLine(entry.message).slice(0, CEF_NAME_MAX), String(severity)]
      .map((field, index) => (index === 0 ? field : cefHeader(field)));

    const fields: [string, unknown][] = [
      ['rt', Date.parse(entry.timestamp)],
      ['dvchost', entry.source.host || entry.source.name],
      ['msg', entry.message],
      ...(entry.mitre ? [['cs1Label', 'mitreTechnique'], ['cs1', entry.mitre.technique], ['cs2Label', 'mitreTactic'], ['cs2', entry.mitre.tactic]] as [string, unknown][] : []),
      ...Object.entries(entry.metadata).filter(([key]) => CEF_KEY.test(key))
    ];
    const extensions = fields.map(([key, value]) => `${key}=${cefValue(value)}`).join(' ');

    return `${header.join('|')}|${extensions}`;
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
        groups: [source.type, source.component || 'general'],
        ...(entry.mitre ? { mitre: { id: [entry.mitre.technique], tactic: [entry.mitre.tactic] } } : {})
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
