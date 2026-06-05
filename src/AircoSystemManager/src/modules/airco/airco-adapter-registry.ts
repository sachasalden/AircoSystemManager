import type {
  AircoAdapter,
  AircoAdapterFactory,
} from "./airco-adapter";
import type { AircoConnection } from "../../types/shared.types";

export class AircoAdapterRegistry {
  private factories = new Map<string, AircoAdapterFactory>();
  private labels = new Map<string, string>();

  register(type: string, factory: AircoAdapterFactory): void {
    const key = this.normalize(type);
    this.factories.set(key, factory);
    this.labels.set(key, type.trim());
  }

  create(type: string, connection: AircoConnection): AircoAdapter {
    const factory = this.factories.get(this.normalize(type));

    if (!factory) {
      throw new Error(`No airco adapter registered for type "${type}"`);
    }

    return factory(connection);
  }

  listTypes(): string[] {
    return Array.from(this.labels.values()).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private normalize(type: string): string {
    return type.trim().toLowerCase();
  }
}

