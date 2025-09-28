import { logger } from './logger';

/**
 * D3FEND Framework Mapper
 * Maps log patterns to D3FEND defensive techniques and categories
 * Complements the existing MITRE ATT&CK mapper for complete attack-defense simulation
 */

export interface D3FENDInfo {
  technique: string;
  category: 'Detect' | 'Deny' | 'Disrupt' | 'Degrade' | 'Deceive' | 'Contain';
  subcategory: string;
  description: string;
  effectiveness?: 'High' | 'Medium' | 'Low';
  automated?: boolean;
}

export class D3FENDMapper {
  // D3FEND Categories mapping
  private static readonly CATEGORIES = {
    'Detect': 'Identify adversary activity',
    'Deny': 'Prevent adversary activity', 
    'Disrupt': 'Impede adversary activity',
    'Degrade': 'Reduce adversary capability',
    'Deceive': 'Mislead adversary activity',
    'Contain': 'Restrict adversary activity'
  };

  // D3FEND Defensive Technique Patterns
  private static readonly DEFENSIVE_PATTERNS = {
    // Detection Techniques
    'network_monitoring': {
      technique: 'D3-NTA',
      category: 'Detect' as const,
      subcategory: 'Network Traffic Analysis',
      description: 'Monitor network communications to detect adversary presence',
      effectiveness: 'High' as const,
      automated: true
    },
    'file_analysis': {
      technique: 'D3-FA', 
      category: 'Detect' as const,
      subcategory: 'File Analysis',
      description: 'Analyze files to detect malicious content',
      effectiveness: 'High' as const,
      automated: true
    },
    'authentication_monitoring': {
      technique: 'D3-LAM',
      category: 'Detect' as const, 
      subcategory: 'Login Analysis',
      description: 'Monitor authentication events for suspicious activity',
      effectiveness: 'Medium' as const,
      automated: true
    },
    'process_monitoring': {
      technique: 'D3-PSA',
      category: 'Detect' as const,
      subcategory: 'Process Spawn Analysis', 
      description: 'Monitor process creation for malicious activity',
      effectiveness: 'High' as const,
      automated: true
    },

    // Denial Techniques  
    'access_control': {
      technique: 'D3-ACL',
      category: 'Deny' as const,
      subcategory: 'Access Control List',
      description: 'Restrict system access through access control policies',
      effectiveness: 'High' as const,
      automated: true
    },
    'network_blocking': {
      technique: 'D3-NB',
      category: 'Deny' as const,
      subcategory: 'Network Block',
      description: 'Block network traffic based on threat intelligence',
      effectiveness: 'High' as const,
      automated: true
    },
    'application_firewall': {
      technique: 'D3-WAF',
      category: 'Deny' as const,
      subcategory: 'Web Application Firewall',
      description: 'Filter HTTP traffic to block malicious requests',
      effectiveness: 'Medium' as const,
      automated: true
    },

    // Containment Techniques
    'network_isolation': {
      technique: 'D3-NI',
      category: 'Contain' as const,
      subcategory: 'Network Isolation',
      description: 'Isolate compromised systems from the network',
      effectiveness: 'High' as const,
      automated: false
    },
    'account_lockout': {
      technique: 'D3-AL',
      category: 'Contain' as const,
      subcategory: 'Account Lockout', 
      description: 'Disable compromised user accounts',
      effectiveness: 'High' as const,
      automated: true
    },
    'process_termination': {
      technique: 'D3-PT',
      category: 'Contain' as const,
      subcategory: 'Process Termination',
      description: 'Terminate malicious processes',
      effectiveness: 'High' as const,
      automated: true
    },

    // Disruption Techniques
    'credential_rotation': {
      technique: 'D3-CR',
      category: 'Disrupt' as const,
      subcategory: 'Credential Rotation',
      description: 'Rotate credentials to disrupt adversary access',
      effectiveness: 'Medium' as const,
      automated: false
    },
    'dns_sinkhole': {
      technique: 'D3-DNS',
      category: 'Disrupt' as const,
      subcategory: 'DNS Sinkhole',
      description: 'Redirect malicious domains to controlled servers',
      effectiveness: 'Medium' as const,
      automated: true
    },

    // Deception Techniques
    'decoy_file': {
      technique: 'D3-DF',
      category: 'Deceive' as const,
      subcategory: 'Decoy File',
      description: 'Deploy decoy files to detect unauthorized access',
      effectiveness: 'Medium' as const,
      automated: true
    },
    'honeypot': {
      technique: 'D3-HP',
      category: 'Deceive' as const,
      subcategory: 'Honeypot',
      description: 'Deploy honeypot systems to attract and analyze attacks',
      effectiveness: 'Medium' as const,
      automated: true
    }
  };

  /**
   * Maps a log message to a D3FEND defensive technique
   */
  public static mapLogToDefensiveTechnique(message: string, metadata?: Record<string, any>): D3FENDInfo | null {
    const lowerMessage = message.toLowerCase();
    
    // Check for specific defensive patterns in the message
    for (const [pattern, d3fendInfo] of Object.entries(this.DEFENSIVE_PATTERNS)) {
      if (this.matchesDefensivePattern(lowerMessage, pattern, metadata)) {
        logger.debug(`Mapped log to D3FEND technique: ${d3fendInfo.technique} (${pattern})`);
        return d3fendInfo;
      }
    }

    return null;
  }

  /**
   * Checks if a message matches a specific defensive pattern
   */
  private static matchesDefensivePattern(message: string, pattern: string, metadata?: Record<string, any>): boolean {
    switch (pattern) {
      case 'network_monitoring':
        return message.includes('network scan detected') || 
               message.includes('suspicious traffic') ||
               message.includes('anomalous connection') ||
               (metadata?.component === 'ids' || metadata?.component === 'ips');

      case 'file_analysis':
        return message.includes('malware detected') ||
               message.includes('virus found') ||
               message.includes('file quarantined') ||
               message.includes('suspicious file');

      case 'authentication_monitoring':
        return message.includes('failed login detected') ||
               message.includes('brute force detected') ||
               message.includes('suspicious login pattern') ||
               (metadata?.component === 'auth-monitor');

      case 'process_monitoring':
        return message.includes('suspicious process') ||
               message.includes('malicious execution') ||
               message.includes('process blocked') ||
               (metadata?.component === 'edr');

      case 'access_control':
        return message.includes('access denied') ||
               message.includes('permission blocked') ||
               message.includes('acl violation') ||
               message.includes('unauthorized access blocked');

      case 'network_blocking':
        return message.includes('ip blocked') ||
               message.includes('domain blocked') ||
               message.includes('threat intel block') ||
               message.includes('firewall drop');

      case 'application_firewall':
        return message.includes('waf block') ||
               message.includes('http attack blocked') ||
               message.includes('sql injection blocked') ||
               message.includes('xss blocked');

      case 'network_isolation':
        return message.includes('system isolated') ||
               message.includes('network quarantine') ||
               message.includes('vlan isolation') ||
               message.includes('host contained');

      case 'account_lockout':
        return message.includes('account locked') ||
               message.includes('user disabled') ||
               message.includes('account suspended') ||
               message.includes('credentials revoked');

      case 'process_termination':
        return message.includes('process killed') ||
               message.includes('malware terminated') ||
               message.includes('execution blocked') ||
               message.includes('process stopped');

      case 'credential_rotation':
        return message.includes('password rotated') ||
               message.includes('key rotated') ||
               message.includes('credentials updated') ||
               message.includes('token refreshed');

      case 'dns_sinkhole':
        return message.includes('dns sinkhole') ||
               message.includes('malicious domain redirected') ||
               message.includes('c2 domain blocked') ||
               message.includes('dns blackhole');

      case 'decoy_file':
        return message.includes('decoy accessed') ||
               message.includes('canary file') ||
               message.includes('honeytrap triggered') ||
               message.includes('bait file');

      case 'honeypot':
        return message.includes('honeypot') ||
               message.includes('decoy system') ||
               message.includes('trap triggered') ||
               message.includes('attacker captured');

      default:
        return false;
    }
  }

  /**
   * Gets all supported D3FEND techniques
   */
  public static getSupportedTechniques(): string[] {
    return Object.values(this.DEFENSIVE_PATTERNS).map(pattern => pattern.technique);
  }

  /**
   * Gets all supported D3FEND categories
   */
  public static getSupportedCategories(): string[] {
    return Object.keys(this.CATEGORIES);
  }

  /**
   * Gets category description
   */
  public static getCategoryDescription(category: string): string {
    return this.CATEGORIES[category as keyof typeof this.CATEGORIES] || 'Unknown';
  }

  /**
   * Gets technique information by ID
   */
  public static getTechniqueInfo(techniqueId: string): D3FENDInfo | null {
    const technique = Object.values(this.DEFENSIVE_PATTERNS)
      .find(pattern => pattern.technique === techniqueId);
    return technique || null;
  }

  /**
   * Gets techniques by category
   */
  public static getTechniquesByCategory(category: string): D3FENDInfo[] {
    return Object.values(this.DEFENSIVE_PATTERNS)
      .filter(pattern => pattern.category === category);
  }

  /**
   * Validates D3FEND technique format
   */
  public static isValidTechnique(techniqueId: string): boolean {
    return /^D3-[A-Z]+$/.test(techniqueId);
  }

  /**
   * Suggests defensive techniques for a given MITRE ATT&CK technique
   */
  public static suggestDefensesForAttack(mitreId: string): D3FENDInfo[] {
    const defenseMapping: Record<string, string[]> = {
      'T1110': ['authentication_monitoring', 'account_lockout', 'access_control'], // Brute Force
      'T1078': ['authentication_monitoring', 'access_control'], // Valid Accounts  
      'T1071': ['network_monitoring', 'network_blocking'], // Application Layer Protocol
      'T1055': ['process_monitoring', 'process_termination'], // Process Injection
      'T1082': ['decoy_file', 'honeypot'], // System Information Discovery
      'T1018': ['network_monitoring', 'network_isolation'] // Remote System Discovery
    };

    const patterns = defenseMapping[mitreId] || [];
    return patterns
      .map(pattern => this.DEFENSIVE_PATTERNS[pattern as keyof typeof this.DEFENSIVE_PATTERNS])
      .filter(Boolean);
  }

  /**
   * Get comprehensive coverage report of D3FEND techniques
   */
  public static getCoverageReport(): {
    techniques: D3FENDInfo[];
    byCategory: Record<string, D3FENDInfo[]>;
    totalCount: number;
    automatedCount: number;
  } {
    const techniques = Object.values(this.DEFENSIVE_PATTERNS);
    const byCategory: Record<string, D3FENDInfo[]> = {};
    
    // Group techniques by category
    techniques.forEach(technique => {
      if (!byCategory[technique.category]) {
        byCategory[technique.category] = [];
      }
      byCategory[technique.category].push(technique);
    });

    return {
      techniques,
      byCategory,
      totalCount: techniques.length,
      automatedCount: techniques.filter(t => t.automated).length
    };
  }
}

export const d3fendMapper = D3FENDMapper;

