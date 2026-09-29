/**
 * MITRE ATT&CK filtering for `generate --mitre-technique / --mitre-tactic / --mitre-enabled`.
 */

import { Config, LogEntry } from '../types';
import { MitreMapper } from './mitreMapper';

export interface MitreFilterOptions {
  technique?: string;
  tactic?: string;
  enabledOnly?: boolean;
}

/** T1110 matches T1110 and its sub-techniques (T1110.001); T1110.001 matches only itself */
function techniqueMatches(actual: string, wanted: string): boolean {
  return actual === wanted || (!wanted.includes('.') && actual.startsWith(`${wanted}.`));
}

/** Whether a log passes the filter. Any technique or tactic filter excludes logs without MITRE data. */
export function matchesMitreFilter(entry: LogEntry, filter?: MitreFilterOptions): boolean {
  if (!filter || (!filter.technique && !filter.tactic && !filter.enabledOnly)) return true;
  if (!entry.mitre) return false;
  if (filter.technique && !techniqueMatches(entry.mitre.technique, filter.technique)) return false;
  if (filter.tactic && entry.mitre.tactic !== filter.tactic) return false;
  return true;
}

/** Techniques and tactics that the enabled generator templates, or the automatic message mapping, can produce */
export function producibleMitre(generators: Config['generators']): { techniques: Set<string>; tactics: Set<string> } {
  const techniques = new Set<string>(MitreMapper.getSupportedTechniques());
  const tactics = new Set<string>(MitreMapper.getSupportedTactics());
  for (const generator of Object.values(generators)) {
    if (!generator?.enabled) continue;
    for (const template of generator.templates || []) {
      if (template.mitre?.technique) techniques.add(template.mitre.technique);
      if (template.mitre?.tactic) tactics.add(template.mitre.tactic);
    }
  }
  return { techniques, tactics };
}

/** A warning when the filter can never match anything the configured generators produce */
export function unreachableFilterWarning(generators: Config['generators'], filter: MitreFilterOptions): string | undefined {
  const { techniques, tactics } = producibleMitre(generators);
  if (filter.technique && ![...techniques].some(technique => techniqueMatches(technique, filter.technique!))) {
    return `No enabled template produces ${filter.technique}, so no logs will be written. Techniques available: ${[...techniques].sort().join(', ')}`;
  }
  if (filter.tactic && !tactics.has(filter.tactic)) {
    return `No enabled template produces tactic ${filter.tactic}, so no logs will be written. Tactics available: ${[...tactics].sort().join(', ')}`;
  }
  return undefined;
}
