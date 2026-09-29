import * as http from 'http';
import { MetricsCollector } from './metricsCollector';
import { logger } from './logger';

export class HttpServer {
  private server: http.Server;
  private port: number;
  private metricsCollector: MetricsCollector;

  constructor(port: number = 3000) {
    this.port = port;
    this.metricsCollector = MetricsCollector.getInstance();
    this.server = this.createServer();
  }

  private createServer(): http.Server {
    return http.createServer((req, res) => {
      // Read-only metrics endpoints: only GET/HEAD, and no CORS (so a web page cannot read them)
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'GET, HEAD' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      const url = (req.url || '').split('?')[0];

      try {
        if (url === '/health') {
          this.handleHealth(req, res);
        } else if (url === '/ready') {
          this.handleReady(req, res);
        } else if (url === '/metrics') {
          this.handleMetrics(req, res);
        } else if (url === '/status') {
          this.handleStatus(req, res);
        } else {
          this.handle404(req, res);
        }
      } catch (error) {
        logger.error('HTTP server error:', error);
        this.handleError(req, res, error);
      }
    });
  }

  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const metrics = this.metricsCollector.getMetrics();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      version: '1.0.0',
      performance: {
        totalLogsGenerated: metrics.totalLogsGenerated,
        logsPerSecond: metrics.logsPerSecond,
        activeGenerators: Array.from(metrics.generatorStats.entries())
          .filter(([_, stats]) => stats.isActive)
          .map(([name, _]) => name),
        errorCount: metrics.errorCount
      }
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  private handleReady(req: http.IncomingMessage, res: http.ServerResponse): void {
    const metrics = this.metricsCollector.getMetrics();
    const ready = {
      status: 'ready',
      checks: {
        uptime: metrics.uptime > 5 ? 'ok' : 'starting',
        generators: metrics.generatorStats.size > 0 ? 'ok' : 'no_generators',
        errors: metrics.errorCount < 100 ? 'ok' : 'high_error_rate'
      }
    };

    const allChecksOk = Object.values(ready.checks).every(check => check === 'ok');
    const statusCode = allChecksOk ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ready, null, 2));
  }

  private handleMetrics(req: http.IncomingMessage, res: http.ServerResponse): void {
    const prometheusMetrics = this.metricsCollector.getPrometheusMetrics();
    
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(prometheusMetrics);
  }

  private handleStatus(req: http.IncomingMessage, res: http.ServerResponse): void {
    const metrics = this.metricsCollector.getMetrics();
    const status = {
      service: 'log-generator',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: metrics.uptime,
      metrics: {
        totalLogsGenerated: metrics.totalLogsGenerated,
        logsPerSecond: metrics.logsPerSecond,
        errorCount: metrics.errorCount,
        startTime: metrics.startTime.toISOString()
      },
      generators: Object.fromEntries(
        Array.from(metrics.generatorStats.entries()).map(([name, stats]) => [
          name,
          {
            count: stats.count,
            isActive: stats.isActive,
            lastGenerated: stats.lastGenerated.toISOString()
          }
        ])
      )
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  private handle404(req: http.IncomingMessage, res: http.ServerResponse): void {
    const notFound = {
      error: 'Not Found',
      message: 'The requested endpoint was not found',
      availableEndpoints: ['/health', '/ready', '/metrics', '/status']
    };

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(notFound, null, 2));
  }

  private handleError(req: http.IncomingMessage, res: http.ServerResponse, error: unknown): void {
    // The detail is logged server-side; never return it to the client
    logger.error('HTTP server error handling request:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }, null, 2));
  }

  /** The address the server is listening on (useful when started on port 0) */
  public address(): import('net').AddressInfo | string | null {
    return this.server.address();
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          logger.info(`HTTP server started on port ${this.port}`);
          logger.info(`Health check: http://localhost:${this.port}/health`);
          logger.info(`Metrics: http://localhost:${this.port}/metrics`);
          resolve();
        }
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('HTTP server stopped');
        resolve();
      });
    });
  }

  public getPort(): number {
    return this.port;
  }
}
