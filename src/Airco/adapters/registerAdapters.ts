import AdapterRegistry from './AdapterRegistry';
import HopmannAdapter from './hopmann/HopmannAdapter';

export function registerDefaultAdapters(registry: AdapterRegistry): void {
  registry.register('HeinAndHopmanIpSystem', (connection) => new HopmannAdapter(connection));
}
