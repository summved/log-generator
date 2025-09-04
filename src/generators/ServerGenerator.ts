import { LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';

export class ServerGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'server',
      name: 'linux-server',
      host: 'srv-prod-01',
      service: 'system',
      component: 'systemd'
    };
    
    super(source, config);
  }
}
