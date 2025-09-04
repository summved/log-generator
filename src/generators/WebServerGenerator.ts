import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class WebServerGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'webserver',
      name: 'nginx-proxy',
      host: 'web-01',
      component: 'reverse-proxy'
    };
  }
}
