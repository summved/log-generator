import * as http from 'http';
import { AddressInfo } from 'net';
import { HttpSender } from './httpSender';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

interface Received { method: string; headers: http.IncomingHttpHeaders; body: string }

/** A local server that answers with the given statuses in turn (last one repeats) */
async function server(statuses: number[], respond: (req: Received) => string = () => '{"ok":true}', delayMs = 0) {
  const received: Received[] = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      received.push({ method: req.method || '', headers: req.headers, body });
      const status = statuses[Math.min(received.length - 1, statuses.length - 1)];
      setTimeout(() => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(respond(received[received.length - 1]));
      }, delayMs);
    });
  });
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/ingest`;
  return { url, received, close: () => new Promise<void>(resolve => { srv.close(() => resolve()); srv.closeAllConnections(); }) };
}

const payload = { body: '{"logs":[]}', contentType: 'application/json' };

describe('HttpSender', () => {
  it('sends the body with the method, content type and configured headers', async () => {
    const s = await server([200]);
    await new HttpSender({ url: s.url, method: 'PUT', headers: { Authorization: 'Splunk abc', 'Content-Type': 'text/plain' } }).send(payload);
    await s.close();

    expect(s.received).toHaveLength(1);
    expect(s.received[0].method).toBe('PUT');
    expect(s.received[0].headers.authorization).toBe('Splunk abc');
    expect(s.received[0].headers['content-type']).toBe('application/json');
    expect(s.received[0].body).toBe(payload.body);
  });

  it('retries server errors and 429 with backoff, then succeeds', async () => {
    const s = await server([503, 429, 200]);
    await new HttpSender({ url: s.url, retries: 3, retryDelayMs: 10 }).send(payload);
    await s.close();

    expect(s.received).toHaveLength(3);
  });

  it('gives up after the configured retries', async () => {
    const s = await server([500]);
    await expect(new HttpSender({ url: s.url, retries: 2, retryDelayMs: 10 }).send(payload)).rejects.toThrow(/500/);
    await s.close();

    expect(s.received).toHaveLength(3);
  });

  it('does not retry a client error such as 400 or 401', async () => {
    const s = await server([401]);
    await expect(new HttpSender({ url: s.url, retries: 3, retryDelayMs: 10 }).send(payload)).rejects.toThrow(/401/);
    await s.close();

    expect(s.received).toHaveLength(1);
  });

  it('times out slow responses using the configured timeout', async () => {
    const s = await server([200], undefined, 500);
    try {
      await expect(new HttpSender({ url: s.url, timeout: 50, retries: 0 }).send(payload)).rejects.toThrow(/timed out after 50 ms/);
    } finally {
      await s.close();
    }
  });

  it('treats an Elasticsearch bulk response with item errors as a failure', async () => {
    const s = await server([200], () => JSON.stringify({ errors: true, items: [{ index: { status: 400, error: { type: 'mapper_parsing_exception' } } }, { index: { status: 201 } }] }));
    await expect(new HttpSender({ url: s.url, retries: 0, checkBulkErrors: true }).send(payload)).rejects.toThrow(/1 of 2 documents.*mapper_parsing_exception/);
    await s.close();
  });

  it('retries network errors (nothing listening)', async () => {
    const s = await server([200]);
    const { url } = s;
    await s.close();

    await expect(new HttpSender({ url, retries: 1, retryDelayMs: 10 }).send(payload)).rejects.toThrow(/ECONNREFUSED/);
  });
});
