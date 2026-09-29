import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'yaml';
import { ConfigManager } from './index';
import { getConfigValue, parseConfigValue, setConfigValueInFile } from './configFile';

const tempFile = (): string => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-')), 'config.yaml');

describe('setConfigValueInFile', () => {
  it('creates a small override file that ConfigManager merges over the defaults', () => {
    const file = tempFile();

    setConfigValueInFile(file, 'generators.endpoint.frequency', '20');

    expect(yaml.parse(fs.readFileSync(file, 'utf8'))).toEqual({ generators: { endpoint: { frequency: 20 } } });
    const config = new ConfigManager(file).getConfig();
    expect(config.generators.endpoint.frequency).toBe(20);
  });

  it('keeps what is already in the file', () => {
    const file = tempFile();
    fs.writeFileSync(file, 'output:\n  format: cef\n');

    setConfigValueInFile(file, 'output.destination', 'stdout');

    expect(yaml.parse(fs.readFileSync(file, 'utf8'))).toEqual({ output: { format: 'cef', destination: 'stdout' } });
  });

  it.each(['__proto__.polluted', 'generators.constructor.x', 'a.prototype', '', 'a..b', 'a.'])('rejects the key %p', key => {
    expect(() => setConfigValueInFile(tempFile(), key, '1')).toThrow(/Invalid configuration key/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses to overwrite a file that is not a YAML mapping', () => {
    const file = tempFile();
    fs.writeFileSync(file, '- a list\n');

    expect(() => setConfigValueInFile(file, 'output.format', 'json')).toThrow(/not a YAML mapping/);
  });
});

describe('parseConfigValue', () => {
  it('turns numbers and booleans into their types, and keeps other text', () => {
    expect(parseConfigValue('42')).toBe(42);
    expect(parseConfigValue('0.5')).toBe(0.5);
    expect(parseConfigValue('true')).toBe(true);
    expect(parseConfigValue('FALSE')).toBe(false);
    expect(parseConfigValue('http://x:8000/post')).toBe('http://x:8000/post');
    expect(parseConfigValue('')).toBe('');
  });
});

describe('getConfigValue', () => {
  it('reads a dotted key, or undefined when a part is missing', () => {
    const config = { output: { syslog: { port: 514 } } };

    expect(getConfigValue(config, 'output.syslog.port')).toBe(514);
    expect(getConfigValue(config, 'output.http.url')).toBeUndefined();
  });
});
