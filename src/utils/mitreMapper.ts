import { MitreAttackInfo } from '../types';
import { logger } from './logger';

/**
 * MITRE ATT&CK Technique Mapper
 * Maps log patterns to MITRE ATT&CK techniques and tactics
 */
export class MitreMapper {
  // MITRE ATT&CK Tactics mapping
  private static readonly TACTICS = {
    'TA0001': 'Initial Access',
    'TA0002': 'Execution',
    'TA0003': 'Persistence',
    'TA0004': 'Privilege Escalation',
    'TA0005': 'Defense Evasion',
    'TA0006': 'Credential Access',
    'TA0007': 'Discovery',
    'TA0008': 'Lateral Movement',
    'TA0009': 'Collection',
    'TA0010': 'Exfiltration',
    'TA0011': 'Command and Control',
    'TA0040': 'Impact',
    'TA0042': 'Resource Development',
    'TA0043': 'Reconnaissance'
  };

  // High-priority MITRE techniques mapping
  private static readonly TECHNIQUE_PATTERNS = {
    // Initial Access - TA0001
    'failed_login': {
      technique: 'T1110.001',
      tactic: 'TA0006',
      subtechnique: 'Password Guessing',
      description: 'Adversaries may use password guessing to gain access'
    },
    'brute_force': {
      technique: 'T1110',
      tactic: 'TA0006',
      subtechnique: 'Brute Force',
      description: 'Adversaries may use brute force techniques to gain access'
    },
    'account_lockout': {
      technique: 'T1110',
      tactic: 'TA0006',
      subtechnique: 'Brute Force',
      description: 'Account lockout due to multiple failed attempts'
    },
    'suspicious_location': {
      technique: 'T1078',
      tactic: 'TA0001',
      subtechnique: 'Valid Accounts',
      description: 'Login from unusual geographic location'
    },

    // Credential Access - TA0006
    'password_change': {
      technique: 'T1098',
      tactic: 'TA0003',
      subtechnique: 'Account Manipulation',
      description: 'Adversaries may manipulate accounts to maintain access'
    },
    'privilege_escalation': {
      technique: 'T1078.003',
      tactic: 'TA0004',
      subtechnique: 'Local Accounts',
      description: 'Adversaries may obtain and abuse credentials of existing accounts'
    },

    // Defense Evasion - TA0005
    'firewall_block': {
      technique: 'T1562.004',
      tactic: 'TA0005',
      subtechnique: 'Disable or Modify System Firewall',
      description: 'Adversaries may disable or modify system firewalls'
    },
    'intrusion_detected': {
      technique: 'T1562.001',
      tactic: 'TA0005',
      subtechnique: 'Disable or Modify Tools',
      description: 'Adversaries may disable security tools to avoid detection'
    },

    // Discovery - TA0007
    'system_info': {
      technique: 'T1082',
      tactic: 'TA0007',
      subtechnique: 'System Information Discovery',
      description: 'Adversaries may attempt to get detailed information about the system'
    },
    'network_scan': {
      technique: 'T1018',
      tactic: 'TA0007',
      subtechnique: 'Remote System Discovery',
      description: 'Adversaries may attempt to get a listing of other systems'
    },

    // Collection - TA0009
    'data_access': {
      technique: 'T1005',
      tactic: 'TA0009',
      subtechnique: 'Data from Local System',
      description: 'Adversaries may search local system sources to find files of interest'
    },
    'database_query': {
      technique: 'T1213',
      tactic: 'TA0009',
      subtechnique: 'Data from Information Repositories',
      description: 'Adversaries may leverage information repositories to mine valuable information'
    },

    // Command and Control - TA0011
    'suspicious_connection': {
      technique: 'T1071.001',
      tactic: 'TA0011',
      subtechnique: 'Web Protocols',
      description: 'Adversaries may communicate using application layer protocols'
    },
    'outbound_connection': {
      technique: 'T1041',
      tactic: 'TA0010',
      subtechnique: 'Exfiltration Over C2 Channel',
      description: 'Adversaries may steal data by exfiltrating it over an existing C2 channel'
    },

    // Impact - TA0040
    'service_disruption': {
      technique: 'T1499',
      tactic: 'TA0040',
      subtechnique: 'Endpoint Denial of Service',
      description: 'Adversaries may perform Endpoint Denial of Service attacks'
    },
    'resource_exhaustion': {
      technique: 'T1496',
      tactic: 'TA0040',
      subtechnique: 'Resource Hijacking',
      description: 'Adversaries may leverage resources to mine cryptocurrency'
    }
  };

  /**
   * Maps a log message to a MITRE ATT&CK technique
   * @param message - The log message to analyze
   * @param metadata - Additional metadata for context
   * @returns MITRE ATT&CK information or null if no match
   */
  public static mapLogToTechnique(message: string, metadata?: Record<string, any>): MitreAttackInfo | null {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific patterns in the message
    for (const [pattern, mitreInfo] of Object.entries(this.TECHNIQUE_PATTERNS)) {
      if (this.matchesPattern(lowerMessage, pattern)) {
        logger.debug(`Mapped log to MITRE technique: ${mitreInfo.technique} (${pattern})`);
        return mitreInfo;
      }
    }

    // Check metadata for additional context
    if (metadata) {
      const metadataMatch = this.checkMetadataPatterns(metadata);
      if (metadataMatch) {
        return metadataMatch;
      }
    }

    return null;
  }

  /**
   * Checks if a message matches a specific pattern
   */
  private static matchesPattern(message: string, pattern: string): boolean {
    switch (pattern) {
      case 'failed_login':
        return message.includes('failed login') || message.includes('login failed') || 
               message.includes('authentication failed') || message.includes('invalid credentials');
      
      case 'brute_force':
        return (message.includes('multiple') && message.includes('attempts')) ||
               message.includes('brute force') || message.includes('password spray');
      
      case 'account_lockout':
        return message.includes('locked') || message.includes('lockout') || 
               message.includes('account disabled');
      
      case 'suspicious_location':
        return message.includes('unusual location') || message.includes('suspicious login') ||
               message.includes('geographic') || message.includes('country');
      
      case 'password_change':
        return message.includes('password changed') || message.includes('password reset') ||
               message.includes('credentials updated');
      
      case 'privilege_escalation':
        return message.includes('privilege') || message.includes('escalation') ||
               message.includes('unauthorized access') || message.includes('admin access');
      
      case 'firewall_block':
        return message.includes('drop') || message.includes('block') || 
               message.includes('deny') || message.includes('reject');
      
      case 'intrusion_detected':
        return message.includes('intrusion') || message.includes('attack') ||
               message.includes('malicious') || message.includes('threat');
      
      case 'system_info':
        return message.includes('system') && (message.includes('info') || message.includes('discovery') ||
               message.includes('enumeration') || message.includes('reconnaissance'));
      
      case 'network_scan':
        return message.includes('scan') || message.includes('probe') ||
               message.includes('port') || message.includes('discovery');
      
      case 'data_access':
        return message.includes('data') && (message.includes('access') || message.includes('read') ||
               message.includes('export') || message.includes('download'));
      
      case 'database_query':
        return message.includes('query') || message.includes('select') ||
               message.includes('database') || message.includes('sql');
      
      case 'suspicious_connection':
        return message.includes('suspicious') && message.includes('connection') ||
               message.includes('unusual traffic') || message.includes('anomalous');
      
      case 'outbound_connection':
        return message.includes('outbound') || message.includes('external') ||
               (message.includes('connection') && message.includes('established'));
      
      case 'service_disruption':
        return message.includes('service') && (message.includes('down') || message.includes('failed') ||
               message.includes('unavailable') || message.includes('timeout'));
      
      case 'resource_exhaustion':
        return message.includes('high') && (message.includes('cpu') || message.includes('memory') ||
               message.includes('disk') || message.includes('resource'));
      
      default:
        return false;
    }
  }

  /**
   * Checks metadata for MITRE technique indicators
   */
  private static checkMetadataPatterns(metadata: Record<string, any>): MitreAttackInfo | null {
    // Check for security-related components
    if (metadata.component === 'intrusion-detection' || metadata.component === 'security-monitor') {
      return this.TECHNIQUE_PATTERNS.intrusion_detected;
    }
    
    if (metadata.component === 'auth-service' && metadata.failed_attempts) {
      return this.TECHNIQUE_PATTERNS.brute_force;
    }

    return null;
  }

  /**
   * Gets all supported MITRE techniques
   */
  public static getSupportedTechniques(): string[] {
    return Object.values(this.TECHNIQUE_PATTERNS).map(pattern => pattern.technique);
  }

  /**
   * Gets all supported MITRE tactics
   */
  public static getSupportedTactics(): string[] {
    return Object.keys(this.TACTICS);
  }

  /**
   * Gets tactic name by ID
   */
  public static getTacticName(tacticId: string): string {
    return this.TACTICS[tacticId as keyof typeof this.TACTICS] || 'Unknown';
  }

  /**
   * Gets technique information by ID
   */
  public static getTechniqueInfo(techniqueId: string): MitreAttackInfo | null {
    const technique = Object.values(this.TECHNIQUE_PATTERNS)
      .find(pattern => pattern.technique === techniqueId);
    return technique || null;
  }

  /**
   * Validates MITRE technique format
   */
  public static isValidTechnique(techniqueId: string): boolean {
    return /^T\d{4}(\.\d{3})?$/.test(techniqueId);
  }

  /**
   * Validates MITRE tactic format
   */
  public static isValidTactic(tacticId: string): boolean {
    return /^TA\d{4}$/.test(tacticId);
  }
}

export const mitreMapper = MitreMapper;
