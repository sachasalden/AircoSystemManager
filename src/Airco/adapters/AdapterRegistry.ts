import { AircoAdapter, AircoConnection } from './IAircoAdapter';

export type AdapterFactory = (connection: AircoConnection) => AircoAdapter;

export default class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(type: string, factory: AdapterFactory): void {
    this.factories.set(this.normalize(type), factory);
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

  private normalize(type: string): string {
    return type.trim().toLowerCase();
  }
}
