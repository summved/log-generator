import * as path from 'path';
import { InputValidator } from './inputValidator';

describe('InputValidator.validateFilePath', () => {
  it('returns the absolute path of an existing file', () => {
    expect(InputValidator.validateFilePath('package.json')).toBe(path.resolve('package.json'));
  });

  it('rejects a missing or empty path with the description', () => {
    expect(() => InputValidator.validateFilePath('no-such-file.yaml', 'Config file')).toThrow(`Config file not found: ${path.resolve('no-such-file.yaml')}`);
    expect(() => InputValidator.validateFilePath('', 'Config file')).toThrow('Config file path is required');
  });
});

describe('InputValidator.validateConfigKeyValue', () => {
  it('accepts a value, or one of the allowed options', () => {
    expect(InputValidator.validateConfigKeyValue('output.format', 'json', ['json', 'syslog'])).toBe('json');
    expect(InputValidator.validateConfigKeyValue('generators.endpoint.frequency', 20)).toBe(20);
  });

  it('rejects a missing key or a value outside the allowed options', () => {
    expect(() => InputValidator.validateConfigKeyValue('', 1)).toThrow('Configuration key is required');
    expect(() => InputValidator.validateConfigKeyValue('output.format', 'xml', ['json', 'syslog'])).toThrow("Invalid value 'xml' for key 'output.format'. Valid options: json, syslog");
  });
});
