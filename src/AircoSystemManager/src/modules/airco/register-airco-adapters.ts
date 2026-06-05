import { AircoAdapterRegistry } from "./airco-adapter-registry";
import { HopmannAdapterService } from "./hopmann-adapter.service";

export const createDefaultAircoAdapterRegistry = (): AircoAdapterRegistry => {
  const registry = new AircoAdapterRegistry();

  registry.register("HeinAndHopmanIpSystem", (connection) => new HopmannAdapterService(connection),);

  return registry;
};

