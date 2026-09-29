import * as dgram from 'dgram';
import * as net from 'net';
import { AddressInfo } from 'net';
import { SyslogSender } from './syslogSender';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const waitFor = async (check: () => boolean, ms = 2000): Promise<void> => {
  const deadline = Date.now() + ms;
  while (!check() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
};

describe('SyslogSender over UDP', () => {
  let server: dgram.Socket;
  let port: number;
  let received: string[];
  let sourcePorts: Set<number>;

  beforeEach(async () => {
    received = [];
    sourcePorts = new Set();
    server = dgram.createSocket('udp4');
    server.on('message', (message, from) => {
      received.push(message.toString());
      sourcePorts.add(from.port);
    });
    await new Promise<void>(resolve => server.bind(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise<void>(resolve => server.close(() => resolve())));

  it('sends each message as its own datagram, all from one socket', async () => {
    const sender = new SyslogSender({ host: '127.0.0.1', port, protocol: 'udp' });

    await sender.send(['<14>one', '<14>two']);
    await sender.send(['<14>three']);
    await waitFor(() => received.length === 3);
    await sender.close();

    expect(received.sort()).toEqual(['<14>one', '<14>three', '<14>two']);
    // One socket means one source port for every datagram
    expect(sourcePorts.size).toBe(1);
  });

  it('fails the batch when a message is too large for a datagram', async () => {
    const sender = new SyslogSender({ host: '127.0.0.1', port, protocol: 'udp' });

    await expect(sender.send(['x'.repeat(70000)])).rejects.toThrow();
    await sender.close();
  });

  it('can be closed without having sent anything', async () => {
    await expect(new SyslogSender({ host: '127.0.0.1', port, protocol: 'udp' }).close()).resolves.toBeUndefined();
  });
});

describe('SyslogSender over TCP', () => {
  let server: net.Server;
  let port: number;
  let data: string;
  let connections: number;

  beforeEach(async () => {
    data = '';
    connections = 0;
    server = net.createServer(socket => {
      connections++;
      socket.on('data', chunk => { data += chunk.toString(); });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(() => new Promise<void>(resolve => server.close(() => resolve())));

  it('really uses TCP, over one connection, with one message per line', async () => {
    const sender = new SyslogSender({ host: '127.0.0.1', port, protocol: 'tcp' });

    await sender.send(['<14>one', '<14>two']);
    await sender.send(['<14>three']);
    await waitFor(() => data.split('\n').length === 4);
    await sender.close();

    expect(data).toBe('<14>one\n<14>two\n<14>three\n');
    expect(connections).toBe(1);
  });

  it('reconnects after the connection drops', async () => {
    const sockets: net.Socket[] = [];
    server.on('connection', socket => sockets.push(socket));
    const sender = new SyslogSender({ host: '127.0.0.1', port, protocol: 'tcp' });

    await sender.send(['<14>before']);
    await waitFor(() => data.includes('before'));
    sockets[0].destroy();
    await new Promise(resolve => setTimeout(resolve, 50));
    await sender.send(['<14>after']);
    await waitFor(() => data.includes('after'));
    await sender.close();

    expect(data).toContain('<14>after\n');
    expect(connections).toBe(2);
  });

  it('fails with the connection error when nothing is listening', async () => {
    const closed = await new Promise<number>(resolve => {
      const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const free = (probe.address() as AddressInfo).port;
        probe.close(() => resolve(free));
      });
    });
    const sender = new SyslogSender({ host: '127.0.0.1', port: closed, protocol: 'tcp' });

    await expect(sender.send(['<14>lost'])).rejects.toThrow(/ECONNREFUSED/);
    await sender.close();
  });
});
