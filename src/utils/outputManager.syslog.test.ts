import * as dgram from 'dgram';
import * as fs from 'fs-extra';
import * as net from 'net';
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
  source: { type: 'endpoint', name: 'test' },
  message: `log ${i}`,
  metadata: {}
});

const waitFor = async (check: () => boolean, ms = 3000): Promise<void> => {
  const deadline = Date.now() + ms;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
};

function syslogOutput(port: number, protocol: 'udp' | 'tcp', extra: Record<string, unknown> = {}): Config['output'] {
  return {
    format: 'syslog',
    destination: 'syslog',
    batching: { enabled: true, maxBatchSize: 50, flushIntervalMs: 50 },
    syslog: { host: '127.0.0.1', port, protocol, ...extra }
  } as Config['output'];
}

describe('OutputManager syslog output', () => {
  let dir: string;
  let storage: StorageManager;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syslog-output-test-'));
    storage = new StorageManager(path.join(dir, 'current'), path.join(dir, 'historical'), 1);
  });
  afterEach(async () => { await fs.remove(dir); });

  it('sends every log over UDP from a single socket', async () => {
    const server = dgram.createSocket('udp4');
    const sourcePorts = new Set<number>();
    let received = 0;
    server.on('message', (_message, from) => { received++; sourcePorts.add(from.port); });
    await new Promise<void>(resolve => server.bind(0, '127.0.0.1', resolve));

    const output = new OutputManager(syslogOutput((server.address() as AddressInfo).port, 'udp'), storage);
    for (let i = 0; i < 200; i++) await output.outputLog(log(i));
    await output.close();
    await waitFor(() => received === 200);
    await new Promise<void>(resolve => server.close(() => resolve()));

    expect(received).toBe(200);
    expect(sourcePorts.size).toBe(1);
  });

  it('uses TCP when the config says tcp', async () => {
    let data = '';
    const server = net.createServer(socket => socket.on('data', chunk => { data += chunk.toString(); }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    const output = new OutputManager(syslogOutput((server.address() as AddressInfo).port, 'tcp'), storage);
    for (let i = 0; i < 120; i++) await output.outputLog(log(i));
    await output.close();
    await waitFor(() => data.split('\n').filter(Boolean).length === 120);
    await new Promise<void>(resolve => server.close(() => resolve()));

    const lines = data.split('\n').filter(Boolean);
    expect(lines).toHaveLength(120);
    expect(lines[0]).toContain('log 0');
    expect(lines[119]).toContain('log 119');
  });

  it('uses the configured facility and RFC 5424 format', async () => {
    let data = '';
    const server = net.createServer(socket => socket.on('data', chunk => { data += chunk.toString(); }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    const output = new OutputManager(syslogOutput((server.address() as AddressInfo).port, 'tcp', { facility: 'auth', timestampFormat: 'RFC5424' }), storage);
    await output.outputLog(log(1));
    await output.close();
    await waitFor(() => data.includes('\n'));
    await new Promise<void>(resolve => server.close(() => resolve()));

    // auth (4) * 8 + info (6) = 38; no host, component or MITRE data on this log
    expect(data).toBe(`<38>1 ${log(1).timestamp} localhost test - - - log 1\n`);
  });

  it('refuses an unknown facility when it starts', () => {
    expect(() => new OutputManager(syslogOutput(514, 'udp', { facility: 'nonsense' }), storage)).toThrow(/Unknown syslog facility "nonsense"/);
  });
});
