import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class MicroservicesGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'microservices',
      name: 'service-mesh',
      host: 'k8s-01',
      component: 'api-gateway'
    };
  }
}
