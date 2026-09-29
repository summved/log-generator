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
    ['authentication', new AuthenticationGenerator({ type: 'authentication', name: 'auth-service', host: 'auth-01' }, config.authentication)],
    ['database', new DatabaseGenerator({ type: 'database', name: 'postgres-primary', host: 'db-01' }, config.database)],
    ['webserver', new WebServerGenerator({ type: 'webserver', name: 'nginx-proxy', host: 'web-01' }, config.webserver)],
    ['email', new EmailGenerator({ type: 'email', name: 'mail-server', host: 'mail-01' }, config.email)],
    ['backup', new BackupGenerator({ type: 'backup', name: 'backup-service', host: 'backup-01' }, config.backup)],
    ['microservices', new MicroservicesGenerator({ type: 'microservices', name: 'service-mesh', host: 'k8s-01' }, config.microservices)],
    ['iot', new IoTGenerator({ type: 'iot', name: 'iot-hub', host: 'iot-01' }, config.iot)]
  ]);
}
