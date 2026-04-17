import { AircoAdapter, AircoConnection } from './IAircoAdapter';

export type AdapterFactory = (connection: AircoConnection) => AircoAdapter;

export default class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();
  private labels = new Map<string, string>();

  register(type: string, factory: AdapterFactory): void {
    const key = this.normalize(type);
    this.factories.set(key, factory);
    this.labels.set(key, type.trim());
  }

  create(type: string, connection: AircoConnection): AircoAdapter {
    const key = this.normalize(type);
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`No airco adapter registered for type "${type}"`);
    }
    return factory(connection);
  }

  has(type: string): boolean {
    return this.factories.has(this.normalize(type));
  }

  listTypes(): string[] {
    return Array.from(this.labels.values()).sort((a, b) => a.localeCompare(b));
  }

  private normalize(type: string): string {
    return type.trim().toLowerCase();
  }
}
