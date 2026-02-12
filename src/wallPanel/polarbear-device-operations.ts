/** polarbear-device-operations.ts
 * Device-level operations for reading and writing Polarbear registers.
 */

import { registers, inputs, flagBits } from './polarbear-constants';
import { PolarbearModbus } from './polarbear-modbus';
import Logger from '../../../libraries/logger/logger';

export class PolarbearDeviceOperations {
  private modbus: PolarbearModbus;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.modbus = new PolarbearModbus(logger);
  }

  /**
   * Get the fan mode for a specific zone
   */
  async getFanMode(connection: any, id: number, zone: number): Promise<number> {
    return await new Promise(async (resolve, reject) => {
      try {
        var availableRegisters: any = {
          1: inputs.FlagReg7,
          2: inputs.FlagReg8,
        };
        if (availableRegisters[zone] === undefined) {
          reject('Invalid zone in get fanmode: ' + zone);
          return;
        }

        const decodedResponse = await this.modbus.readHoldingRegister(
          connection,
          id,
          availableRegisters[zone],
          1,
        );
        const value = decodedResponse.values;

        // Extract lower 3 bits as fan mode
        const fanMode = value & 0x0007;

        if (typeof fanMode === 'number') {
          this.logger.debug('Zone ' + zone + ' Room Fanmode:', fanMode);
          resolve(fanMode);
        } else {
          reject(
            'getFanMode:: Invalid message in: ' +
              JSON.stringify(decodedResponse),
          );
        }
      } catch (error: any) {
        this.logger.error('Error in getFanMode:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Set the fan mode for a specific zone
   */
  async setFanMode(
    connection: any,
    id: number,
    zone: number,
    fanmode: number,
  ): Promise<void> {
    try {
      var availableRegisters: any = {
        1: registers.Zone1FanMode,
        2: registers.Zone2FanMode,
      };
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.modbus.writeHoldingRegister(
        connection,
        id,
        availableRegisters[zone],
        fanmode,
      );
    } catch (error) {
      this.logger.error('polarbear::setFanMode: Error', error);
    }
  }

  /**
   * Get the setpoint temperature for a specific zone
   */
  async getSetPoint(connection: any, id: number, zone: number): Promise<number> {
    return await new Promise(async (resolve, reject) => {
      try {
        var availableRegisters: any = {
          1: inputs.FlagReg7,
          2: inputs.FlagReg8,
        };
        if (availableRegisters[zone] === undefined) {
          reject('Invalid zone in get setpoint: ' + zone);
          return;
        }

        const decodedResponse = await this.modbus.readHoldingRegister(
          connection,
          id,
          availableRegisters[zone],
          1,
        );
        const value = await decodedResponse.values;

        // Interpret low bits 7 to 8 as Zn1 Room SetPoint Temperature (Lo 7 + Lo 8)
        const zn1RoomSetPointTempLow = (value & 0x00c0) >> 6;

        // Interpret high bits 1 to 8 as Zn1 Room SetPoint Temperature (Hi 1 to Hi 8)
        const zn1RoomSetPointTempHigh = (value & 0xff00) >> 8;

        const zn1RoomSetPointTemp =
          (zn1RoomSetPointTempHigh << 2) | zn1RoomSetPointTempLow;

        if (zn1RoomSetPointTemp) {
          resolve(zn1RoomSetPointTemp);
        } else {
          reject(
            'getSetpoint:: Invalid message in: ' +
              JSON.stringify(decodedResponse),
          );
        }
      } catch (error) {
        this.logger.error('polarbear::getSetPoint: Error', error);
        reject(error);
      }
    });
  }

  /**
   * Set the setpoint temperature for a specific zone
   */
  async setSetPoint(
    connection: any,
    id: number,
    zone: number,
    setPoint: number,
  ): Promise<void> {
    try {
      var availableRegisters: any = {
        1: registers.Zone1SetPoint,
        2: registers.Zone2SetPoint,
      };
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.modbus.writeHoldingRegister(
        connection,
        id,
        availableRegisters[zone],
        setPoint * 10,
      );
    } catch (error) {
      this.logger.error('polarbear::setSetPoint: Error', error);
    }
  }

  /**
   * Set the current/virtual temperature for a specific zone
   */
  async setCurrentTemperature(
    connection: any,
    id: number,
    zone: number,
    temperature: number,
  ): Promise<void> {
    try {
      var availableRegisters: any = {
        1: registers.Zone1VirtualTemp,
        2: registers.Zone2VirtualTemp,
      };
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.modbus.writeHoldingRegister(
        connection,
        id,
        availableRegisters[zone],
        temperature * 10,
      );
    } catch (error) {
      this.logger.error('polarbear::setCurrentTemperature: Error', error);
    }
  }

  /**
   * Set a flag bit to indicate a change has been processed
   */
  async setFlag(
    connection: any,
    id: number,
    zone: number,
    type: string,
    value: number,
  ): Promise<void> {
    return await new Promise(async (resolve, reject) => {
      var bit: any;

      switch (type) {
        case 'setPoint':
          switch (zone) {
            case 1:
              bit = flagBits.Zn1SetPoint;
              break;
            case 2:
              bit = flagBits.Zn2SetPoint;
              break;
            default:
              reject('setFlag:: undefined zone for setpoint: ' + zone);
              return;
          }
          break;
        case 'fanSpeed':
          switch (zone) {
            case 1:
              bit = flagBits.Zn1FanSpeed;
              break;
            case 2:
              bit = flagBits.Zn2FanSpeed;
              break;
            default:
              reject('setFlag:: undefined zone for setpoint: ' + zone);
              return;
          }
          break;
        default:
          reject('setFlag:: undefined type: ' + type);
          return;
      }

      try {
        const currentValue = value;
        const modifiedValue = currentValue & ~(1 << bit);

        // Write polar bear unit flag to false (clear bit)
        await this.modbus.writeHoldingRegister(
          connection,
          id,
          inputs.FlagReg0,
          modifiedValue,
        );

        // Read polar bear unit to check if the flag has cleared to false
        const decodedResponse = await this.modbus.readHoldingRegister(
          connection,
          id,
          inputs.FlagReg0,
          1,
        );
        const newValue = decodedResponse.values[0];

        if ((newValue & (1 << bit)) !== 0) {
          reject('setFlag:: Bit was not cleared');
        } else {
          resolve();
        }
      } catch (error) {
        reject('Error clearing flag: ' + error);
      }
    });
  }
}
