import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class EmailGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'email',
      name: 'mail-server',
      host: 'mail-01',
      component: 'smtp-service'
    };
  }
}
