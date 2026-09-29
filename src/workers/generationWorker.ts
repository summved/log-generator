/**
 * Generation worker thread: runs the real generators (on their normal timers, at this worker's
 * share of the configured rate) and sends the logs to the main thread in batches.
 * The main thread applies MITRE filters, metrics and output, exactly as without workers.
 */

import { parentPort, workerData } from 'worker_threads';
import { createGenerators } from '../generators/createGenerators';
import { Config, LogEntry } from '../types';
import { timestampSequencer } from '../utils/timestampSequencer';
import { Backpressure } from './backpressure';

export interface GenerationWorkerData {
  generators: Config['generators'];
  index: number;
  count: number;
}

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'logs'; id: number; logs: LogEntry[] }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

export type MainToWorker = { type: 'stop' } | { type: 'ack'; id: number };

/** Send a batch at least this often, or sooner once it reaches BATCH_LIMIT logs */
export const FLUSH_MS = 50;
export const BATCH_LIMIT = 2000;
/** Pause this worker's generators while this many logs are waiting for the main thread to write them */
export const MAX_UNACKED_LOGS = 20000;

if (parentPort) {
  const port = parentPort;
  const data = workerData as GenerationWorkerData;
  let batch: LogEntry[] = [];
  let nextId = 0;
  const waitingForAck = new Map<number, () => void>();
  const send = (message: WorkerToMain) => port.postMessage(message);

  try {
    // Thread i of n uses its own sub-millisecond slots, so timestamps never collide across threads
    timestampSequencer.useSlots(data.index, data.count);
    const generators = [...createGenerators(data.generators).values()];
    const pressure = new Backpressure(MAX_UNACKED_LOGS,
      () => generators.forEach(generator => generator.pause()),
      () => generators.forEach(generator => generator.resume()));
    const flush = () => {
      if (batch.length === 0) return;
      const id = nextId++;
      pressure.track(new Promise<void>(resolve => waitingForAck.set(id, resolve)), batch.length);
      send({ type: 'logs', id, logs: batch });
      batch = [];
    };
    const timer = setInterval(flush, FLUSH_MS);

    port.on('message', (message: MainToWorker) => {
      if (message.type === 'ack') {
        waitingForAck.get(message.id)?.();
        waitingForAck.delete(message.id);
        return;
      }
      generators.forEach(generator => generator.stop());
      clearInterval(timer);
      flush();
      send({ type: 'stopped' });
      port.close();
    });

    for (const generator of generators) {
      generator.start(log => {
        batch.push(log);
        if (batch.length >= BATCH_LIMIT) flush();
      });
    }
    send({ type: 'ready' });
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    port.close();
  }
}
