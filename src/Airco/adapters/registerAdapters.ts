import AdapterRegistry from './AdapterRegistry';
import HeinEnHopmanGooilandAdapter from './hopmann/HeinEnHopmanGooilandAdapter';
import HopmannAdapter from './hopmann/HopmannAdapter';

export function registerDefaultAdapters(registry: AdapterRegistry): void {
  registry.register('HeinAndHopmanIpSystem', (connection) => new HopmannAdapter(connection));
  registry.register('HeinAndHopmanGooilandSystem', (connection) => new HeinEnHopmanGooilandAdapter(connection));
}
