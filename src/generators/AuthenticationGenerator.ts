import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class AuthenticationGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'authentication',
      name: 'auth-service',
      host: 'auth-01',
      component: 'identity-provider'
    };

    super(source, config);
  }
}
