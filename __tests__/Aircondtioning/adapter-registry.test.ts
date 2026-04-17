import AdapterRegistry from '../../src/Airco/adapters/AdapterRegistry';
import { AircoConnection } from '../../src/Airco/adapters/IAircoAdapter';

describe('AdapterRegistry', () => {
  const connection: AircoConnection = {
    host: '192.168.1.10',
    port: 502,
    type: 'hopmann',
  };

  it('should register and create an adapter', () => {
    const registry = new AdapterRegistry();
    const adapter = { name: 'mockAdapter' };
    const factory = jest.fn().mockReturnValue(adapter);

    registry.register('hopmann', factory);

    expect(registry.has('hopmann')).toBe(true);
    expect(registry.create('hopmann', connection)).toBe(adapter);
    expect(factory).toHaveBeenCalledWith(connection);
  });

  it('should throw when adapter type is not registered', () => {
    const registry = new AdapterRegistry();

    expect(() => registry.create('unknown', connection)).toThrow(
      'No airco adapter registered for type "unknown"',
    );
  });

  it('should normalize type names', () => {
    const registry = new AdapterRegistry();
    const adapter = { name: 'mockAdapter' };
    const factory = jest.fn().mockReturnValue(adapter);

    registry.register('  HopMann  ', factory);

    expect(registry.has('hopmann')).toBe(true);
    expect(registry.has('HOPMANN')).toBe(true);
  });

  it('should list registered type labels sorted by name', () => {
    const registry = new AdapterRegistry();

    registry.register('ZuluAdapter', jest.fn());
    registry.register('AlphaAdapter', jest.fn());

    expect(registry.listTypes()).toEqual(['AlphaAdapter', 'ZuluAdapter']);
  });
});
