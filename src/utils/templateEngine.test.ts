import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { LogTemplate } from '../types';
import { TemplateEngine } from './templateEngine';

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const PLACEHOLDER = /\{(\w+)\}/g;

/** Every template in every shipped config file */
function shippedTemplates(): { file: string; generator: string; template: LogTemplate }[] {
  const all: { file: string; generator: string; template: LogTemplate }[] = [];
  for (const file of fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.yaml'))) {
    const config = yaml.parse(fs.readFileSync(path.join(CONFIG_DIR, file), 'utf8'));
    for (const [generator, settings] of Object.entries(config.generators || {})) {
      for (const template of (settings as { templates?: LogTemplate[] }).templates || []) {
        all.push({ file, generator, template });
      }
    }
  }
  return all;
}

function placeholdersIn(value: unknown): string[] {
  return typeof value === 'string' ? [...value.matchAll(PLACEHOLDER)].map(match => match[1]) : [];
}

describe('TemplateEngine placeholders', () => {
  it('has a proper value for every placeholder the shipped configs use', () => {
    const known = new Set(TemplateEngine.knownPlaceholders());
    const missing = new Set<string>();
    for (const { file, template } of shippedTemplates()) {
      const used = [template.messageTemplate, ...Object.values(template.metadata || {})].flatMap(placeholdersIn);
      used.filter(name => !known.has(name)).forEach(name => missing.add(`${name} (${file})`));
    }

    expect([...missing].sort()).toEqual([]);
  });

  it('leaves no placeholder unfilled in any message or metadata value of the shipped configs', () => {
    const unfilled: string[] = [];
    for (const { file, generator, template } of shippedTemplates()) {
      const { message, metadata } = TemplateEngine.render(template.messageTemplate, template.metadata);
      for (const text of [message, ...Object.values(metadata).map(String)]) {
        if (PLACEHOLDER.test(text)) unfilled.push(`${file}:${generator}: ${text}`);
        PLACEHOLDER.lastIndex = 0;
      }
    }

    expect(unfilled).toEqual([]);
  });

  it('uses one value per placeholder per log, so the message and metadata agree', () => {
    const { message, metadata } = TemplateEngine.render('Blocked {srcIP}:{srcPort}', { srcIP: '{srcIP}', note: 'from {srcIP}' });

    expect(message).toBe(`Blocked ${metadata.srcIP}:${message.split(':').pop()}`);
    expect(metadata.note).toBe(`from ${metadata.srcIP}`);
  });

  it('gives a new value on each log', () => {
    const ids = new Set(Array.from({ length: 20 }, () => TemplateEngine.render('{requestId}').message));

    expect(ids.size).toBeGreaterThan(15);
  });

  it('stores a metadata value that is just a numeric placeholder as a number', () => {
    const { metadata } = TemplateEngine.render('x', { bytes: '{bytes}', label: 'size {bytes}', component: 'nginx' });

    expect(typeof metadata.bytes).toBe('number');
    expect(typeof metadata.label).toBe('string');
    expect(metadata.component).toBe('nginx');
  });

  it('fills placeholders it has never seen (from user configs) instead of leaving braces', () => {
    const { message } = TemplateEngine.render('user {customThingId} took {weirdDuration} ms, {totallyUnknown}');

    expect(message).not.toMatch(PLACEHOLDER);
    expect(message).toMatch(/^user \S+ took \d+ ms, \S+$/);
  });

  it('keeps non-string metadata values unchanged', () => {
    const { metadata } = TemplateEngine.render('x', { enabled: true, retries: 3, tags: ['a', 'b'] });

    expect(metadata).toEqual({ enabled: true, retries: 3, tags: ['a', 'b'] });
  });

  it('processTemplate still returns just the filled message', () => {
    expect(TemplateEngine.processTemplate('GET {path} {status}')).toMatch(/^GET \/\S* \d{3}$/);
  });
});

describe('TemplateEngine IP addresses', () => {
  it('uses IPv4 addresses for IP placeholders', () => {
    for (let i = 0; i < 50; i++) {
      expect(TemplateEngine.render('{srcIP} {clientIP} {deviceIP} {someHostIp}').message).toMatch(/^(\d{1,3}\.){3}\d{1,3}( (\d{1,3}\.){3}\d{1,3}){3}$/);
    }
  });
});
