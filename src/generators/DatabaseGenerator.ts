import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class DatabaseGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'database',
      name: 'postgres-primary',
      host: 'db-01',
      component: 'database-server'
    };

    super(source, config);
  }
}
