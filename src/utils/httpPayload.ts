/**
 * Request bodies for the HTTP output, one shape per kind of receiver.
 */

import { Config, LogEntry } from '../types';

export type HttpPayload = 'batch' | 'ndjson' | 'splunk-hec' | 'elasticsearch-bulk';
export const HTTP_PAYLOADS: HttpPayload[] = ['batch', 'ndjson', 'splunk-hec', 'elasticsearch-bulk'];

export interface HttpItem {
  /** The log in the configured output format */
  log: string;
  entry: LogEntry;
}

export interface BuiltPayload {
  body: string;
  contentType: string;
}

/** With format json each log is sent as an object; other formats are sent as text next to the original */
function asDocument(item: HttpItem, format: Config['output']['format']): unknown {
  return format === 'json' ? JSON.parse(item.log) : { message: item.log, original: item.entry };
}

export function buildHttpPayload(
  payload: HttpPayload,
  items: HttpItem[],
  format: Config['output']['format'],
  index = 'log-generator'
): BuiltPayload {
  switch (payload) {
    case 'ndjson':
      return { body: items.map(item => `${item.log}\n`).join(''), contentType: 'application/x-ndjson' };

    case 'splunk-hec':
      // HEC accepts several event objects in one request body, separated by newlines
      return {
        body: items.map(item => JSON.stringify({
          time: Date.parse(item.entry.timestamp) / 1000,
          host: item.entry.source.host || item.entry.source.name,
          source: item.entry.source.name,
          sourcetype: `log-generator:${item.entry.source.type}`,
          event: format === 'json' ? JSON.parse(item.log) : item.log
        })).join('\n') + '\n',
        contentType: 'application/json'
      };

    case 'elasticsearch-bulk': {
      const action = JSON.stringify({ index: { _index: index } });
      return {
        body: items.map(item => {
          const document = { '@timestamp': item.entry.timestamp, ...(asDocument(item, format) as Record<string, unknown>) };
          return `${action}\n${JSON.stringify(document)}\n`;
        }).join(''),
        contentType: 'application/x-ndjson'
      };
    }

    default:
      return {
        body: JSON.stringify({ logs: items.map(item => asDocument(item, format)), count: items.length, timestamp: new Date().toISOString() }),
        contentType: 'application/json'
      };
  }
}
