/**
 * ML Settings
 * Persisted settings for the ml-patterns commands (learn, generate, config)
 */

import * as fs from 'fs-extra';
import * as path from 'path';

export interface MlSettings {
  /** Minimum logs `learn` needs before it builds a profile */
  minSamples: number;
  /** `learn` only uses logs within this many days of the newest log */
  maxHistoryDays: number;
  /** Message patterns kept per source in the profile */
  maxTemplatesPerSource: number;
  /** Default share of generated logs drawn from rare patterns/levels (0-1) */
  anomalyRate: number;
  /** Where `learn` saves and `generate`/`status` read the profile */
  profilePath: string;
}

export const DEFAULT_SETTINGS_PATH = path.join('models', 'ml-patterns', 'settings.json');

export const DEFAULT_SETTINGS: MlSettings = {
  minSamples: 1000,
  maxHistoryDays: 30,
  maxTemplatesPerSource: 50,
  anomalyRate: 0.05,
  profilePath: path.join('models', 'ml-patterns', 'profile.json')
};

type Validator = (value: unknown) => MlSettings[keyof MlSettings];

const wholeAtLeastOne = (key: string): Validator => value => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${key} must be a whole number of at least 1`);
  return number;
};

const VALIDATORS: Record<keyof MlSettings, Validator> = {
  minSamples: wholeAtLeastOne('minSamples'),
  maxTemplatesPerSource: wholeAtLeastOne('maxTemplatesPerSource'),
  maxHistoryDays: value => {
    const number = Number(value);
    if (!(number > 0)) throw new Error('maxHistoryDays must be a number greater than 0');
    return number;
  },
  anomalyRate: value => {
    const number = Number(value);
    if (Number.isNaN(number) || number < 0 || number > 1) throw new Error('anomalyRate must be a number from 0 to 1');
    return number;
  },
  profilePath: value => {
    if (typeof value !== 'string' || value.trim() === '') throw new Error('profilePath must not be empty');
    return value.trim();
  }
};

/** A copy of `settings` with `key` set to the validated `value` */
export function setSetting(settings: MlSettings, key: string, value: unknown): MlSettings {
  if (!(key in VALIDATORS)) {
    throw new Error(`Unknown setting "${key}". Use one of: ${Object.keys(VALIDATORS).join(', ')}`);
  }
  return { ...settings, [key]: VALIDATORS[key as keyof MlSettings](value) };
}

function applyAll(base: MlSettings, values: Record<string, unknown>): MlSettings {
  return Object.entries(values).reduce((settings, [key, value]) => setSetting(settings, key, value), base);
}

export async function loadSettings(file: string = DEFAULT_SETTINGS_PATH): Promise<MlSettings> {
  if (!(await fs.pathExists(file))) {
    return { ...DEFAULT_SETTINGS };
  }
  return applyAll({ ...DEFAULT_SETTINGS }, JSON.parse(await fs.readFile(file, 'utf8')));
}

export async function saveSettings(settings: MlSettings, file: string = DEFAULT_SETTINGS_PATH): Promise<void> {
  await fs.ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(settings, null, 2));
}

/** Current settings with the values from a JSON file applied (every value validated) */
export async function mergeSettingsFile(settings: MlSettings, file: string): Promise<MlSettings> {
  return applyAll(settings, JSON.parse(await fs.readFile(file, 'utf8')));
}
