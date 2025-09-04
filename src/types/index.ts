export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'CRITICAL';
  source: LogSource;
  message: string;
  metadata: Record<string, any>;
  raw?: string;
}

export interface LogSource {
  type: 'endpoint' | 'application' | 'server' | 'firewall' | 'cloud';
  name: string;
  host?: string;
  service?: string;
  component?: string;
}

export interface GeneratorConfig {
  enabled: boolean;
  frequency: number; // logs per minute
  templates: LogTemplate[];
  metadata?: Record<string, any>;
}

export interface LogTemplate {
  level: LogEntry['level'];
  messageTemplate: string;
  probability: number; // 0-1, probability of this template being used
  metadata?: Record<string, any>;
}

export interface ReplayConfig {
  enabled: boolean;
  speed: number; // multiplier for replay speed (1 = real-time, 2 = 2x speed)
  loop: boolean;
  startTime?: string;
  endTime?: string;
  filters?: {
    sources?: string[];
    levels?: LogEntry['level'][];
  };
}

export interface Config {
  generators: {
    endpoint: GeneratorConfig;
    application: GeneratorConfig;
    server: GeneratorConfig;
    firewall: GeneratorConfig;
    cloud: GeneratorConfig;
  };
  replay: ReplayConfig;
  output: {
    format: 'json' | 'syslog' | 'cef' | 'wazuh';
    destination: 'file' | 'syslog' | 'http' | 'stdout';
    file?: {
      path: string;
      rotation: boolean;
      maxSize: string;
      maxFiles: number;
    };
    syslog?: {
      host: string;
      port: number;
      protocol: 'udp' | 'tcp';
    };
    http?: {
      url: string;
      headers?: Record<string, string>;
    };
  };
  storage: {
    historicalPath: string;
    currentPath: string;
    retention: number; // days
  };
}

export interface HistoricalLogFile {
  filename: string;
  startTime: string;
  endTime: string;
  count: number;
  size: number;
}
