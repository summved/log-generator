import { LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';

export class ApplicationGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'application',
      name: 'business-app',
      host: 'app-server-01',
      service: 'web-application',
      component: 'spring-boot'
    };
    
    super(source, config);
  }
}
