import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { Config } from '../types';
import { expandEnvironment, mergeOverDefaults } from './loadConfig';

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'default.yaml');

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || process.env.CONFIG_PATH || DEFAULT_CONFIG_PATH;
    this.config = this.loadConfig();
  }

  /** The config file, merged over the defaults, with ${VAR} references substituted */
  private loadConfig(): Config {
    try {
      const defaults = yaml.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
      if (path.resolve(this.configPath) === path.resolve(DEFAULT_CONFIG_PATH)) {
        return this.validateConfig(expandEnvironment(defaults));
      }
      const user = yaml.parse(fs.readFileSync(this.configPath, 'utf8')) ?? {};
      if (typeof user !== 'object' || Array.isArray(user)) {
        throw new Error('the file must contain YAML keys such as generators:, output: and storage:');
      }
      return this.validateConfig(expandEnvironment(mergeOverDefaults(defaults, user)));
    } catch (error) {
      throw new Error(`Configuration loading failed for ${this.configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateConfig(config: any): Config {
    for (const section of ['generators', 'output', 'storage']) {
      if (!config[section]) {
        throw new Error(`Missing ${section} configuration`);
      }
    }
    return config as Config;
  }

  public getConfig(): Config {
    return this.config;
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
  }

  public saveConfig(configPath?: string): void {
    const savePath = configPath || this.configPath;
    const yamlContent = yaml.stringify(this.config);
    fs.writeFileSync(savePath, yamlContent, 'utf8');
  }

  public getGeneratorConfig(type: keyof Config['generators']) {
    return this.config.generators[type];
  }

  public getReplayConfig() {
    return this.config.replay;
  }

  public getOutputConfig() {
    return this.config.output;
  }

  public getStorageConfig() {
    return this.config.storage;
  }
}

