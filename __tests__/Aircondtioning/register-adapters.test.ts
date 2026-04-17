import AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import HeinEnHopmanGooilandAdapter from '../../src/Airco/adapters/hopmann/HeinEnHopmanGooilandAdapter';
import HopmannAdapter from '../../src/Airco/adapters/hopmann/HopmannAdapter';
import { AircoConnection } from '../../src/Airco/adapters/IAircoAdapter';
import { registerDefaultAdapters } from '../../src/Airco/adapters/registerAdapters';

describe('registerDefaultAdapters', () => {
  it('should register all default airco adapters', () => {
    const registry = new AdapterRegistry();
    const registerSpy = jest.spyOn(registry, 'register');

    registerDefaultAdapters(registry);

    expect(registerSpy).toHaveBeenCalledTimes(2);
    expect(registerSpy).toHaveBeenCalledWith(
      'HeinAndHopmanIpSystem',
      expect.any(Function),
    );
    expect(registerSpy).toHaveBeenCalledWith(
      'HeinAndHopmanGooilandSystem',
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

  it('should register a factory that creates a HeinEnHopmanGooilandAdapter', () => {
    const registry = new AdapterRegistry();

    registerDefaultAdapters(registry);

    const connection: AircoConnection = {
      host: '192.168.1.10',
      port: 502,
      type: 'HeinAndHopmanGooilandSystem',
      roomTemparatureAddress: '40001',
      roomTemparatureSetPointAddress: '40002',
      fanspeedAddress: '40003',
      fanspeedSetPointAddress: '40004',
    };

    const adapter = registry.create('HeinandHopmanGooilandSystem', connection);

    expect(adapter).toBeInstanceOf(HeinEnHopmanGooilandAdapter);
  });
});
