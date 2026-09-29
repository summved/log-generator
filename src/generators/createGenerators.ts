import { Config } from '../types';
import { BaseGenerator } from './BaseGenerator';
import { EndpointGenerator } from './EndpointGenerator';
import { ApplicationGenerator } from './ApplicationGenerator';
import { ServerGenerator } from './ServerGenerator';
import { FirewallGenerator } from './FirewallGenerator';
import { CloudGenerator } from './CloudGenerator';
import { AuthenticationGenerator } from './AuthenticationGenerator';
import { DatabaseGenerator } from './DatabaseGenerator';
import { WebServerGenerator } from './WebServerGenerator';
import { EmailGenerator } from './EmailGenerator';
import { BackupGenerator } from './BackupGenerator';
import { MicroservicesGenerator } from './MicroservicesGenerator';
import { IoTGenerator } from './IoTGenerator';

export type GeneratorName = keyof Config['generators'];

export const GENERATOR_NAMES: GeneratorName[] = [
  'endpoint', 'application', 'server', 'firewall', 'cloud', 'authentication',
  'database', 'webserver', 'email', 'backup', 'microservices', 'iot'
];

/** The generators the tool runs, one per log type, built from the `generators` config section */
export function createGenerators(config: Config['generators']): Map<GeneratorName, BaseGenerator> {
  return new Map<GeneratorName, BaseGenerator>([
    ['endpoint', new EndpointGenerator(config.endpoint)],
    ['application', new ApplicationGenerator(config.application)],
    ['server', new ServerGenerator(config.server)],
    ['firewall', new FirewallGenerator(config.firewall)],
    ['cloud', new CloudGenerator(config.cloud)],
    ['authentication', new AuthenticationGenerator(config.authentication)],
    ['database', new DatabaseGenerator(config.database)],
    ['webserver', new WebServerGenerator(config.webserver)],
    ['email', new EmailGenerator(config.email)],
    ['backup', new BackupGenerator(config.backup)],
    ['microservices', new MicroservicesGenerator(config.microservices)],
    ['iot', new IoTGenerator(config.iot)]
  ]);
}
