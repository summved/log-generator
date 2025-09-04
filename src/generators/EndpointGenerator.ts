import { LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';

export class EndpointGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'endpoint',
      name: 'api-gateway',
      host: 'api.example.com',
      service: 'gateway',
      component: 'nginx'
    };
    
    super(source, config);
  }
}
