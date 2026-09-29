import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class MicroservicesGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'microservices',
      name: 'service-mesh',
      host: 'k8s-01',
      component: 'api-gateway'
    };

    super(source, config);
  }
}
