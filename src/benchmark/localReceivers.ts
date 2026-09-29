/**
 * Local HTTP and UDP syslog receivers for the output benchmark. They run in their own worker thread
 * (so they do not share the sender's event loop), listen on 127.0.0.1 only and just count what arrives.
 */

import { Worker } from 'worker_threads';

export interface ReceiverCounts {
  httpLogs: number;
  httpRequests: number;
  syslogMessages: number;
}

export interface LocalReceivers {
  httpUrl: string;
  syslogPort: number;
  counts(): Promise<ReceiverCounts>;
  /** Wait until the counts stop changing (in-flight requests have landed), then return them */
  settledCounts(quietMs?: number, maxWaitMs?: number): Promise<ReceiverCounts>;
  stop(): Promise<void>;
}

const RECEIVER_CODE = `
const { parentPort } = require('worker_threads');
const http = require('http');
const dgram = require('dgram');
const counts = { httpLogs: 0, httpRequests: 0, syslogMessages: 0 };
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    counts.httpRequests++;
    try {
      const parsed = JSON.parse(body);
      counts.httpLogs += Array.isArray(parsed.logs) ? parsed.logs.length : 1;
    } catch (error) {
      counts.httpParseErrors = (counts.httpParseErrors || 0) + 1;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
const udp = dgram.createSocket('udp4');
udp.on('message', () => { counts.syslogMessages++; });
parentPort.on('message', message => {
  if (message === 'counts') parentPort.postMessage({ counts: { ...counts } });
  if (message === 'stop') { server.close(); udp.close(); parentPort.postMessage({ stopped: true }); }
});
server.listen(0, '127.0.0.1', () => {
  udp.bind(0, '127.0.0.1', () => {
    parentPort.postMessage({ ready: true, httpPort: server.address().port, udpPort: udp.address().port });
  });
});
`;

function request<T>(worker: Worker, message: string, key: string): Promise<T> {
  return new Promise(resolve => {
    const onMessage = (reply: Record<string, unknown>) => {
      if (key in reply) {
        worker.off('message', onMessage);
        resolve(reply[key] as T);
      }
    };
    worker.on('message', onMessage);
    worker.postMessage(message);
  });
}

export function startLocalReceivers(): Promise<LocalReceivers> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(RECEIVER_CODE, { eval: true });
    worker.once('error', reject);
    worker.once('message', (ready: { httpPort: number; udpPort: number }) => {
      const counts = () => request<ReceiverCounts>(worker, 'counts', 'counts');
      resolve({
        httpUrl: `http://127.0.0.1:${ready.httpPort}/logs`,
        syslogPort: ready.udpPort,
        counts,
        async settledCounts(quietMs = 300, maxWaitMs = 10000) {
          const deadline = Date.now() + maxWaitMs;
          let last = await counts();
          while (Date.now() < deadline) {
            await new Promise(done => setTimeout(done, quietMs));
            const next = await counts();
            if (JSON.stringify(next) === JSON.stringify(last)) return next;
            last = next;
          }
          return last;
        },
        async stop() {
          await request(worker, 'stop', 'stopped');
          await worker.terminate();
        }
      });
    });
  });
}
