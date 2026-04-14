/**
 * polarbear Backend API
 * Simple backend service to communicate with polarbear Zentium Palladium wall panels
 * using modbus-serial over TCP
 */

import ModbusRTU from 'modbus-serial';

// Configuration
const DEFAULT_HOST = '192.168.55.97';
const DEFAULT_PORT = 4001;
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// V1 registers (bestaande)
const registersV1 = Object.freeze({
  Zone1Setpoint: 601,
  Zone1FanMode: 606,
  Zone1FanSpeed: 607,
  Zone1VirtualTemp: 603,
  Zone2Setpoint: 701,
  Zone2FanMode: 706,
  Zone2FanSpeed: 707,
  Zone2VirtualTemp: 703,
});

// V2 registers (Gateway Status Request v2)
const registersV2 = Object.freeze({
  // Device info
  DeviceType: 7001,
  NumberOfZones: 7012,

  // Zone 1 (7022-7034)
  Zone1DisplayTemp: 7022,
  Zone1WallGroupTemp: 7023,
  Zone1FloorGroupTemp: 7024,
  Zone1Setpoint: 7025,
  Zone1FanSpeed: 7033,

  // Zone 2 (7035-7047)
  Zone2DisplayTemp: 7035,
  Zone2WallGroupTemp: 7036,
  Zone2FloorGroupTemp: 7037,
  Zone2Setpoint: 7038,
  Zone2FanSpeed: 7046,
});

// Input registers
const inputs = Object.freeze({
  DeviceUptime: 100,
  FlagReg0: 110,
  FlagReg7: 117,
  FlagReg8: 118,
  Zone1UserSetPoint: 691,
  Zone2UserSetPoint: 791,
});

interface PolarbearConfig {
  host: string;
  port: number;
  timeout?: number;
}

export class PolarbearBackend {
  private client: ModbusRTU;
  private config: PolarbearConfig;
  private isConnected: boolean = false;

  constructor(config?: Partial<PolarbearConfig>) {
    this.config = {
      host: config?.host || DEFAULT_HOST,
      port: config?.port || DEFAULT_PORT,
      timeout: config?.timeout || DEFAULT_TIMEOUT,
    };
    this.client = new ModbusRTU();
    this.client.setTimeout(this.config.timeout);
  }

  private versionCache: Map<number, 'v1' | 'v2'> = new Map();

  private async detectVersion(unitId: number): Promise<'v1' | 'v2'> {
    // Check cache
    if (this.versionCache.has(unitId)) {
      return this.versionCache.get(unitId)!;
    }

    try {
      this.client.setID(unitId);
      await this.client.readHoldingRegisters(registersV2.DeviceType, 1);
      this.versionCache.set(unitId, 'v2');
      console.log(`Unit ${unitId}: Detected v2 firmware`);
      return 'v2';
    } catch {
      this.versionCache.set(unitId, 'v1');
      console.log(`Unit ${unitId}: Detected v1 firmware`);
      return 'v1';
    }
  }

  /**
   * Read complete Gateway Status v2 (registers 7001-7047 for zones 1-2)
   */
  private async readGatewayStatusV2(unitId: number, zone: 1 | 2) {
    this.client.setID(unitId);

    // Read from 7001, covering zone 1 (7022-7034) and zone 2 (7035-7047)
    // Total: 47 registers (7001-7047)
    const result = await this.client.readHoldingRegisters(7001, 47);

    const zoneOffset = zone === 1 ? 21 : 34; // Zone 1 starts at 7022 (offset 21), Zone 2 at 7035 (offset 34)

    return {
      displayTemp: (result.data[zoneOffset] & 0x03ff) / 10, // Bits 0-9
      wallGroupTemp: (result.data[zoneOffset + 1] & 0x03ff) / 10,
      floorGroupTemp: (result.data[zoneOffset + 2] & 0x03ff) / 10,
      setpoint: (result.data[zoneOffset + 3] & 0x03ff) / 10,
      fanSpeed: result.data[zoneOffset + 11] & 0x07, // Bits 0-2
    };
  }

  /**
   * Connect to the polarbear panel via Modbus TCP
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Already connected');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      (this.client as any).connectTelnet(
        this.config.host,
        { port: this.config.port },
        (err: any) => {
          if (err) {
            console.error('Connection error:', err);
            reject(err);
          } else {
            this.isConnected = true;
            console.log(
              `Connected to Polarbear at ${this.config.host}:${this.config.port}`,
            );
            resolve();
          }
        },
      );
    });
  }

  /**
   * Disconnect from the polarbear panel
   */
  async disconnect(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.isConnected) {
        resolve();
        return;
      }

      this.client.close(() => {
        this.isConnected = false;
        console.log('Disconnected from polarbear');
        resolve();
      });
    });
  }

  /**
   * Check if connected
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  // ======================
  // GETTERS - Zone Temperature
  // ======================

  /**
   * Get virtual temperature for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @returns Temperature in degrees Celsius
   */
  async getVirtualTemperature(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      // V2: gebruik bulk read van Gateway Status
      const status = await this.readGatewayStatusV2(unitId, zone);
      return status.displayTemp;
    } else {
      // V1: gebruik oude registers
      const register =
        zone === 1
          ? registersV1.Zone1VirtualTemp
          : registersV1.Zone2VirtualTemp;

      const result = await this.client.readHoldingRegisters(register, 1);
      return result.data[0] / 10;
    }
  }

  /**
   * Get setpoint temperature for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @returns Setpoint temperature in degrees Celsius
   */
  async getSetpoint(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.readGatewayStatusV2(unitId, zone);
      return status.setpoint;
    } else {
      const register =
        zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;
      const result = await this.client.readHoldingRegisters(register, 1);
      return result.data[0] / 10;
    }
  }

  // ======================
  // GETTERS - Zone Fan
  // ======================

  /**
   * Get fan speed for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @returns Fan speed (0-6 typically)
   */
  async getFanSpeed(unitId: number, zone: 1 | 2): Promise<number> {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.readGatewayStatusV2(unitId, zone);
      return status.fanSpeed;
    } else {
      const register =
        zone === 1 ? registersV1.Zone1FanSpeed : registersV1.Zone2FanSpeed;
      const result = await this.client.readHoldingRegisters(register, 1);
      return result.data[0];
    }
  }

  /**
   * Get fan mode for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @returns Fan mode (0=off, 1=auto, etc.)
   */
  async getFanMode(unitId: number, zone: 1 | 2): Promise<number> {
    const register =
      zone === 1 ? registersV1.Zone1FanMode : registersV1.Zone2FanMode;
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(register, 1);
    return result.data[0];
  }

  // ======================
  // GETTERS - Device Info
  // ======================

  /**
   * Get device uptime
   * @param unitId - Modbus unit ID (1-255)
   * @returns Uptime in minutes
   */
  async getDeviceUptime(unitId: number): Promise<number> {
    this.client.setID(unitId);
    const result = await this.client.readInputRegisters(inputs.DeviceUptime, 1);
    return result.data[0];
  }

  /**
   * Get flag register value
   * @param unitId - Modbus unit ID (1-255)
   * @returns Flag register value
   */
  async getFlags(unitId: number): Promise<number> {
    this.client.setID(unitId);
    const result = await this.client.readHoldingRegisters(inputs.FlagReg0, 1);
    return result.data[0];
  }

  // ======================
  // SETTERS - Zone Temperature
  // ======================

  /**
   * Set virtual temperature for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @param temperature - Temperature in degrees Celsius
   */
  async setVirtualTemperature(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    const register =
      zone === 1 ? registersV1.Zone1VirtualTemp : registersV1.Zone2VirtualTemp;
    this.client.setID(unitId);
    await this.client.writeRegister(register, Math.round(temperature * 10));
    console.log(
      `Set virtual temperature for unit ${unitId}, zone ${zone}: ${temperature}°C`,
    );
  }

  /**
   * Set setpoint temperature for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @param temperature - Temperature in degrees Celsius
   */
  async setSetpoint(
    unitId: number,
    zone: 1 | 2,
    temperature: number,
  ): Promise<void> {
    const register =
      zone === 1 ? registersV1.Zone1Setpoint : registersV1.Zone2Setpoint;
    this.client.setID(unitId);
    await this.client.writeRegister(register, Math.round(temperature * 10));
    console.log(
      `Set setpoint for unit ${unitId}, zone ${zone}: ${temperature}°C`,
    );
  }

  // ======================
  // SETTERS - Zone Fan
  // ======================

  /**
   * Set fan speed for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @param speed - Fan speed (0-6 typically)
   */
  async setFanSpeed(unitId: number, zone: 1 | 2, speed: number): Promise<void> {
    const register =
      zone === 1 ? registersV1.Zone1FanSpeed : registersV1.Zone2FanSpeed;
    this.client.setID(unitId);
    await this.client.writeRegister(register, speed);
    console.log(`Set fan speed for unit ${unitId}, zone ${zone}: ${speed}`);
  }

  /**
   * Set fan mode for a zone
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   * @param mode - Fan mode (0=off, 1=auto, etc.)
   */
  async setFanMode(unitId: number, zone: 1 | 2, mode: number): Promise<void> {
    const register =
      zone === 1 ? registersV1.Zone1FanMode : registersV1.Zone2FanMode;
    this.client.setID(unitId);
    await this.client.writeRegister(register, mode);
    console.log(`Set fan mode for unit ${unitId}, zone ${zone}: ${mode}`);
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Read all zone data for a unit
   * @param unitId - Modbus unit ID (1-255)
   * @param zone - Zone number (1 or 2)
   */
  async getZoneData(unitId: number, zone: 1 | 2) {
    const version = await this.detectVersion(unitId);
    this.client.setID(unitId);

    if (version === 'v2') {
      const status = await this.readGatewayStatusV2(unitId, zone);

      // Wacht voordat je de volgende request doet
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fanMode = await this.getFanMode(unitId, zone);

      return {
        virtualTemperature: status.displayTemp,
        setpoint: status.setpoint,
        fanSpeed: status.fanSpeed,
        fanMode: fanMode,
      };
    } else {
      // V1 blijft hetzelfde
      return {
        virtualTemperature: await this.getVirtualTemperature(unitId, zone),
        setpoint: await this.getSetpoint(unitId, zone),
        fanSpeed: await this.getFanSpeed(unitId, zone),
        fanMode: await this.getFanMode(unitId, zone),
      };
    }
  }

  /**
   * Get configuration
   */
  getConfig(): PolarbearConfig {
    return { ...this.config };
  }
}

// Example usage (for testing purposes only - comment out in production)
async function main() {
  const backend = new PolarbearBackend({
    host: '192.168.55.97',
    port: 4001,
  });

  try {
    // Connect to the device
    await backend.connect();

    // Example: Read zone 1 data for unit 1
    console.log('\n=== Reading Zone 1 Data (Unit 1) ===');
    const zone1Data = await backend.getZoneData(1, 1);
    console.log('Zone 1 Data:', zone1Data);

    // Example: Set virtual temperature
    // await backend.setVirtualTemperature(1, 1, 22.5);

    // Example: Set setpoint
    // await backend.setSetpoint(1, 1, 23.0);

    // Example: Set fan speed
    // await backend.setFanSpeed(1, 1, 3);

    // Example: Set fan mode (1 = auto)
    // await backend.setFanMode(1, 1, 1);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await backend.disconnect();
  }
}

// Uncomment to run the example
// main();

export default PolarbearBackend;
