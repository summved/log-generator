import { BaseGenerator } from './BaseGenerator';
import { LogEntry, LogSource, D3FENDInfo } from '../types';
import { d3fendMapper } from '../utils/d3fendMapper';
import { timestampSequencer } from '../utils/timestampSequencer';
import { logger } from '../utils/logger';

/**
 * Security Operations Center (SOC) Generator
 * Generates realistic SOC analyst activities and defensive responses
 * Integrates D3FEND defensive techniques with security operations
 */
export class SecurityOperationsGenerator extends BaseGenerator {
  private readonly logSource: LogSource = {
    type: 'application',
    name: 'soc-platform',
    host: 'soc-01.enterprise.local',
    service: 'security-operations',
    component: 'siem'
  };

  private readonly socAnalysts = [
    'alice.security', 'bob.analyst', 'charlie.soc', 'diana.defender', 
    'eve.investigator', 'frank.responder'
  ];

  private readonly threatSources = [
    '192.168.100.45', '10.0.0.89', '172.16.1.234', '192.168.50.12',
    'suspicious-domain.com', 'malware-c2.net', 'phishing-site.org'
  ];

  private readonly assetNames = [
    'web-server-01', 'db-primary', 'file-server-03', 'workstation-hr-45',
    'mail-gateway', 'domain-controller', 'backup-system', 'vpn-gateway'
  ];

  protected generateLogEntry(): LogEntry {
    const scenarios = [
      this.generateThreatDetection,
      this.generateIncidentResponse,
      this.generateNetworkDefense,
      this.generateAccessControl,
      this.generateMalwareDefense,
      this.generateForensicAnalysis,
      this.generateThreatHunting,
      this.generateComplianceCheck
    ];

    const scenario = this.getRandomElement(scenarios);
    return scenario.call(this);
  }

  /**
   * Generate threat detection and analysis logs
   */
  private generateThreatDetection(): LogEntry {
    const detectionTypes = [
      {
        message: `Network anomaly detected: Unusual traffic pattern from {{source}} to {{target}} - {{bytes}} bytes transferred`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-NTA'),
        metadata: { 
          detection_type: 'network_anomaly',
          confidence: this.getRandomElement(['high', 'medium', 'low']),
          severity: this.getRandomElement(['critical', 'high', 'medium'])
        }
      },
      {
        message: `Suspicious file detected: {{filename}} contains potential malware - Hash: {{hash}}`,
        level: 'ERROR' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-FA'),
        metadata: {
          detection_type: 'malware',
          file_type: this.getRandomElement(['exe', 'dll', 'pdf', 'doc']),
          scanner: 'endpoint-protection'
        }
      },
      {
        message: `Brute force attack detected: Multiple failed login attempts from {{source}} targeting user {{user}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-LAM'),
        metadata: {
          detection_type: 'authentication_attack',
          failed_attempts: Math.floor(Math.random() * 50) + 10,
          time_window: '5 minutes'
        }
      }
    ];

    const detection = this.getRandomElement(detectionTypes);
    const analyst = this.getRandomElement(this.socAnalysts);
    
    return {
      timestamp: timestampSequencer.getUniqueTimestamp(),
      level: detection.level,
      source: this.logSource,
      message: this.processTemplate(detection.message, {
        source: this.getRandomElement(this.threatSources),
        target: this.getRandomElement(this.assetNames),
        bytes: (Math.random() * 1000000).toFixed(0),
        filename: `suspicious_${Math.random().toString(36).substr(2, 8)}.exe`,
        hash: this.generateHash(),
        user: this.getRandomElement(this.socAnalysts)
      }),
      metadata: {
        ...detection.metadata,
        analyst: analyst,
        component: 'threat-detection',
        automated: true,
        timestamp_detection: timestampSequencer.getUniqueTimestamp()
      },
      d3fend: detection.d3fend || undefined
    };
  }

  /**
   * Generate incident response activities
   */
  private generateIncidentResponse(): LogEntry {
    const responseActions = [
      {
        message: `Incident INC-{{incident_id}} created: {{threat_type}} detected on {{asset}} - Assigned to {{analyst}}`,
        level: 'INFO' as const,
        d3fend: null,
        action: 'incident_creation'
      },
      {
        message: `Host {{asset}} isolated from network due to suspected compromise - Incident INC-{{incident_id}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-NI'),
        action: 'network_isolation'
      },
      {
        message: `Malicious process {{process}} terminated on {{asset}} - PID: {{pid}}`,
        level: 'INFO' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-PT'),
        action: 'process_termination'
      },
      {
        message: `User account {{user}} disabled due to suspected compromise - Incident INC-{{incident_id}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-AL'),
        action: 'account_lockout'
      }
    ];

    const response = this.getRandomElement(responseActions);
    const analyst = this.getRandomElement(this.socAnalysts);
    const incidentId = `${new Date().getFullYear()}${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`;

    return {
      timestamp: timestampSequencer.getUniqueTimestamp(),
      level: response.level,
      source: this.logSource,
      message: this.processTemplate(response.message, {
        incident_id: incidentId,
        threat_type: this.getRandomElement(['malware', 'phishing', 'data_exfiltration', 'credential_theft']),
        asset: this.getRandomElement(this.assetNames),
        analyst: analyst,
        process: this.getRandomElement(['powershell.exe', 'cmd.exe', 'suspicious.exe', 'malware.dll']),
        pid: Math.floor(Math.random() * 10000),
        user: this.getRandomElement(this.socAnalysts)
      }),
      metadata: {
        incident_id: incidentId,
        response_action: response.action,
        analyst: analyst,
        component: 'incident-response',
        automated: response.action === 'process_termination',
        severity: this.getRandomElement(['critical', 'high', 'medium'])
      },
      d3fend: response.d3fend || undefined
    };
  }

  /**
   * Generate network defense activities
   */
  private generateNetworkDefense(): LogEntry {
    const defenseActions = [
      {
        message: `Firewall rule updated: Blocking traffic from {{source}} - Threat intelligence match`,
        level: 'INFO' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-NB'),
        automated: true
      },
      {
        message: `DNS sinkhole activated: Redirecting {{domain}} to security server {{sinkhole}}`,
        level: 'INFO' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-DNS'),
        automated: true
      },
      {
        message: `WAF protection triggered: Blocked {{attack_type}} attempt from {{source}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-WAF'),
        automated: true
      }
    ];

    const defense = this.getRandomElement(defenseActions);
    
    return {
      timestamp: new Date().toISOString(),
      level: defense.level,
      source: this.logSource,
      message: this.processTemplate(defense.message, {
        source: this.getRandomElement(this.threatSources),
        domain: this.getRandomElement(['malware-c2.net', 'phishing-site.org', 'suspicious-domain.com']),
        sinkhole: '192.168.100.200',
        attack_type: this.getRandomElement(['SQL injection', 'XSS', 'command injection', 'path traversal'])
      }),
      metadata: {
        defense_type: 'network_security',
        automated: defense.automated,
        component: 'network-defense',
        effectiveness: 'high'
      },
      d3fend: defense.d3fend || undefined
    };
  }

  /**
   * Generate access control and identity management logs
   */
  private generateAccessControl(): LogEntry {
    const accessActions = [
      {
        message: `Access denied: User {{user}} attempted to access {{resource}} without proper permissions`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-ACL')
      },
      {
        message: `Privilege escalation blocked: {{user}} attempted to gain {{privilege}} access on {{asset}}`,
        level: 'ERROR' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-ACL')
      },
      {
        message: `Credentials rotated for service account {{account}} due to security policy`,
        level: 'INFO' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-CR')
      }
    ];

    const access = this.getRandomElement(accessActions);
    
    return {
      timestamp: new Date().toISOString(),
      level: access.level,
      source: this.logSource,
      message: this.processTemplate(access.message, {
        user: this.getRandomElement(this.socAnalysts),
        resource: this.getRandomElement(['sensitive-database', 'admin-panel', 'financial-reports', 'user-data']),
        privilege: this.getRandomElement(['administrator', 'root', 'system', 'domain admin']),
        asset: this.getRandomElement(this.assetNames),
        account: `svc_${this.getRandomElement(['backup', 'monitor', 'scan', 'update'])}`
      }),
      metadata: {
        access_type: 'authorization',
        component: 'access-control',
        automated: true,
        policy_enforced: true
      },
      d3fend: access.d3fend || undefined
    };
  }

  /**
   * Generate malware defense logs
   */
  private generateMalwareDefense(): LogEntry {
    const malwareActions = [
      {
        message: `File quarantined: {{filename}} detected as {{malware_type}} on {{asset}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-FA')
      },
      {
        message: `Real-time protection blocked: {{process}} prevented from executing on {{asset}}`,
        level: 'INFO' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-PT')
      },
      {
        message: `Behavioral analysis triggered: Suspicious activity detected in {{process}} - {{behavior}}`,
        level: 'WARN' as const,
        d3fend: d3fendMapper.getTechniqueInfo('D3-PSA')
      }
    ];

    const malware = this.getRandomElement(malwareActions);
    
    return {
      timestamp: new Date().toISOString(),
      level: malware.level,
      source: this.logSource,
      message: this.processTemplate(malware.message, {
        filename: `malware_${Math.random().toString(36).substr(2, 8)}.exe`,
        malware_type: this.getRandomElement(['trojan', 'ransomware', 'spyware', 'adware']),
        asset: this.getRandomElement(this.assetNames),
        process: this.getRandomElement(['suspicious.exe', 'malware.dll', 'trojan.bat']),
        behavior: this.getRandomElement(['file encryption', 'keylogging', 'network scanning', 'data collection'])
      }),
      metadata: {
        defense_type: 'malware_protection',
        component: 'endpoint-protection',
        automated: true,
        quarantine_location: '/quarantine/' + Math.random().toString(36).substr(2, 8)
      },
      d3fend: malware.d3fend || undefined
    };
  }

  /**
   * Generate forensic analysis logs
   */
  private generateForensicAnalysis(): LogEntry {
    const forensicActions = [
      {
        message: `Digital forensics initiated: Memory dump captured from {{asset}} - Case ID: {{case_id}}`,
        level: 'INFO' as const
      },
      {
        message: `Artifact analysis completed: {{artifact_count}} IOCs extracted from {{asset}}`,
        level: 'INFO' as const
      },
      {
        message: `Timeline analysis: Attack progression reconstructed for incident INC-{{incident_id}}`,
        level: 'INFO' as const
      }
    ];

    const forensic = this.getRandomElement(forensicActions);
    const analyst = this.getRandomElement(this.socAnalysts);
    
    return {
      timestamp: new Date().toISOString(),
      level: forensic.level,
      source: this.logSource,
      message: this.processTemplate(forensic.message, {
        asset: this.getRandomElement(this.assetNames),
        case_id: `CASE-${new Date().getFullYear()}-${(Math.random() * 1000).toFixed(0).padStart(3, '0')}`,
        artifact_count: Math.floor(Math.random() * 50) + 10,
        incident_id: `${new Date().getFullYear()}${(Math.random() * 10000).toFixed(0).padStart(4, '0')}`
      }),
      metadata: {
        activity_type: 'digital_forensics',
        analyst: analyst,
        component: 'forensics-platform',
        automated: false
      }
    };
  }

  /**
   * Generate threat hunting logs
   */
  private generateThreatHunting(): LogEntry {
    const huntingActions = [
      {
        message: `Threat hunt initiated: Searching for {{hunt_type}} indicators across {{scope}}`,
        level: 'INFO' as const
      },
      {
        message: `Hunting hypothesis validated: Found {{indicator_count}} matches for {{technique}} technique`,
        level: 'WARN' as const
      },
      {
        message: `Proactive search completed: {{asset_count}} assets scanned for {{threat_pattern}} patterns`,
        level: 'INFO' as const
      }
    ];

    const hunting = this.getRandomElement(huntingActions);
    const analyst = this.getRandomElement(this.socAnalysts);
    
    return {
      timestamp: new Date().toISOString(),
      level: hunting.level,
      source: this.logSource,
      message: this.processTemplate(hunting.message, {
        hunt_type: this.getRandomElement(['APT', 'insider threat', 'lateral movement', 'data exfiltration']),
        scope: this.getRandomElement(['enterprise network', 'critical systems', 'user endpoints', 'servers']),
        indicator_count: Math.floor(Math.random() * 20) + 1,
        technique: this.getRandomElement(['T1110', 'T1078', 'T1071', 'T1055']),
        asset_count: Math.floor(Math.random() * 500) + 100,
        threat_pattern: this.getRandomElement(['powershell', 'WMI', 'scheduled tasks', 'registry'])
      }),
      metadata: {
        activity_type: 'threat_hunting',
        analyst: analyst,
        component: 'hunting-platform',
        automated: false,
        hunt_duration: `${Math.floor(Math.random() * 8) + 1} hours`
      }
    };
  }

  /**
   * Generate compliance and audit logs
   */
  private generateComplianceCheck(): LogEntry {
    const complianceActions = [
      {
        message: `Compliance scan completed: {{compliance_type}} assessment on {{asset}} - Score: {{score}}%`,
        level: 'INFO' as const
      },
      {
        message: `Policy violation detected: {{violation_type}} on {{asset}} - Remediation required`,
        level: 'WARN' as const
      },
      {
        message: `Security baseline verified: {{asset}} meets {{standard}} requirements`,
        level: 'INFO' as const
      }
    ];

    const compliance = this.getRandomElement(complianceActions);
    
    return {
      timestamp: new Date().toISOString(),
      level: compliance.level,
      source: this.logSource,
      message: this.processTemplate(compliance.message, {
        compliance_type: this.getRandomElement(['PCI DSS', 'SOX', 'HIPAA', 'ISO 27001']),
        asset: this.getRandomElement(this.assetNames),
        score: Math.floor(Math.random() * 40) + 60,
        violation_type: this.getRandomElement(['weak passwords', 'missing patches', 'open ports', 'expired certificates']),
        standard: this.getRandomElement(['CIS', 'NIST', 'ISO 27001', 'SOC 2'])
      }),
      metadata: {
        activity_type: 'compliance_audit',
        component: 'compliance-scanner',
        automated: true,
        remediation_required: Math.random() > 0.7
      }
    };
  }

  private generateHash(): string {
    return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });
    return result;
  }

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}

