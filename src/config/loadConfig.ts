/**
 * Config file loading: environment-variable substitution and merging a (partial) user config
 * over the defaults.
 */

type Plain = Record<string, unknown>;

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ENV_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Replace ${VAR} and ${VAR:-default} in every string value. A variable that is not set and has
 * no default is an error, so a config never silently uses a literal "${...}".
 */
export function expandEnvironment<T>(value: T, env: NodeJS.ProcessEnv = process.env): T {
  if (typeof value === 'string') {
    return value.replace(ENV_REFERENCE, (_match, name: string, fallback: string | undefined) => {
      const set = env[name];
      if (set !== undefined) return set;
      if (fallback !== undefined) return fallback;
      throw new Error(`Environment variable ${name} is not set (used as \${${name}} in the config; use \${${name}:-default} for a default)`);
    }) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(item => expandEnvironment(item, env)) as unknown as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnvironment(item, env)])) as T;
  }
  return value;
}

/** Objects merge key by key; lists and plain values from `override` replace the defaults */
function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? structuredClone(base) : structuredClone(override);
  }
  const merged: Plain = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    if (UNSAFE_KEYS.has(key)) continue;
    merged[key] = Object.prototype.hasOwnProperty.call(base, key) ? deepMerge(base[key], value) : structuredClone(value);
  }
  return merged;
}

/**
 * Merge a user config over the defaults: the file only needs the settings it changes. Everything
 * else, including generators it does not mention, keeps the default (set enabled: false to turn
 * a generator off).
 */
export function mergeOverDefaults(defaults: Plain, user: Plain): Plain {
  return deepMerge(defaults, user) as Plain;
}
