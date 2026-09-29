import { startWorker } from './workerScript';

describe('startWorker', () => {
  it('starts a TypeScript worker module from source and passes it workerData', async () => {
    // The generation worker answers invalid data with an error message, which proves it loaded and ran
    const worker = startWorker(__dirname, 'generationWorker', { workerData: { generators: null, index: 0, count: 1 } });

    const reply = await new Promise<{ type: string }>((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
    });
    await worker.terminate();

    expect(reply.type).toBe('error');
  }, 30000);
});
