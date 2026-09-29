import * as path from 'path';
import { Worker, WorkerOptions } from 'worker_threads';

/**
 * Start a worker from a sibling module (`name` without extension). Running from TypeScript
 * source (ts-node, jest) the worker needs a TypeScript loader too; from dist/ it runs the .js file.
 */
export function startWorker(dir: string, name: string, options: WorkerOptions = {}): Worker {
  const extension = path.extname(__filename);
  const execArgv = extension === '.ts' ? ['--require', 'ts-node/register/transpile-only'] : [];
  return new Worker(path.join(dir, `${name}${extension}`), { ...options, execArgv: [...execArgv, ...(options.execArgv || [])] });
}
