import { Config } from '../types';
import { logger } from './logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export class ConfigValidator {
  // Performance thresholds - Advisory only, not restrictive
  private static readonly RECOMMENDED_MAX_FREQUENCY = 60000; // 1000 logs/second - recommended safe limit
  private static readonly HIGH_PERFORMANCE_FREQUENCY = 300000; // 5000 logs/second - high performance warning
  private static readonly EXTREME_FREQUENCY = 600000; // 10000 logs/second - extreme performance warning
  private static readonly RECOMMENDED_MAX_BATCH_SIZE = 1000;
  private static readonly RECOMMENDED_MIN_FLUSH_INTERVAL = 100; // ms
  private static readonly RECOMMENDED_MAX_FILE_SIZE_GB = 5;
  private static readonly RECOMMENDED_MIN_RETENTION_DAYS = 7;

  /**
   * Validate configuration for safety and performance
   */
  public static validateConfig(config: Config): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    // Validate generators
    this.validateGenerators(config, result);
    
    // Validate output settings
    this.validateOutput(config, result);
    
    // Validate storage settings
    this.validateStorage(config, result);
    
    // Validate replay settings
    this.validateReplay(config, result);

    // Overall system validation
    this.validateSystemLimits(config, result);

    // Set overall validity
    result.isValid = result.errors.length === 0;

    return result;
  }

  private static validateGenerators(config: Config, result: ValidationResult): void {
    let totalFrequency = 0;
    let enabledGenerators = 0;

    Object.entries(config.generators).forEach(([name, generator]) => {
      if (generator.enabled) {
        enabledGenerators++;
        const frequency = generator.frequency || 0;
        totalFrequency += frequency;

        // Check individual generator frequency - Advisory warnings only
        if (frequency > this.EXTREME_FREQUENCY) {
          result.warnings.push(
            `⚠️ EXTREME: Generator '${name}' frequency ${frequency.toLocaleString()} (${(frequency/60).toLocaleString()} logs/sec) - Requires high-end hardware and careful monitoring`
          );
          result.recommendations.push(
            `For generator '${name}': Ensure SSD/NVMe storage, sufficient RAM (8GB+), and monitor CPU/disk I/O closely`
          );
        } else if (frequency > this.HIGH_PERFORMANCE_FREQUENCY) {
          result.warnings.push(
            `⚠️ HIGH: Generator '${name}' frequency ${frequency.toLocaleString()} (${(frequency/60).toLocaleString()} logs/sec) - Monitor system resources`
          );
        } else if (frequency > this.RECOMMENDED_MAX_FREQUENCY) {
          result.warnings.push(
            `Generator '${name}' frequency ${frequency.toLocaleString()} is above recommended safe limit (${this.RECOMMENDED_MAX_FREQUENCY.toLocaleString()})`
          );
        }

        // Check if templates are defined for enabled generators
        if (!generator.templates || generator.templates.length === 0) {
          result.warnings.push(
            `Generator '${name}' is enabled but has no templates defined`
          );
        }
      }
    });

    // Check total system load - Advisory warnings only
    const totalLogsPerSecond = Math.round(totalFrequency / 60);
    if (totalFrequency > this.EXTREME_FREQUENCY * 2) {
      result.warnings.push(
        `🚨 CRITICAL: Total system frequency ${totalFrequency.toLocaleString()} logs/min (${totalLogsPerSecond.toLocaleString()} logs/sec) - This is extremely high and may cause system instability`
      );
      result.recommendations.push(
        `CRITICAL SYSTEM REQUIREMENTS: High-end server hardware, enterprise SSD storage, 16GB+ RAM, dedicated log processing server recommended`
      );
    } else if (totalFrequency > this.EXTREME_FREQUENCY) {
      result.warnings.push(
        `⚠️ EXTREME: Total system frequency ${totalFrequency.toLocaleString()} logs/min (${totalLogsPerSecond.toLocaleString()} logs/sec) - Requires careful resource monitoring`
      );
    } else if (totalFrequency > this.HIGH_PERFORMANCE_FREQUENCY) {
      result.warnings.push(
        `⚠️ HIGH: Total system frequency ${totalFrequency.toLocaleString()} logs/min (${totalLogsPerSecond.toLocaleString()} logs/sec) - Monitor system performance`
      );
    }

    if (enabledGenerators === 0) {
      result.warnings.push('No generators are enabled - no logs will be generated');
    }

    // Performance recommendations based on load
    if (totalFrequency > this.EXTREME_FREQUENCY) {
      result.recommendations.push(
        '🔧 EXTREME PERFORMANCE SETUP: Use enterprise-grade hardware, NVMe SSD storage, 16GB+ RAM'
      );
      result.recommendations.push(
        '📊 MONITORING: Set up system monitoring for CPU, memory, disk I/O, and network usage'
      );
      result.recommendations.push(
        '⚙️ OPTIMIZATION: Enable batching, use fast flush intervals, consider log compression'
      );
    } else if (totalFrequency > this.HIGH_PERFORMANCE_FREQUENCY) {
      result.recommendations.push(
        'For high-frequency generation, ensure adequate system resources (CPU, memory, disk I/O)'
      );
      result.recommendations.push(
        'Consider using batching and file rotation to manage high log volumes'
      );
    }
  }

  private static validateOutput(config: Config, result: ValidationResult): void {
    const output = config.output;

    // Validate batching settings (using any cast since batching is not in type definition)
    const batchingConfig = (output as any).batching;
    if (batchingConfig?.enabled) {
      const maxBatchSize = batchingConfig.maxBatchSize || 100;
      const flushInterval = batchingConfig.flushIntervalMs || 1000;

      if (maxBatchSize > this.RECOMMENDED_MAX_BATCH_SIZE) {
        result.warnings.push(
          `Batch size ${maxBatchSize} is above recommended limit (${this.RECOMMENDED_MAX_BATCH_SIZE}) - Monitor memory usage`
        );
      }

      if (flushInterval < this.RECOMMENDED_MIN_FLUSH_INTERVAL) {
        result.warnings.push(
          `Flush interval ${flushInterval}ms is below recommended minimum (${this.RECOMMENDED_MIN_FLUSH_INTERVAL}ms) - May impact performance`
        );
      }
    }

    // Validate file settings
    if (output.destination === 'file' && output.file) {
      const maxSizeStr = output.file.maxSize || '100MB';
      const maxSizeGB = this.parseFileSize(maxSizeStr);

      if (maxSizeGB > this.RECOMMENDED_MAX_FILE_SIZE_GB) {
        result.warnings.push(
          `File size limit ${maxSizeStr} is above recommended limit (${this.RECOMMENDED_MAX_FILE_SIZE_GB}GB) - May cause issues with log processing tools`
        );
      }

      if (!output.file.rotation) {
        result.recommendations.push(
          'Enable file rotation to prevent log files from growing too large'
        );
      }
    }

    // Validate destination-specific settings
    if (output.destination === 'http' && !output.http?.url) {
      result.errors.push('HTTP destination requires a URL to be specified');
    }

    if (output.destination === 'syslog' && !output.syslog?.host) {
      result.errors.push('Syslog destination requires a host to be specified');
    }
  }

  private static validateStorage(config: Config, result: ValidationResult): void {
    const storage = config.storage;

    if (storage.retention < this.RECOMMENDED_MIN_RETENTION_DAYS) {
      result.warnings.push(
        `Retention period ${storage.retention} days is below recommended minimum (${this.RECOMMENDED_MIN_RETENTION_DAYS} days) - May not meet compliance requirements`
      );
    }

    // Check paths
    if (!storage.currentPath || !storage.historicalPath) {
      result.errors.push('Storage paths must be specified for current and historical logs');
    }

    if (storage.currentPath === storage.historicalPath) {
      result.warnings.push(
        'Current and historical storage paths are the same - this may cause conflicts'
      );
    }
  }

  private static validateReplay(config: Config, result: ValidationResult): void {
    const replay = config.replay;

    if (replay.enabled) {
      if (replay.speed && (replay.speed < 0.1 || replay.speed > 100)) {
        result.warnings.push(
          `Replay speed ${replay.speed} is extreme and may cause timing issues`
        );
      }

      if (replay.batchSize && replay.batchSize > 1000) {
        result.warnings.push(
          `Replay batch size ${replay.batchSize} is very large and may impact performance`
        );
      }
    }
  }

  private static validateSystemLimits(config: Config, result: ValidationResult): void {
    // Calculate estimated resource usage
    const totalFrequency = Object.values(config.generators)
      .filter(g => g.enabled)
      .reduce((sum, g) => sum + (g.frequency || 0), 0);

    const estimatedLogsPerSecond = totalFrequency / 60;
    const estimatedMBPerSecond = estimatedLogsPerSecond * 0.5; // Assume ~500 bytes per log

    if (estimatedMBPerSecond > 100) {
      result.warnings.push(
        `Estimated disk I/O: ${estimatedMBPerSecond.toFixed(1)} MB/s - ensure adequate disk performance`
      );
    }

    if (estimatedLogsPerSecond > 10000) {
      result.warnings.push(
        `Estimated log rate: ${estimatedLogsPerSecond.toFixed(0)} logs/s - this is extremely high`
      );
      result.recommendations.push(
        'Consider using a high-performance storage solution (SSD, NVMe) for such high log rates'
      );
    }

    // Memory usage estimation
    const batchSize = (config.output as any).batching?.maxBatchSize || 100;
    const estimatedMemoryMB = (batchSize * 0.5 * Object.keys(config.generators).length) / 1024;

    if (estimatedMemoryMB > 500) {
      result.warnings.push(
        `Estimated memory usage: ${estimatedMemoryMB.toFixed(1)} MB - monitor memory consumption`
      );
    }
  }

  private static parseFileSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(GB|MB|KB)?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'MB').toUpperCase();

    switch (unit) {
      case 'GB': return value;
      case 'MB': return value / 1024;
      case 'KB': return value / (1024 * 1024);
      default: return value / (1024 * 1024); // Assume bytes
    }
  }

  /**
   * Log validation results
   */
  public static logValidationResults(result: ValidationResult): void {
    if (result.errors.length > 0) {
      logger.error('Configuration validation errors:');
      result.errors.forEach(error => logger.error(`  ❌ ${error}`));
    }

    if (result.warnings.length > 0) {
      logger.warn('Configuration validation warnings:');
      result.warnings.forEach(warning => logger.warn(`  ⚠️ ${warning}`));
    }

    if (result.recommendations.length > 0) {
      logger.info('Configuration recommendations:');
      result.recommendations.forEach(rec => logger.info(`  💡 ${rec}`));
    }

    if (result.isValid && result.warnings.length === 0 && result.recommendations.length === 0) {
      logger.info('✅ Configuration validation passed with no issues');
    }
  }
}
