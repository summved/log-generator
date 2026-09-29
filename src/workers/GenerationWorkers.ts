/**
 * Main-thread side of generation with worker threads: starts `count` generation workers,
 * each with an equal share of every generator's rate, and hands their logs to `onLogs`.
 */

import { Worker } from 'worker_threads';
import { Config, LogEntry } from '../types';
import { logger } from '../utils/logger';
import { GenerationWorkerData, MainToWorker, WorkerToMain } from './generationWorker';
import { splitGenerators } from './splitGenerators';
import { startWorker } from './workerScript';

const STOP_TIMEOUT_MS = 5000;

export class GenerationWorkers {
  private workers: Worker[] = [];

  constructor(private readonly count: number) {}

  /**
   * Resolves once every worker has started its generators. `onLogs` may return a promise: the
   * worker counts the batch as in flight until it settles, and pauses when too much is in flight.
   */
  public async start(generators: Config['generators'], onLogs: (logs: LogEntry[]) => unknown): Promise<void> {
    const shares = splitGenerators(generators, this.count);
    this.workers = shares.map((share, index) => startWorker(__dirname, 'generationWorker', {
      workerData: { generators: share, index, count: this.count } satisfies GenerationWorkerData
    }));

    try {
      await Promise.all(this.workers.map((worker, index) => new Promise<void>((resolve, reject) => {
        worker.on('message', (message: WorkerToMain) => {
          if (message.type === 'logs') {
            const ack = () => worker.postMessage({ type: 'ack', id: message.id } satisfies MainToWorker);
            Promise.resolve(onLogs(message.logs)).then(ack, error => {
              logger.error('Failed to handle logs from a generation worker:', error);
              ack();
            });
          }
          else if (message.type === 'ready') resolve();
          else if (message.type === 'error') reject(new Error(`Generation worker ${index} failed: ${message.message}`));
        });
        worker.once('error', error => {
          logger.error(`Generation worker ${index} error:`, error);
          reject(error);
        });
      })));
    } catch (error) {
      await this.terminate();
      throw error;
    }
    logger.info(`Generating with ${this.count} worker threads`);
  }

  /** Stop the generators in every worker and wait for their last logs */
  public async stop(): Promise<void> {
    await Promise.all(this.workers.map(worker => new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        logger.warn('A generation worker did not stop in time; terminating it');
        worker.terminate().then(() => resolve(), () => resolve());
      }, STOP_TIMEOUT_MS);
      worker.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      worker.postMessage({ type: 'stop' } satisfies MainToWorker);
    })));
    this.workers = [];
  }

  public get size(): number {
    return this.workers.length;
  }

  private async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
  }
}
