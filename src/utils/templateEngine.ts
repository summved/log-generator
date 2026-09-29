import { faker } from '@faker-js/faker';
import { v4 as uuidv4 } from 'uuid';
import { guessValue, PLACEHOLDER_VALUES, PlaceholderValue } from './placeholderValues';

const PLACEHOLDER = /\{(\w+)\}/g;
const ONLY_PLACEHOLDER = /^\{(\w+)\}$/;

export interface RenderedLog {
  message: string;
  metadata: Record<string, unknown>;
}

export class TemplateEngine {
  /** Placeholder names with a dedicated value (others are guessed from the name) */
  public static knownPlaceholders(): string[] {
    return Object.keys(PLACEHOLDER_VALUES);
  }

  /**
   * Fill the placeholders in a message template and in the template's metadata values.
   * Each placeholder gets one value per log, so {srcIP} in the message and in metadata agree.
   * A metadata value that is just a placeholder keeps the value's type (e.g. a number).
   */
  public static render(messageTemplate: string, metadata: Record<string, unknown> = {}): RenderedLog {
    const values = new Map<string, PlaceholderValue>();
    const valueOf = (name: string): PlaceholderValue => {
      if (!values.has(name)) {
        const make = PLACEHOLDER_VALUES[name];
        values.set(name, make ? make() : guessValue(name));
      }
      return values.get(name)!;
    };
    const fill = (text: string): string => text.replace(PLACEHOLDER, (_match, name: string) => String(valueOf(name)));

    const filledMetadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value !== 'string') {
        filledMetadata[key] = value;
        continue;
      }
      const only = value.match(ONLY_PLACEHOLDER);
      filledMetadata[key] = only ? valueOf(only[1]) : fill(value);
    }

    return { message: fill(messageTemplate), metadata: filledMetadata };
  }

  /** Fill the placeholders in a message template (each call gets fresh values) */
  public static processTemplate(template: string): string {
    return TemplateEngine.render(template).message;
  }

  public static generateMetadata(baseMetadata?: Record<string, any>): Record<string, any> {
    const defaultMetadata = {
      host: faker.internet.domainName(),
      environment: faker.helpers.arrayElement(['production', 'staging', 'development']),
      version: faker.system.semver(),
      correlationId: uuidv4()
    };

    return { ...defaultMetadata, ...baseMetadata };
  }
}
