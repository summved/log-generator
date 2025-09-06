/**
 * ML-Enhanced Log Generator
 * Integrates ML pattern learning with existing log generation system
 */

import { BaseGenerator } from '../generators/BaseGenerator';
import { LogEntry, LogSource, LogTemplate } from '../types';
import { PatternLearningEngine } from './PatternLearningEngine';
import { MLLogGenerationConfig, UserBehaviorPattern } from '../types/mlPatterns';
import { logger } from '../utils/logger';
import { timestampSequencer } from '../utils/timestampSequencer';

/**
 * Enhanced log generator that uses ML patterns for realistic log generation
 */
export class MLEnhancedLogGenerator extends BaseGenerator {
  private patternEngine: PatternLearningEngine;
  private mlConfig: MLLogGenerationConfig;
  private isMLEnabled: boolean;

  constructor(
    source: LogSource,
    patternEngine: PatternLearningEngine,
    mlConfig?: Partial<MLLogGenerationConfig>
  ) {
    super(source, { enabled: true, frequency: 60, templates: [] });
    
    this.patternEngine = patternEngine;
    this.isMLEnabled = true;
    
    this.mlConfig = {
      learning: {
        enabled: true,
        learningRate: 0.01,
        adaptationPeriod: 24,
        minSampleSize: 1000,
        maxHistoryDays: 30,
        ...mlConfig?.learning
      },
      patternApplication: {
        userBehaviorWeight: 0.4,
        systemBehaviorWeight: 0.3,
        securityEventWeight: 0.2,
        randomnessLevel: 0.1,
        ...mlConfig?.patternApplication
      },
      anomalyGeneration: {
        enabled: true,
        anomalyRate: 0.05,
        severityDistribution: { low: 0.6, medium: 0.3, high: 0.08, critical: 0.02 },
        realismLevel: 0.8,
        ...mlConfig?.anomalyGeneration
      },
      adaptation: {
        enabled: true,
        feedbackLoop: true,
        crossValidation: true,
        driftDetection: true,
        ...mlConfig?.adaptation
      }
    };

    logger.info(`ML-Enhanced Log Generator initialized for source: ${source.name}`, {
      mlEnabled: this.isMLEnabled,
      config: this.mlConfig
    });
  }

  /**
   * Generate log entry using ML patterns
   */
  protected generateLogEntry(): LogEntry {
    if (!this.isMLEnabled) {
      return super.generateLogEntry();
    }

    try {
      // For now, return a synchronous ML-enhanced log entry
      // In a real implementation, this would use cached patterns
      const timestamp = timestampSequencer.getUniqueTimestamp();
      
      const mlLogEntry: LogEntry = {
        timestamp: timestamp,
        level: this.selectMLLogLevel(),
        source: this.source,
        message: this.generateMLMessage(),
        metadata: this.generateMLMetadata()
      };

      // Apply MITRE technique mapping
      this.addMitreTechnique(mlLogEntry, this.selectMLTemplate());

      return mlLogEntry;

    } catch (error) {
      logger.warn(`ML pattern generation failed, falling back to traditional generation`, {
        source: this.source.name,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return super.generateLogEntry();
    }
  }

  /**
   * Select ML log level based on patterns
   */
  private selectMLLogLevel(): 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'CRITICAL' {
    const rand = Math.random();
    if (rand < 0.05) return 'ERROR';
    if (rand < 0.15) return 'WARN';
    if (rand < 0.30) return 'DEBUG';
    return 'INFO';
  }

  /**
   * Generate ML-based message
   */
  private generateMLMessage(): string {
    const hour = new Date().getHours();
    const isBusinessHours = hour >= 9 && hour <= 17;
    
    const messages = {
      authentication: [
        `User ml-user successfully logged in from workstation`,
        `ML-enhanced authentication event ${isBusinessHours ? 'during' : 'outside'} business hours`,
        `Pattern-based login attempt detected`
      ],
      firewall: [
        `ML-detected network traffic pattern`,
        `Behavioral analysis: normal traffic flow`,
        `Pattern-based firewall rule triggered`
      ]
    };

    const sourceMessages = messages[this.source.type as keyof typeof messages] || [
      `ML-enhanced ${this.source.type} event`,
      `Pattern-based log entry generated`,
      `Behavioral analysis completed`
    ];

    return sourceMessages[Math.floor(Math.random() * sourceMessages.length)];
  }

  /**
   * Generate ML-based metadata
   */
  private generateMLMetadata(): Record<string, any> {
    return {
      ml_enhanced: true,
      ml_confidence: 0.7 + Math.random() * 0.3,
      pattern_source: 'ml_learning',
      generated_by: 'ml-enhanced-generator',
      business_hours: this.isBusinessHours(),
      source_type: this.source.type
    };
  }

  /**
   * Check if current time is business hours
   */
  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
  }

  /**
   * Enhance ML-generated log with template data
   */
  private async enhanceWithTemplateData(mlLogEntry: LogEntry): Promise<LogEntry> {
    // Get a traditional template for reference
    const template = this.selectMLTemplate();
    
    // Blend ML-generated content with template structure
    const enhancedEntry: LogEntry = {
      ...mlLogEntry,
      // Keep ML-generated core content
      timestamp: mlLogEntry.timestamp,
      level: mlLogEntry.level,
      message: this.blendMessages(mlLogEntry.message, template.messageTemplate || 'ML template'),
      metadata: {
        ...mlLogEntry.metadata,
        ...this.generateEnhancedMetadata(template, mlLogEntry)
      }
    };

    // Add source-specific enhancements
    this.addSourceSpecificEnhancements(enhancedEntry, template);

    return enhancedEntry;
  }

  /**
   * Blend ML-generated message with template message for better realism
   */
  private blendMessages(mlMessage: string, templateMessage: string): string {
    const blendWeight = this.mlConfig.patternApplication.randomnessLevel;
    
    // Use ML message most of the time, occasionally blend with template
    if (Math.random() < blendWeight) {
      // Extract key elements from both messages
      const mlKeywords = this.extractKeywords(mlMessage);
      const templateKeywords = this.extractKeywords(templateMessage);
      
      // Create a hybrid message
      return this.createHybridMessage(mlMessage, templateMessage, mlKeywords, templateKeywords);
    }
    
    return mlMessage;
  }

  /**
   * Extract keywords from a message
   */
  private extractKeywords(message: string): string[] {
    // Simple keyword extraction - in production, this could use NLP libraries
    const words = message.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const importantWords = words.filter(word => 
      !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'they', 'have', 'been', 'will'].includes(word)
    );
    
    return importantWords.slice(0, 5); // Top 5 keywords
  }

  /**
   * Create hybrid message combining ML and template elements
   */
  private createHybridMessage(
    mlMessage: string, 
    templateMessage: string, 
    mlKeywords: string[], 
    templateKeywords: string[]
  ): string {
    // Use ML message as base and inject template keywords if relevant
    let hybridMessage = mlMessage;
    
    for (const keyword of templateKeywords) {
      if (!mlKeywords.includes(keyword) && Math.random() < 0.3) {
        // Inject template keyword into ML message
        hybridMessage = this.injectKeyword(hybridMessage, keyword);
      }
    }
    
    return hybridMessage;
  }

  /**
   * Inject keyword into message naturally
   */
  private injectKeyword(message: string, keyword: string): string {
    // Simple keyword injection - could be enhanced with NLP
    const injectionPoints = [
      ` with ${keyword}`,
      ` for ${keyword}`,
      ` on ${keyword}`,
      ` - ${keyword}`
    ];
    
    const injection = injectionPoints[Math.floor(Math.random() * injectionPoints.length)];
    
    // Insert before the last word or punctuation
    const lastSpaceIndex = message.lastIndexOf(' ');
    if (lastSpaceIndex > 0) {
      return message.slice(0, lastSpaceIndex) + injection + message.slice(lastSpaceIndex);
    }
    
    return message + injection;
  }

  /**
   * Generate enhanced metadata combining ML and template data
   */
  private generateEnhancedMetadata(template: LogTemplate, mlLogEntry: LogEntry): Record<string, any> {
    const enhancedMetadata: Record<string, any> = {
      // ML-specific metadata
      ml_enhanced: true,
      ml_confidence: 0.7 + Math.random() * 0.3,
      pattern_source: 'ml_learning',
      
      // Blend template metadata with ML metadata
      ...this.blendMetadata(template.metadata || {}, mlLogEntry.metadata || {}),
      
      // Add realistic business context
      business_context: this.generateBusinessContext(),
      
      // Add performance metrics if system-related
      ...(this.isSystemSource() ? this.generatePerformanceMetrics() : {}),
      
      // Add user context if user-related
      ...(this.isUserSource() ? this.generateUserContext() : {})
    };

    return enhancedMetadata;
  }

  /**
   * Blend metadata from template and ML sources
   */
  private blendMetadata(templateMetadata: Record<string, any>, mlMetadata: Record<string, any>): Record<string, any> {
    const blended: Record<string, any> = { ...mlMetadata };
    
    // Selectively add template metadata that doesn't conflict
    for (const [key, value] of Object.entries(templateMetadata)) {
      if (!blended[key] && Math.random() < 0.5) {
        blended[key] = value;
      }
    }
    
    return blended;
  }

  /**
   * Generate realistic business context
   */
  private generateBusinessContext(): Record<string, any> {
    const currentHour = new Date().getHours();
    const isBusinessHours = currentHour >= 9 && currentHour <= 17;
    const currentDay = new Date().getDay();
    const isWeekday = currentDay >= 1 && currentDay <= 5;

    return {
      business_hours: isBusinessHours,
      weekday: isWeekday,
      activity_level: this.calculateActivityLevel(currentHour, isBusinessHours),
      context_relevance: Math.random() > 0.3 ? 'high' : 'medium'
    };
  }

  /**
   * Calculate activity level based on time
   */
  private calculateActivityLevel(hour: number, isBusinessHours: boolean): 'low' | 'medium' | 'high' {
    if (!isBusinessHours) return 'low';
    
    // Peak hours: 10-11 AM, 2-3 PM
    if ((hour >= 10 && hour <= 11) || (hour >= 14 && hour <= 15)) {
      return 'high';
    }
    
    // Regular business hours
    if (hour >= 9 && hour <= 17) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate performance metrics for system sources
   */
  private generatePerformanceMetrics(): Record<string, any> {
    return {
      cpu_usage: Math.floor(Math.random() * 80) + 10, // 10-90%
      memory_usage: Math.floor(Math.random() * 70) + 20, // 20-90%
      response_time: Math.floor(Math.random() * 500) + 50, // 50-550ms
      throughput: Math.floor(Math.random() * 1000) + 100, // 100-1100 req/min
      error_rate: Math.random() * 0.05, // 0-5%
    };
  }

  /**
   * Generate user context for user-related sources
   */
  private generateUserContext(): Record<string, any> {
    const userTypes = ['employee', 'contractor', 'admin', 'service_account'];
    const departments = ['finance', 'hr', 'it', 'sales', 'marketing', 'operations'];
    
    return {
      user_type: userTypes[Math.floor(Math.random() * userTypes.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      session_id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      risk_score: Math.random() * 0.3, // 0-0.3 for normal users
    };
  }

  /**
   * Add source-specific enhancements
   */
  private addSourceSpecificEnhancements(logEntry: LogEntry, template: LogTemplate): void {
    switch (this.source.type) {
      case 'authentication':
        this.addAuthenticationEnhancements(logEntry);
        break;
      case 'firewall':
        this.addFirewallEnhancements(logEntry);
        break;
      case 'database':
        this.addDatabaseEnhancements(logEntry);
        break;
      case 'application':
        this.addApplicationEnhancements(logEntry);
        break;
      default:
        this.addGenericEnhancements(logEntry);
    }
  }

  /**
   * Add authentication-specific enhancements
   */
  private addAuthenticationEnhancements(logEntry: LogEntry): void {
    if (!logEntry.metadata) logEntry.metadata = {};
    
    logEntry.metadata.auth_method = this.selectAuthMethod();
    logEntry.metadata.client_ip = this.generateRealisticIP();
    logEntry.metadata.user_agent = this.generateRealisticUserAgent();
    
    if (logEntry.message.toLowerCase().includes('failed')) {
      logEntry.metadata.failure_reason = this.selectFailureReason();
      logEntry.metadata.attempt_count = Math.floor(Math.random() * 5) + 1;
    }
  }

  /**
   * Add firewall-specific enhancements
   */
  private addFirewallEnhancements(logEntry: LogEntry): void {
    if (!logEntry.metadata) logEntry.metadata = {};
    
    logEntry.metadata.src_ip = this.generateRealisticIP();
    logEntry.metadata.dst_ip = this.generateRealisticIP();
    logEntry.metadata.src_port = Math.floor(Math.random() * 65535) + 1;
    logEntry.metadata.dst_port = this.selectCommonPort();
    logEntry.metadata.protocol = this.selectProtocol();
    logEntry.metadata.bytes_transferred = Math.floor(Math.random() * 10000);
  }

  /**
   * Add database-specific enhancements
   */
  private addDatabaseEnhancements(logEntry: LogEntry): void {
    if (!logEntry.metadata) logEntry.metadata = {};
    
    logEntry.metadata.query_type = this.selectQueryType();
    logEntry.metadata.execution_time = Math.floor(Math.random() * 1000) + 10; // 10-1010ms
    logEntry.metadata.rows_affected = Math.floor(Math.random() * 1000);
    logEntry.metadata.database_name = this.selectDatabaseName();
    logEntry.metadata.table_name = this.selectTableName();
  }

  /**
   * Add application-specific enhancements
   */
  private addApplicationEnhancements(logEntry: LogEntry): void {
    if (!logEntry.metadata) logEntry.metadata = {};
    
    logEntry.metadata.request_id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logEntry.metadata.endpoint = this.selectEndpoint();
    logEntry.metadata.http_method = this.selectHttpMethod();
    logEntry.metadata.status_code = this.selectStatusCode();
    logEntry.metadata.response_size = Math.floor(Math.random() * 10000) + 100;
  }

  /**
   * Add generic enhancements
   */
  private addGenericEnhancements(logEntry: LogEntry): void {
    if (!logEntry.metadata) logEntry.metadata = {};
    
    logEntry.metadata.correlation_id = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logEntry.metadata.environment = process.env.NODE_ENV || 'development';
    logEntry.metadata.version = '1.0.0';
  }

  /**
   * Select ML template for MITRE mapping
   */
  private selectMLTemplate(): LogTemplate {
    // Create a virtual template for ML-generated logs
    return {
      messageTemplate: 'ML-generated log entry',
      level: 'INFO',
      probability: 1.0,
      metadata: {
        ml_generated: true
      }
    };
  }

  /**
   * Helper methods for realistic data generation
   */
  private selectAuthMethod(): string {
    const methods = ['password', 'mfa', 'sso', 'certificate', 'biometric'];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private generateRealisticIP(): string {
    // Generate realistic internal IP addresses
    const networks = [
      () => `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      () => `172.${16 + Math.floor(Math.random() * 16)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    ];
    
    const networkGenerator = networks[Math.floor(Math.random() * networks.length)];
    return networkGenerator();
  }

  private generateRealisticUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  private selectFailureReason(): string {
    const reasons = ['invalid_password', 'account_locked', 'expired_password', 'invalid_username', 'mfa_failed'];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  private selectCommonPort(): number {
    const commonPorts = [80, 443, 22, 23, 21, 25, 53, 110, 143, 993, 995, 3389, 5432, 3306];
    return commonPorts[Math.floor(Math.random() * commonPorts.length)];
  }

  private selectProtocol(): string {
    const protocols = ['TCP', 'UDP', 'ICMP', 'HTTP', 'HTTPS'];
    return protocols[Math.floor(Math.random() * protocols.length)];
  }

  private selectQueryType(): string {
    const types = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private selectDatabaseName(): string {
    const databases = ['users', 'products', 'orders', 'inventory', 'analytics', 'logs'];
    return databases[Math.floor(Math.random() * databases.length)];
  }

  private selectTableName(): string {
    const tables = ['users', 'sessions', 'transactions', 'products', 'orders', 'logs', 'events'];
    return tables[Math.floor(Math.random() * tables.length)];
  }

  private selectEndpoint(): string {
    const endpoints = ['/api/users', '/api/orders', '/api/products', '/api/auth', '/api/reports', '/health', '/metrics'];
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }

  private selectHttpMethod(): string {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    return methods[Math.floor(Math.random() * methods.length)];
  }

  private selectStatusCode(): number {
    const codes = [200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503];
    const weights = [0.6, 0.1, 0.05, 0.08, 0.03, 0.02, 0.05, 0.01, 0.03, 0.01, 0.01];
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < codes.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) {
        return codes[i];
      }
    }
    
    return 200; // Default
  }

  private isSystemSource(): boolean {
    return ['server', 'database', 'firewall', 'cloud'].includes(this.source.type);
  }

  private isUserSource(): boolean {
    return ['authentication', 'application', 'email'].includes(this.source.type);
  }

  /**
   * Enable or disable ML enhancement
   */
  public setMLEnabled(enabled: boolean): void {
    this.isMLEnabled = enabled;
    logger.info(`ML enhancement ${enabled ? 'enabled' : 'disabled'} for source: ${this.source.name}`);
  }

  /**
   * Update ML configuration
   */
  public updateMLConfig(newConfig: Partial<MLLogGenerationConfig>): void {
    this.mlConfig = { ...this.mlConfig, ...newConfig };
    this.patternEngine.updateConfig(this.mlConfig);
    logger.info(`ML configuration updated for source: ${this.source.name}`, { config: this.mlConfig });
  }

  /**
   * Get ML statistics
   */
  public getMLStatistics(): any {
    return {
      mlEnabled: this.isMLEnabled,
      patternEngineState: this.patternEngine.getState(),
      patternsLearned: this.patternEngine.getPatternsSummary(),
      config: this.mlConfig
    };
  }

  /**
   * Train patterns from historical data
   */
  public async trainFromHistoricalData(logFiles: string[]): Promise<void> {
    logger.info(`Training ML patterns from ${logFiles.length} files for source: ${this.source.name}`);
    await this.patternEngine.learnFromHistoricalData(logFiles);
    logger.info(`ML pattern training completed for source: ${this.source.name}`);
  }
}
