import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from './index';
import { expandEnvironment, mergeOverDefaults } from './loadConfig';

const writeConfig = (content: string): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
  const file = path.join(dir, 'config.yaml');
  fs.writeFileSync(file, content);
  return file;
};

describe('ConfigManager with a partial config file', () => {
  const defaults = new ConfigManager().getConfig();

  it('fills everything the file leaves out from the defaults', () => {
    const config = new ConfigManager(writeConfig('output:\n  format: cef\n')).getConfig();

    expect(config.output.format).toBe('cef');
    expect(config.output.destination).toBe(defaults.output.destination);
    expect(config.storage).toEqual(defaults.storage);
    expect(config.generators).toEqual(defaults.generators);
    expect(config.replay).toEqual(defaults.replay);
  });

  it('changes only the generator settings the file mentions', () => {
    const config = new ConfigManager(writeConfig('generators:\n  firewall:\n    frequency: 120\n  iot:\n    enabled: false\n')).getConfig();

    expect(config.generators.firewall.frequency).toBe(120);
    expect(config.generators.firewall.enabled).toBe(defaults.generators.firewall.enabled);
    expect(config.generators.firewall.templates).toEqual(defaults.generators.firewall.templates);
    expect(config.generators.iot.enabled).toBe(false);
    expect(config.generators.endpoint).toEqual(defaults.generators.endpoint);
  });

  it('replaces lists such as templates instead of merging them', () => {
    const config = new ConfigManager(writeConfig(
      'generators:\n  endpoint:\n    templates:\n      - level: INFO\n        messageTemplate: "only this"\n        probability: 1\n'
    )).getConfig();

    expect(config.generators.endpoint.templates).toEqual([{ level: 'INFO', messageTemplate: 'only this', probability: 1 }]);
  });

  it('still loads every shipped config file', () => {
    const dir = __dirname;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.yaml'))) {
      expect(() => new ConfigManager(path.join(dir, file))).not.toThrow();
    }
  });

  it('reports a clear error for a file that is not valid YAML', () => {
    expect(() => new ConfigManager(writeConfig('output: [unclosed'))).toThrow(/Configuration loading failed/);
  });
});

describe('ConfigManager environment variables', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('substitutes ${VAR} and ${VAR:-default} in string values', () => {
    process.env.TEST_SIEM_URL = 'https://siem.example.test/ingest';
    const file = writeConfig([
      'output:',
      '  destination: http',
      '  http:',
      '    url: "${TEST_SIEM_URL}"',
      '    headers:',
      '      Authorization: "Bearer ${TEST_SIEM_TOKEN:-none}"'
    ].join('\n'));

    const config = new ConfigManager(file).getConfig();

    expect(config.output.http?.url).toBe('https://siem.example.test/ingest');
    expect(config.output.http?.headers?.Authorization).toBe('Bearer none');
  });

  it('fails clearly when a variable is not set and has no default', () => {
    delete process.env.TEST_MISSING_VAR;
    const file = writeConfig('output:\n  http:\n    url: "${TEST_MISSING_VAR}"\n');

    expect(() => new ConfigManager(file)).toThrow(/TEST_MISSING_VAR is not set/);
  });

  it('uses CONFIG_PATH when no path is given', () => {
    process.env.CONFIG_PATH = writeConfig('output:\n  format: wazuh\n');

    expect(new ConfigManager().getConfig().output.format).toBe('wazuh');
  });
});

describe('expandEnvironment', () => {
  it('only touches strings, anywhere in the structure', () => {
    const result = expandEnvironment({ a: '${X}', b: [1, '${X:-y}'], c: { d: true, e: 'plain $X' } }, { X: 'x' });

    expect(result).toEqual({ a: 'x', b: [1, 'x'], c: { d: true, e: 'plain $X' } });
  });

  it('allows an empty default', () => {
    expect(expandEnvironment('a${UNSET:-}b', {})).toBe('ab');
  });
});

describe('mergeOverDefaults', () => {
  it('ignores __proto__ and constructor keys from a config file', () => {
    const user = JSON.parse('{"__proto__": {"polluted": true}, "output": {"constructor": {"x": 1}, "format": "cef"}}');

    const merged = mergeOverDefaults({ output: { format: 'json' } }, user);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged).toEqual({ output: { format: 'cef' } });
  });

  it('does not change the defaults it was given', () => {
    const defaults = { generators: { a: { enabled: true, n: 1 } }, output: { format: 'json' } };
    const before = JSON.stringify(defaults);

    mergeOverDefaults(defaults, { generators: { a: { n: 2 } }, output: { format: 'cef' } });

    expect(JSON.stringify(defaults)).toBe(before);
  });
});
