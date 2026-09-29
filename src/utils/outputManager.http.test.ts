import * as fs from 'fs-extra';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import { Config, LogEntry } from '../types';
import { OutputManager } from './outputManager';
import { StorageManager } from './storage';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const log = (i: number): LogEntry => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString(),
  level: 'INFO',
  source: { type: 'endpoint', name: 'api-gateway', host: 'api.example.com' },
  message: `log ${i}`,
  metadata: {}
});

async function receiver(statuses: number[] = [200]) {
  const bodies: { contentType?: string; body: string }[] = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      bodies.push({ contentType: req.headers['content-type'], body });
      res.writeHead(statuses[Math.min(bodies.length - 1, statuses.length - 1)], { 'Content-Type': 'application/json' });
      res.end('{"errors":false,"items":[]}');
    });
  });
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/ingest`,
    bodies,
    close: () => new Promise<void>(resolve => { srv.close(() => resolve()); srv.closeAllConnections(); })
  };
}

describe('OutputManager HTTP output', () => {
  let dir: string;
  let storage: StorageManager;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'http-output-'));
    storage = new StorageManager(path.join(dir, 'current'), path.join(dir, 'historical'), 1);
  });
  afterEach(async () => { await fs.remove(dir); });

  const httpOutput = (http: Record<string, unknown>) => ({
    format: 'json',
    destination: 'http',
    batching: { enabled: true, maxBatchSize: 50, flushIntervalMs: 50 },
    http
  }) as unknown as Config['output'];

  it('sends Splunk HEC events when payload is splunk-hec', async () => {
    const rx = await receiver();
    const output = new OutputManager(httpOutput({ url: rx.url, payload: 'splunk-hec' }), storage);
    for (let i = 0; i < 120; i++) await output.outputLog(log(i));
    await output.close();
    await rx.close();

    const events = rx.bodies.flatMap(b => b.body.trim().split('\n').map(line => JSON.parse(line)));
    expect(events).toHaveLength(120);
    expect(events[0]).toMatchObject({ source: 'api-gateway', host: 'api.example.com', event: { message: 'log 0' } });
  });

  it('sends bulk index lines when payload is elasticsearch-bulk', async () => {
    const rx = await receiver();
    const output = new OutputManager(httpOutput({ url: rx.url, payload: 'elasticsearch-bulk', index: 'siem' }), storage);
    for (let i = 0; i < 60; i++) await output.outputLog(log(i));
    await output.close();
    await rx.close();

    const lines = rx.bodies.flatMap(b => b.body.trim().split('\n').map(line => JSON.parse(line)));
    expect(rx.bodies[0].contentType).toBe('application/x-ndjson');
    expect(lines).toHaveLength(120);
    expect(lines[0]).toEqual({ index: { _index: 'siem' } });
    expect(lines[1]).toMatchObject({ '@timestamp': log(0).timestamp, message: 'log 0' });
  });

  it('retries a failed request as configured', async () => {
    const rx = await receiver([503, 200]);
    const output = new OutputManager(httpOutput({ url: rx.url, retries: 2 }), storage);
    for (let i = 0; i < 10; i++) await output.outputLog(log(i));
    await output.close();
    await rx.close();

    expect(rx.bodies).toHaveLength(2);
    expect(JSON.parse(rx.bodies[1].body).count).toBe(10);
  });
});
