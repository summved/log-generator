import * as http from 'http';
import { AddressInfo } from 'net';
import { HttpServer } from './httpServer';
import { MetricsCollector } from './metricsCollector';

jest.mock('./logger', () => ({ logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

interface Response { status: number; headers: http.IncomingHttpHeaders; body: string }

function request(port: number, pathName: string, method = 'GET'): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathName, method }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('HttpServer', () => {
  let server: HttpServer;
  let port: number;

  beforeEach(async () => {
    MetricsCollector.getInstance().reset();
    server = new HttpServer(0);
    await server.start();
    port = (server.address() as AddressInfo).port;
  });
  afterEach(async () => { await server.stop(); });

  it('serves /health, /metrics, /status and /ready', async () => {
    expect(JSON.parse((await request(port, '/health')).body).status).toBe('healthy');
    expect((await request(port, '/metrics')).body).toContain('log_generator_logs_total');
    expect(JSON.parse((await request(port, '/status')).body).service).toBe('log-generator');
    expect([200, 503]).toContain((await request(port, '/ready')).status);
  });

  it('does not send a wildcard CORS header', async () => {
    const response = await request(port, '/health');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects non-GET methods with 405', async () => {
    const response = await request(port, '/health', 'POST');

    expect(response.status).toBe(405);
    expect(response.headers.allow).toContain('GET');
  });

  it('returns 404 for unknown paths, listing the real endpoints', async () => {
    const response = await request(port, '/secret');

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body).availableEndpoints).toEqual(['/health', '/ready', '/metrics', '/status']);
  });

  it('does not leak internal error details on a 500', async () => {
    jest.spyOn(MetricsCollector.getInstance(), 'getPrometheusMetrics').mockImplementationOnce(() => {
      throw new Error('secret db connection string failed at 10.0.0.5');
    });

    const response = await request(port, '/metrics');

    expect(response.status).toBe(500);
    expect(response.body).not.toContain('secret db connection');
    expect(response.body).not.toContain('10.0.0.5');
    expect(JSON.parse(response.body).error).toBe('Internal Server Error');
  });
});
