/**
 * Python ML Bridge - Secure Integration
 * Connects TypeScript ML features with Python ML libraries in virtual environment
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import { LogEntry } from '../types';

export interface PythonMLConfig {
  virtualEnvPath: string;
  scriptsPath: string;
  timeoutMs: number;
}

export interface MLAnalysisResult {
  patterns: any[];
  anomalies: any[];
  predictions: any[];
  confidence: number;
  metadata: {
    processingTime: number;
    samplesAnalyzed: number;
    modelVersion: string;
  };
}

export class PythonMLBridge {
  private config: PythonMLConfig;
  private pythonPath: string;

  constructor(config?: Partial<PythonMLConfig>) {
    this.config = {
      virtualEnvPath: path.join(process.cwd(), 'ml-env'),
      scriptsPath: path.join(process.cwd(), 'python'),
      timeoutMs: 30000,
      ...config
    };

    // Set Python path to virtual environment
    this.pythonPath = path.join(this.config.virtualEnvPath, 'bin', 'python3');
    
    // Verify virtual environment exists
    if (!fs.existsSync(this.pythonPath)) {
      throw new Error(`Python virtual environment not found at: ${this.pythonPath}`);
    }
  }

  /**
   * Verify ML dependencies are installed and working
   */
  async verifyDependencies(): Promise<boolean> {
    try {
      const result = await this.executePython('verify_ml_deps.py', {});
      return result.success === true;
    } catch (error) {
      logger.error('ML dependency verification failed:', error);
      return false;
    }
  }

  /**
   * Learn patterns from historical log data
   */
  async learnPatterns(logFiles: string[]): Promise<MLAnalysisResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting ML pattern learning for ${logFiles.length} files`);
      
      const result = await this.executePython('pattern_learning.py', {
        log_files: logFiles,
        analysis_type: 'comprehensive'
      });

      const processingTime = Date.now() - startTime;
      
      return {
        patterns: result.patterns || [],
        anomalies: result.anomalies || [],
        predictions: result.predictions || [],
        confidence: result.confidence || 0,
        metadata: {
          processingTime,
          samplesAnalyzed: result.samples_analyzed || 0,
          modelVersion: result.model_version || '1.0.0'
        }
      };
    } catch (error) {
      logger.error('Pattern learning failed:', error);
      throw new Error(`ML pattern learning failed: ${error}`);
    }
  }

  /**
   * Generate realistic log entries using learned patterns
   */
  async generateRealisticLogs(
    source: string, 
    count: number, 
    options: any = {}
  ): Promise<LogEntry[]> {
    try {
      logger.info(`Generating ${count} realistic logs for source: ${source}`);
      
      const result = await this.executePython('log_generation.py', {
        source,
        count,
        options
      });

      return result.logs || [];
    } catch (error) {
      logger.error('ML log generation failed:', error);
      throw new Error(`ML log generation failed: ${error}`);
    }
  }

  /**
   * Detect anomalies in log data
   */
  async detectAnomalies(logs: LogEntry[]): Promise<any[]> {
    try {
      logger.info(`Analyzing ${logs.length} logs for anomalies`);
      
      const result = await this.executePython('anomaly_detection.py', {
        logs,
        threshold: 0.1
      });

      return result.anomalies || [];
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
      throw new Error(`Anomaly detection failed: ${error}`);
    }
  }

  /**
   * Execute Python script in virtual environment with security measures
   */
  private async executePython(scriptName: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.config.scriptsPath, scriptName);
      
      // Security check - ensure script exists and is in allowed directory
      if (!fs.existsSync(scriptPath)) {
        reject(new Error(`Python script not found: ${scriptPath}`));
        return;
      }

      if (!scriptPath.startsWith(this.config.scriptsPath)) {
        reject(new Error(`Security violation: Script path outside allowed directory`));
        return;
      }

      // Spawn Python process with timeout
      const child: ChildProcess = spawn(this.pythonPath, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeoutMs,
        env: {
          ...process.env,
          PYTHONPATH: this.config.virtualEnvPath,
          PATH: `${path.join(this.config.virtualEnvPath, 'bin')}:${process.env.PATH}`
        }
      });

      let stdout = '';
      let stderr = '';

      // Send input data as JSON
      if (child.stdin) {
        child.stdin.write(JSON.stringify(data));
        child.stdin.end();
      }

      // Collect output
      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
      }

      // Handle completion
      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${stdout}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        }
      });

      // Handle timeout
      child.on('error', (error) => {
        reject(new Error(`Python execution error: ${error.message}`));
      });
    });
  }

  /**
   * Get ML engine status
   */
  async getStatus(): Promise<any> {
    try {
      const depsOk = await this.verifyDependencies();
      
      return {
        status: depsOk ? 'ready' : 'dependencies_missing',
        virtualEnvPath: this.config.virtualEnvPath,
        pythonPath: this.pythonPath,
        dependencies: depsOk,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      };
    }
  }
}
