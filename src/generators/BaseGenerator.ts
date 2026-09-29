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
  private paused: boolean = false;
  private onLogGenerated?: (log: LogEntry) => void;

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
    this.onLogGenerated = onLogGenerated;

    logger.info(`Starting ${this.source.name} generator with frequency ${this.config.frequency} logs/min`);
    this.schedule();
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.paused = false;
    this.clearTimer();
    logger.info(`Stopped ${this.source.name} generator`);
  }

  /** Stop producing logs for now (e.g. while output catches up); the generator stays running */
  public pause(): void {
    if (!this.isRunning || this.paused) return;
    this.paused = true;
    this.clearTimer();
  }

  public resume(): void {
    if (!this.isRunning || !this.paused) return;
    this.paused = false;
    this.schedule();
  }

  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * Every tick emits the logs that are due since scheduling started, so the rate matches
   * `frequency` (logs per minute) exactly over time. After a pause, or if generation falls more
   * than a second behind, counting restarts instead of bursting to catch up.
   */
  private schedule(): void {
    const perMs = this.config.frequency / 60000;
    const intervalMs = this.tickIntervalMs(this.config.frequency);
    const maxBacklog = Math.max(1, Math.ceil(perMs * 1000));
    let startedAt = Date.now();
    let emitted = 0;

    this.intervalId = setInterval(() => {
      try {
        let due = Math.floor((Date.now() - startedAt) * perMs) - emitted;
        if (due > maxBacklog) {
          // Too far behind (e.g. output is the bottleneck): skip the backlog rather than burst
          startedAt = Date.now() - intervalMs;
          emitted = 0;
          due = Math.floor(intervalMs * perMs);
        }
        for (let i = 0; i < due && !this.paused; i++) {
          emitted++;
          this.onLogGenerated?.(this.generateLogEntry());
        }
      } catch (error) {
        logger.error(`Error generating log batch for ${this.source.name}:`, error);
      }
    }, intervalMs);
  }

  private clearTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /** Generate `count` logs immediately, as fast as possible (no timer; used by the benchmark) */
  public generateLogs(count: number): LogEntry[] {
    const logs: LogEntry[] = [];
    for (let i = 0; i < count; i++) {
      logs.push(this.generateLogEntry());
    }
    return logs;
  }

  protected generateLogEntry(): LogEntry {
    const template = this.selectTemplate();
    const rendered = TemplateEngine.render(template.messageTemplate, { ...this.config.metadata, ...template.metadata });
    const message = rendered.message;
    const metadata = TemplateEngine.generateMetadata({
      host: this.source.host || this.source.name,
      ...rendered.metadata,
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

  /** Timer interval: one tick per log at low rates, up to 100 ticks a second at high rates */
  private tickIntervalMs(logsPerMinute: number): number {
    if (logsPerMinute <= 20) return 60000 / logsPerMinute;
    if (logsPerMinute <= 1000) return 100;
    if (logsPerMinute <= 10000) return 50;
    return 10;
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
    // Handle missing templates by creating a default one
    if (!this.config.templates || !Array.isArray(this.config.templates) || this.config.templates.length === 0) {
      return {
        level: 'INFO',
        messageTemplate: `${this.source.type} activity on ${this.source.name || this.source.host}`,
        probability: 1.0,
        metadata: {
          component: this.source.component || this.source.type
        }
      };
    }

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
