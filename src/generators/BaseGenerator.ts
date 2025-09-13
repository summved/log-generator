import { LogEntry, LogSource, GeneratorConfig, LogTemplate } from '../types';
import { TemplateEngine } from '../utils/templateEngine';
import { logger } from '../utils/logger';
import { timestampSequencer } from '../utils/timestampSequencer';
import { mitreMapper } from '../utils/mitreMapper';

export abstract class BaseGenerator {
  protected source: LogSource;
  protected config: GeneratorConfig;
  protected isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(source: LogSource, config: GeneratorConfig) {
    this.source = source;
    this.config = config;
  }

  public start(onLogGenerated: (log: LogEntry) => void): void {
    if (this.isRunning) {
      logger.warn(`Generator for ${this.source.name} is already running`);
      return;
    }

    if (!this.config.enabled) {
      logger.info(`Generator for ${this.source.name} is disabled`);
      return;
    }

    this.isRunning = true;
    
    // Batch Generation Optimization: Dynamic batching based on frequency
    const batchConfig = this.calculateBatchConfig(this.config.frequency);
    
    logger.info(`Starting ${this.source.name} generator with frequency ${this.config.frequency} logs/min (batch: ${batchConfig.logsPerBatch} logs every ${batchConfig.intervalMs}ms)`);

    this.intervalId = setInterval(() => {
      try {
        // Generate batch of logs for high-frequency generators
        for (let i = 0; i < batchConfig.logsPerBatch; i++) {
          const logEntry = this.generateLogEntry();
          onLogGenerated(logEntry);
        }
      } catch (error) {
        logger.error(`Error generating log batch for ${this.source.name}:`, error);
      }
    }, batchConfig.intervalMs);
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info(`Stopped ${this.source.name} generator`);
  }

  protected generateLogEntry(): LogEntry {
    const template = this.selectTemplate();
    const message = TemplateEngine.processTemplate(template.messageTemplate, template.metadata);
    const metadata = TemplateEngine.generateMetadata({
      ...this.config.metadata,
      ...template.metadata,
      generator: this.source.name
    });

    const logEntry: LogEntry = {
      timestamp: timestampSequencer.getUniqueTimestamp(),
      level: template.level,
      source: this.source,
      message,
      metadata
    };

    // Add MITRE ATT&CK technique mapping
    this.addMitreTechnique(logEntry, template);

    return logEntry;
  }

  /**
   * Calculate optimal batch configuration based on target frequency
   * Low frequencies: No batching (maintains exact timing)
   * High frequencies: Batch generation (improves performance)
   */
  private calculateBatchConfig(targetFrequency: number): { logsPerBatch: number; intervalMs: number } {
    // Frequency threshold for batching (logs/minute)
    const BATCH_THRESHOLD = 20;
    
    if (targetFrequency <= BATCH_THRESHOLD) {
      // Low frequency: Use original approach (1 log per timer tick)
      return {
        logsPerBatch: 1,
        intervalMs: (60 / targetFrequency) * 1000
      };
    }
    
    // High frequency: Use batch generation for maximum performance
    // Strategy: Optimize timer frequency and batch size for target throughput
    
    let timerFrequencyHz: number;
    let intervalMs: number;
    
    if (targetFrequency <= 1000) {
      // Medium-high frequency: 10 Hz timer (100ms intervals)
      timerFrequencyHz = 10;
      intervalMs = 100;
    } else if (targetFrequency <= 10000) {
      // Very high frequency: 20 Hz timer (50ms intervals)
      timerFrequencyHz = 20;
      intervalMs = 50;
    } else {
      // Extreme frequency: 100 Hz timer (10ms intervals)
      timerFrequencyHz = 100;
      intervalMs = 10;
    }
    
    // Calculate logs per batch to achieve exact target frequency
    const targetLogsPerSecond = targetFrequency / 60;
    const logsPerBatch = Math.max(1, Math.round(targetLogsPerSecond / timerFrequencyHz));
    
    return {
      logsPerBatch,
      intervalMs
    };
  }

  /**
   * Adds MITRE ATT&CK technique information to the log entry
   */
  protected addMitreTechnique(logEntry: LogEntry, template: LogTemplate): void {
    // First, check if the template already has MITRE information
    if (template.mitre) {
      logEntry.mitre = { ...template.mitre };
      return;
    }

    // If not, try to automatically map the log message to a MITRE technique
    const mitreInfo = mitreMapper.mapLogToTechnique(logEntry.message, logEntry.metadata);
    if (mitreInfo) {
      logEntry.mitre = mitreInfo;
      logger.debug(`Auto-mapped log to MITRE technique: ${mitreInfo.technique}`);
    }
  }

  private selectTemplate(): LogTemplate {
    const random = Math.random();
    let cumulativeProbability = 0;

    for (const template of this.config.templates) {
      cumulativeProbability += template.probability;
      if (random <= cumulativeProbability) {
        return template;
      }
    }

    // Fallback to the first template if probabilities don't add up to 1
    return this.config.templates[0];
  }

  public isGeneratorRunning(): boolean {
    return this.isRunning;
  }

  public getSource(): LogSource {
    return this.source;
  }

  public updateConfig(config: GeneratorConfig): void {
    this.config = config;
    if (this.isRunning) {
      this.stop();
      // Restart with new config would need to be handled by the caller
    }
  }
}
