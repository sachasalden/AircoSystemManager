import AdapterRegistry from './AdapterRegistry';
import HopmannAdapter from './hopmann/HopmannAdapter';

export function registerDefaultAdapters(registry: AdapterRegistry): void {
  registry.register('HeinhopmannIp', (connection) => new HopmannAdapter(connection));
}
