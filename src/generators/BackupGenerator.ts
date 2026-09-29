import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class BackupGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'backup',
      name: 'backup-service',
      host: 'backup-01',
      component: 'backup-agent'
    };

    super(source, config);
  }
}
