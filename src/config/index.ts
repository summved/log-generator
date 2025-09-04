import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { Config } from '../types';

export class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, 'default.yaml');
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      const parsedConfig = yaml.parse(configContent);
      return this.validateConfig(parsedConfig);
    } catch (error) {
      console.error(`Failed to load config from ${this.configPath}:`, error);
      throw new Error(`Configuration loading failed: ${error}`);
    }
  }

  private validateConfig(config: any): Config {
    // Basic validation - in a production environment, you'd want more comprehensive validation
    if (!config.generators) {
      throw new Error('Missing generators configuration');
    }
    
    if (!config.output) {
      throw new Error('Missing output configuration');
    }

    if (!config.storage) {
      throw new Error('Missing storage configuration');
    }

    // Set defaults for missing replay config
    if (!config.replay) {
      config.replay = {
        enabled: false,
        speed: 1.0,
        loop: false,
        filters: { sources: [], levels: [] }
      };
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

export const configManager = new ConfigManager();
