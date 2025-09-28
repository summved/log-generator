/**
 * High-Performance Log Generator Worker
 * Uses worker threads for parallel log generation while maintaining SIEM compatibility
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { LogEntry, LogSource, LogTemplate } from '../types';
import { TemplateEngine } from '../utils/templateEngine';

interface WorkerConfig {
  source: LogSource;
  templates: LogTemplate[];
  logsPerBatch: number;
  workerId: number;
}

interface WorkerResult {
  logs: LogEntry[];
  workerId: number;
  generationTime: number;
}

/**
 * Worker Thread Implementation
 * Runs in separate thread for parallel processing
 */
if (!isMainThread) {
  const config: WorkerConfig = workerData;
  
  // Initialize template engine in worker context
  const templateEngine = new TemplateEngine();
  
  // Worker message handler
  parentPort?.on('message', async (message: { 
    command: string; 
    count?: number; 
    source?: LogSource; 
    templates?: LogTemplate[] 
  }) => {
    if (message.command === 'generate') {
      const startTime = process.hrtime.bigint();
      const logs: LogEntry[] = [];
      const count = message.count || config.logsPerBatch;
      const source = message.source || config.source;
      const templates = message.templates || config.templates;
      
      // Generate logs in batch for maximum performance
      for (let i = 0; i < count; i++) {
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: template.level,
          source: source,
          message: TemplateEngine.processTemplate(template.messageTemplate, template.metadata || {}),
          metadata: {
            ...template.metadata,
            workerId: config.workerId,
            batchIndex: i
          }
        };
        
        // Add MITRE ATT&CK info if present
        if (template.mitre) {
          logEntry.mitre = template.mitre;
        }
        
        // Add D3FEND info if present
        if (template.d3fend) {
          logEntry.d3fend = template.d3fend;
        }
        
        logs.push(logEntry);
      }
      
      const endTime = process.hrtime.bigint();
      const generationTime = Number(endTime - startTime) / 1000000; // Convert to ms
      
      const result: WorkerResult = {
        logs,
        workerId: config.workerId,
        generationTime
      };
      
      parentPort?.postMessage(result);
    }
  });
  
  // Signal worker is ready
  parentPort?.postMessage({ ready: true, workerId: config.workerId });
}

/**
 * Main Thread Worker Pool Manager
 */
export class WorkerPoolManager {
  private workers: Worker[] = [];
  private workerQueue: number[] = [];
  private pendingRequests = new Map<number, (result: WorkerResult) => void>();
  private requestId = 0;
  
  constructor(private workerCount: number = 4) {
    this.initializeWorkers();
  }
  
  private initializeWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          // Will be set per generation request
        }
      });
      
      worker.on('message', (message) => {
        if (message.ready) {
          this.workerQueue.push(message.workerId);
          return;
        }
        
        // Handle generation result
        const result: WorkerResult = message;
        const callback = this.pendingRequests.get(result.workerId);
        if (callback) {
          callback(result);
          this.pendingRequests.delete(result.workerId);
          this.workerQueue.push(result.workerId); // Return worker to queue
        }
      });
      
      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
      });
      
      this.workers[i] = worker;
    }
  }
  
  /**
   * Generate logs using worker pool
   * Returns promise that resolves with generated logs
   */
  public async generateLogs(
    source: LogSource,
    templates: LogTemplate[],
    count: number
  ): Promise<LogEntry[]> {
    return new Promise((resolve, reject) => {
      // Wait for available worker
      const checkWorker = () => {
        if (this.workerQueue.length > 0) {
          const workerId = this.workerQueue.shift()!;
          const worker = this.workers[workerId];
          
          // Set up response handler
          this.pendingRequests.set(workerId, (result: WorkerResult) => {
            resolve(result.logs);
          });
          
          // Send generation request
          worker.postMessage({
            command: 'generate',
            count,
            source,
            templates
          });
        } else {
          // No workers available, wait a bit
          setTimeout(checkWorker, 1);
        }
      };
      
      checkWorker();
    });
  }
  
  /**
   * Generate logs in parallel across multiple workers
   */
  public async generateLogsParallel(
    source: LogSource,
    templates: LogTemplate[],
    totalCount: number
  ): Promise<LogEntry[]> {
    const logsPerWorker = Math.ceil(totalCount / this.workerCount);
    const promises: Promise<LogEntry[]>[] = [];
    
    for (let i = 0; i < this.workerCount; i++) {
      const count = Math.min(logsPerWorker, totalCount - (i * logsPerWorker));
      if (count > 0) {
        promises.push(this.generateLogs(source, templates, count));
      }
    }
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  /**
   * Cleanup worker pool
   */
  public async terminate(): Promise<void> {
    const terminationPromises = this.workers.map(worker => worker.terminate());
    await Promise.all(terminationPromises);
  }
}

export default WorkerPoolManager;
