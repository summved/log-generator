/**
 * Reading and setting single dotted keys (e.g. generators.endpoint.frequency) for `config --get/--set`.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

type Plain = Record<string, unknown>;

const FORBIDDEN_PARTS = new Set(['__proto__', 'prototype', 'constructor']);

function keyParts(key: string): string[] {
  const parts = key.split('.');
  if (!key || parts.some(part => part === '' || FORBIDDEN_PARTS.has(part))) {
    throw new Error(`Invalid configuration key "${key}". Use a dotted path such as generators.endpoint.frequency`);
  }
  return parts;
}

/** "42" -> 42, "true" -> true; anything else stays text */
export function parseConfigValue(raw: string): string | number | boolean {
  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === 'false') return lower === 'true';
  if (raw.trim() !== '' && !isNaN(Number(raw))) return Number(raw);
  return raw;
}

export function getConfigValue(config: unknown, key: string): unknown {
  let current: unknown = config;
  for (const part of keyParts(key)) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = (current as Plain)[part];
  }
  return current;
}

/**
 * Set one key in a config file, creating the file (and the path to the key) if needed. The file
 * only holds what was set; ConfigManager merges it over the defaults.
 */
export function setConfigValueInFile(file: string, key: string, raw: string): void {
  const parts = keyParts(key);
  const existing: unknown = fs.existsSync(file) ? yaml.parse(fs.readFileSync(file, 'utf8')) ?? {} : {};
  if (typeof existing !== 'object' || existing === null || Array.isArray(existing)) {
    throw new Error(`${file} is not a YAML mapping; refusing to overwrite it`);
  }

  let current = existing as Plain;
  for (const part of parts.slice(0, -1)) {
    const next = current[part];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Plain;
  }
  current[parts[parts.length - 1]] = parseConfigValue(raw);

  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, yaml.stringify(existing, { indent: 2 }));
}
