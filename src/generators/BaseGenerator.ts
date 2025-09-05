import { LogEntry, LogSource, GeneratorConfig, LogTemplate } from '../types';
import { TemplateEngine } from '../utils/templateEngine';
import { logger } from '../utils/logger';
import { timestampSequencer } from '../utils/timestampSequencer';

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
    const intervalMs = (60 / this.config.frequency) * 1000; // Convert frequency to milliseconds

    logger.info(`Starting ${this.source.name} generator with frequency ${this.config.frequency} logs/min`);

    this.intervalId = setInterval(() => {
      try {
        const logEntry = this.generateLogEntry();
        onLogGenerated(logEntry);
      } catch (error) {
        logger.error(`Error generating log for ${this.source.name}:`, error);
      }
    }, intervalMs);
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

    return {
      timestamp: timestampSequencer.getUniqueTimestamp(),
      level: template.level,
      source: this.source,
      message,
      metadata
    };
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
