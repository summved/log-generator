import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class IoTGenerator extends BaseGenerator {
  constructor(source: LogSource, config: GeneratorConfig) {
    super(source, config);
  }

  protected getLogSource(): LogSource {
    return {
      type: 'iot',
      name: 'iot-hub',
      host: 'iot-01',
      component: 'device-manager'
    };
  }
}
