export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'CRITICAL';
  source: LogSource;
  message: string;
  metadata: Record<string, any>;
  raw?: string;
  mitre?: MitreAttackInfo;
}

export interface MitreAttackInfo {
  technique: string;        // e.g., "T1078.001"
  tactic: string;          // e.g., "TA0001"
  subtechnique?: string;   // e.g., "Default Accounts"
  group?: string;          // e.g., "APT29"
  description?: string;    // Brief description of the technique
}

export interface LogSource {
  type: 'endpoint' | 'application' | 'server' | 'firewall' | 'cloud' | 'authentication' | 'database' | 'webserver' | 'email' | 'backup' | 'microservices' | 'iot';
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
  mitre?: MitreAttackInfo;
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
    // New generators
    authentication: GeneratorConfig;
    database: GeneratorConfig;
    webserver: GeneratorConfig;
    email: GeneratorConfig;
    backup: GeneratorConfig;
    microservices: GeneratorConfig;
    iot: GeneratorConfig;
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
