/**
 * Sends formatted syslog messages over UDP (one datagram per message) or TCP (one connection,
 * one message per line, RFC 6587 non-transparent framing). The socket or connection is reused.
 */

import * as dgram from 'dgram';
import * as net from 'net';
import { Config } from '../types';
import { logger } from './logger';

export type SyslogConfig = NonNullable<Config['output']['syslog']>;

export class SyslogSender {
  private udp?: dgram.Socket;
  private tcp?: net.Socket;
  private connecting?: Promise<net.Socket>;

  constructor(private readonly config: SyslogConfig) {}

  public send(messages: string[]): Promise<void> {
    return this.config.protocol === 'tcp' ? this.sendTcp(messages) : this.sendUdp(messages);
  }

  public async close(): Promise<void> {
    const udp = this.udp;
    const tcp = this.tcp;
    this.udp = undefined;
    this.tcp = undefined;
    this.connecting = undefined;
    if (udp) await new Promise<void>(resolve => udp.close(() => resolve()));
    if (tcp && !tcp.destroyed) await new Promise<void>(resolve => tcp.end(() => resolve()));
  }

  private async sendUdp(messages: string[]): Promise<void> {
    if (!this.udp) {
      this.udp = dgram.createSocket('udp4');
      this.udp.on('error', error => logger.error('Syslog UDP socket error:', error));
    }
    const socket = this.udp;
    await Promise.all(messages.map(message => new Promise<void>((resolve, reject) => {
      socket.send(Buffer.from(message), this.config.port, this.config.host, error => (error ? reject(error) : resolve()));
    })));
  }

  private async sendTcp(messages: string[]): Promise<void> {
    const socket = await this.connection();
    await new Promise<void>((resolve, reject) => {
      socket.write(messages.map(message => `${message}\n`).join(''), error => (error ? reject(error) : resolve()));
    });
  }

  private connection(): Promise<net.Socket> {
    if (this.tcp && !this.tcp.destroyed) return Promise.resolve(this.tcp);
    if (!this.connecting) {
      this.connecting = new Promise<net.Socket>((resolve, reject) => {
        const socket = net.createConnection({ host: this.config.host, port: this.config.port });
        socket.once('connect', () => {
          this.tcp = socket;
          this.connecting = undefined;
          resolve(socket);
        });
        socket.on('error', error => {
          logger.error('Syslog TCP connection error:', error);
          this.connecting = undefined;
          reject(error);
        });
        // A dropped connection is reopened on the next send
        socket.on('close', () => {
          if (this.tcp === socket) this.tcp = undefined;
        });
      });
    }
    return this.connecting;
  }
}
