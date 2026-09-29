import { BaseGenerator } from './BaseGenerator';
import { LogSource, GeneratorConfig } from '../types';

export class IoTGenerator extends BaseGenerator {
  constructor(config: GeneratorConfig) {
    const source: LogSource = {
      type: 'iot',
      name: 'iot-hub',
      host: 'iot-01',
      component: 'device-manager'
    };

    super(source, config);
  }
}
