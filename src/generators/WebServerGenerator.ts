import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class WebServerGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'webserver',
      name: 'nginx-proxy',
      host: 'web-01',
      component: 'reverse-proxy'
    };

    super(source, config);
  }
}
