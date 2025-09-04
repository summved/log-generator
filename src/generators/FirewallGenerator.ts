import { LogSource, GeneratorConfig } from '../types';
import { BaseGenerator } from './BaseGenerator';

export class FirewallGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'firewall',
      name: 'pfsense-fw',
      host: 'firewall-01',
      service: 'firewall',
      component: 'pf'
    };
    
    super(source, config);
  }
}
