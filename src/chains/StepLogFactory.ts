/**
 * Step Log Factory
 * Builds MITRE-tagged, correlated log entries for a single attack chain step
 */

import { LogEntry, LogSource } from '../types';
import { AttackChainStep } from '../types/attackChain';
import { TemplateEngine } from '../utils/templateEngine';
import { timestampSequencer } from '../utils/timestampSequencer';

export interface StepLogContext {
  chainId: string;
  executionId: string;
}

const GENERATOR_TYPES: ReadonlyArray<LogSource['type']> = [
  'endpoint', 'application', 'server', 'firewall', 'cloud', 'authentication',
  'database', 'webserver', 'email', 'backup', 'microservices', 'iot'
];

/**
 * Maps source names used in attack chain templates to generator types
 */
export const SOURCE_ALIASES: Readonly<Record<string, LogSource['type']>> = {
  'windows-server': 'server',
  'file-server': 'server',
  'mail-server': 'email',
  'backup-server': 'backup',
  'proxy-server': 'webserver',
  'proxy': 'webserver'
};

export function resolveSourceType(name: string): LogSource['type'] {
  const alias = SOURCE_ALIASES[name];
  if (alias) {
    return alias;
  }

  const generatorType = GENERATOR_TYPES.find(type => type === name);
  if (!generatorType) {
    throw new Error(`Unknown attack-chain source "${name}"`);
  }
  return generatorType;
}

/**
 * Number of logs a step produces, based on its logical duration (not the
 * speed-scaled wall clock) and its per-minute frequency. Always at least one.
 */
export function calculateStepLogCount(step: AttackChainStep): number {
  const minutes = step.timing.duration / 60000;
  return Math.max(1, Math.ceil(minutes * step.logGeneration.frequency));
}

export function buildStepLogs(step: AttackChainStep, context: StepLogContext): LogEntry[] {
  const { templates, sources, customData } = step.logGeneration;
  const templateNames = templates.length > 0 ? templates : [step.id];
  // Resolve every source up front so an unknown source fails before any log is built
  const logSources: LogSource[] = sources.map(name => ({
    type: resolveSourceType(name),
    name
  }));

  if (logSources.length === 0) {
    throw new Error(`Attack chain step "${step.id}" has no log sources`);
  }

  const count = calculateStepLogCount(step);
  const logs: LogEntry[] = [];

  for (let i = 0; i < count; i++) {
    const template = templateNames[i % templateNames.length];
    const source = logSources[i % logSources.length];

    logs.push({
      timestamp: timestampSequencer.getUniqueTimestamp(),
      level: 'WARN',
      source,
      message: `[${step.mitre.technique}] ${template}: ${step.name} on ${source.name}`,
      metadata: TemplateEngine.generateMetadata({
        ...customData,
        attack_chain: {
          chain_id: context.chainId,
          execution_id: context.executionId,
          step_id: step.id,
          template
        }
      }),
      mitre: { ...step.mitre }
    });
  }

  return logs;
}
