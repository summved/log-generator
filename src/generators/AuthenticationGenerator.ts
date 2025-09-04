import { BaseGenerator } from './BaseGenerator';
import { LogEntry, LogSource, GeneratorConfig } from '../types';

export class AuthenticationGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'authentication',
      name: 'auth-service',
      host: 'auth-01',
      component: 'identity-provider'
    };
  }
}
