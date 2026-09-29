/**
 * Sends one HTTP output request, with the configured method, headers and timeout, retrying network
 * errors, 5xx and 429 with exponential backoff. Client errors (4xx) are not retried.
 */

import { BuiltPayload } from './httpPayload';
import { logger } from './logger';

const axios = require('axios');

export interface HttpSenderOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  /** Per request, in ms (default 10000) */
  timeout?: number;
  /** Extra attempts after the first (default 0) */
  retries?: number;
  /** First retry delay in ms; doubles each time (default 250) */
  retryDelayMs?: number;
  /** Fail when an Elasticsearch bulk response reports item errors */
  checkBulkErrors?: boolean;
}

interface HttpError {
  code?: string;
  message: string;
  response?: { status: number };
}

function isRetryable(error: HttpError): boolean {
  const status = error.response?.status;
  return status === undefined || status >= 500 || status === 429;
}

function describe(error: HttpError, timeoutMs: number): string {
  if (error.response) return `HTTP ${error.response.status}`;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return `timed out after ${timeoutMs} ms`;
  return error.code || error.message;
}

function bulkErrors(data: unknown): string | undefined {
  const response = data as { errors?: boolean; items?: Record<string, { error?: { type?: string } }>[] } | undefined;
  if (!response?.errors || !Array.isArray(response.items)) return undefined;
  const failed = response.items.map(item => Object.values(item)[0]).filter(result => result?.error);
  const types = [...new Set(failed.map(result => result.error?.type || 'error'))].join(', ');
  return `${failed.length} of ${response.items.length} documents were rejected (${types})`;
}

export class HttpSender {
  constructor(private readonly options: HttpSenderOptions) {}

  public async send(payload: BuiltPayload): Promise<void> {
    const retries = Math.max(0, this.options.retries ?? 0);
    const timeout = this.options.timeout ?? 10000;
    const firstDelay = this.options.retryDelayMs ?? 250;

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await axios.request({
          url: this.options.url,
          method: this.options.method || 'POST',
          data: payload.body,
          // The payload decides the content type (e.g. ndjson for bulk); other headers come from the config
          headers: { ...(this.options.headers || {}), 'Content-Type': payload.contentType },
          timeout,
          transformRequest: [(data: string) => data]
        });
        const rejected = this.options.checkBulkErrors ? bulkErrors(response.data) : undefined;
        if (rejected) throw Object.assign(new Error(`Elasticsearch bulk request: ${rejected}`), { permanent: true });
        return;
      } catch (error) {
        const failure = error as HttpError & { permanent?: boolean };
        if (failure.permanent || attempt >= retries || !isRetryable(failure)) {
          throw new Error(`HTTP output to ${this.options.url} failed after ${attempt + 1} attempt(s): ${failure.permanent ? failure.message : describe(failure, timeout)}`);
        }
        const delay = firstDelay * 2 ** attempt;
        logger.warn(`HTTP output attempt ${attempt + 1} failed (${describe(failure, timeout)}); retrying in ${delay} ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
