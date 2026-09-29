#!/usr/bin/env node
// Local SIEM stand-ins for scripts/smoke-test.sh: count HTTP-posted logs and UDP syslog datagrams.
// Usage: node scripts/smoke-receivers.js <httpPort> <udpPort> <countsFile>
// Listens on 127.0.0.1 only, so generated logs never leave the machine.
const http = require('http');
const dgram = require('dgram');
const fs = require('fs');

const [httpPort, udpPort, outFile] = process.argv.slice(2);
if (!httpPort || !udpPort || !outFile) {
  console.error('Usage: node scripts/smoke-receivers.js <httpPort> <udpPort> <countsFile>');
  process.exit(1);
}

const counts = { httpRequests: 0, httpLogs: 0, httpParseErrors: 0, syslogMessages: 0 };
const flush = () => fs.writeFileSync(outFile, JSON.stringify(counts));

http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    counts.httpRequests++;
    try {
      const parsed = JSON.parse(body);
      counts.httpLogs += Array.isArray(parsed.logs) ? parsed.logs.length : 1;
    } catch (error) {
      counts.httpParseErrors++;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
}).listen(Number(httpPort), '127.0.0.1');

const udp = dgram.createSocket('udp4');
udp.on('message', () => { counts.syslogMessages++; });
udp.bind(Number(udpPort), '127.0.0.1');

setInterval(flush, 250);
flush();
process.on('SIGTERM', () => { flush(); process.exit(0); });
