import AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import HopmannAdapter from '../../src/Airco/adapters/hopmann/HopmannAdapter';
import { AircoConnection } from '../../src/Airco/adapters/IAircoAdapter';
import { registerDefaultAdapters } from '../../src/Airco/adapters/registerAdapters';

describe('registerDefaultAdapters', () => {
  it('should register HeinAndHopmanIpSystem adapter', () => {
    const registry = new AdapterRegistry();
    const registerSpy = jest.spyOn(registry, 'register');

    registerDefaultAdapters(registry);

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(
      'HeinAndHopmanIpSystem',
      expect.any(Function),
    );
  });

  it('should register a factory that creates a HopmannAdapter', () => {
    const registry = new AdapterRegistry();

    registerDefaultAdapters(registry);

    const connection: AircoConnection = {
      host: '192.168.1.10',
      port: 502,
      type: 'HeinAndHopmanIpSystem',
    };

    const adapter = registry.create('HeinAndHopmanIpSystem', connection);

    expect(adapter).toBeInstanceOf(HopmannAdapter);
  });
});
