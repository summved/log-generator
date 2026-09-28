import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { DEFAULT_SETTINGS, loadSettings, mergeSettingsFile, saveSettings, setSetting } from './mlSettings';

describe('ML settings', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'ml-settings-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('uses the defaults when no settings file exists', async () => {
    expect(await loadSettings(path.join(dir, 'settings.json'))).toEqual(DEFAULT_SETTINGS);
  });

  it('persists changed settings', async () => {
    const file = path.join(dir, 'settings.json');
    await saveSettings(setSetting(DEFAULT_SETTINGS, 'anomalyRate', '0.2'), file);

    expect((await loadSettings(file)).anomalyRate).toBe(0.2);
  });

  it.each([
    ['anomalyRate', '1.5', 'anomalyRate must be a number from 0 to 1'],
    ['minSamples', '0', 'minSamples must be a whole number of at least 1'],
    ['maxTemplatesPerSource', '2.5', 'maxTemplatesPerSource must be a whole number of at least 1'],
    ['maxHistoryDays', '-3', 'maxHistoryDays must be a number greater than 0'],
    ['profilePath', '', 'profilePath must not be empty'],
    ['learningRate', '0.1', 'Unknown setting "learningRate"']
  ])('rejects %s=%s', (key, value, message) => {
    expect(() => setSetting(DEFAULT_SETTINGS, key, value)).toThrow(message);
  });

  it('merges a settings file over the current settings, validating every value', async () => {
    const file = path.join(dir, 'custom.json');
    writeFileSync(file, JSON.stringify({ minSamples: 50, anomalyRate: 0.1 }));

    expect(await mergeSettingsFile(DEFAULT_SETTINGS, file)).toEqual({ ...DEFAULT_SETTINGS, minSamples: 50, anomalyRate: 0.1 });

    writeFileSync(file, JSON.stringify({ anomalyRate: 7 }));
    await expect(mergeSettingsFile(DEFAULT_SETTINGS, file)).rejects.toThrow('anomalyRate must be a number from 0 to 1');
  });
});
