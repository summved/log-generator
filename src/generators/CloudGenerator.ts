import { LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';

export class CloudGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'cloud',
      name: 'aws-cloudtrail',
      host: 'aws-region-us-east-1',
      service: 'aws',
      component: 'cloudtrail'
    };
    
    super(source, config);
  }
}
