import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class DatabaseGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'database',
      name: 'postgres-primary',
      host: 'db-01',
      component: 'database-server'
    };
  }
}
