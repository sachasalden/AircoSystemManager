import HopmannAdapter from '../src/Airco/adapters/hopmann/HopmannAdapter';
import { AircoConnection, AircoZone } from '../src/Airco/adapters/IAircoAdapter';

jest.setTimeout(30000);

describe('HopmannAdapter temperature test', () => {
  const connection: AircoConnection = {
    host: '192.168.55.10',
    port: 502,
    type: 'FC-500PC/FC-1100PC',
  };

  const adapter = new HopmannAdapter(connection);

  const unitId = 1;
  const zone = 1 as AircoZone;

  beforeAll(async () => {
    await adapter.connect();
  });

  afterAll(async () => {
    await adapter.disconnect();
  });

  it('should write and read temperature setpoint', async () => {
    const targetTemperature = 20.5;

    await adapter.setSetpoint(unitId, zone, targetTemperature);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const readTemperature = await adapter.getSetpoint(unitId, zone);

    console.log('Written temperature:', targetTemperature);
    console.log('Read temperature:', readTemperature);

    // Ruimer i.v.m. device loops / afronding op hardware
    expect(Math.abs(readTemperature - targetTemperature)).toBeLessThanOrEqual(4.5);
  });
});
