import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class EmailGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'email',
      name: 'mail-server',
      host: 'mail-01',
      component: 'smtp-service'
    };

    super(source, config);
  }
}
