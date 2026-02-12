/** polarbear-modbus.ts
 * Low-level Modbus communication functions for Polarbear devices.
 */

import { createRtuMessage, decodeRtuResponse } from '../library/modbus-rtu';
import { modbusfunctions } from './polarbear-constants';
import Logger from '../../../libraries/logger/logger';

export class PolarbearModbus {
  constructor(logger: Logger) {
    // Logger available for future use if needed
  }

  /**
   * Send a Modbus message and wait for response
   */
  async send(connection: any, message: any): Promise<any> {
    return await new Promise((resolve, reject) => {
      try {
        var timeout: any = setTimeout(() => {
          reject('polarbear::send: Timed out, no response.');
        }, 3000);
        connection.once('data', async (data: Buffer) => {
          clearTimeout(timeout);
          await setTimeout(() => {
            resolve(data);
          }, 10);
        });
        connection.write(message);
      } catch (error) {
        // Error handling
      }
    });
  }

  /**
   * Read a holding register from a Polarbear device
   */
  async readHoldingRegister(
    connection: any,
    id: number,
    register: number,
    count: number = 1,
  ): Promise<any> {
    const request = createRtuMessage(
      id,
      modbusfunctions.ReadHolding,
      register,
      count,
    );
    const response = await this.send(connection, request);
    return await decodeRtuResponse(response);
  }

  /**
   * Write a holding register to a Polarbear device
   */
  async writeHoldingRegister(
    connection: any,
    id: number,
    register: number,
    value: number,
  ): Promise<any> {
    const request = createRtuMessage(
      id,
      modbusfunctions.WriteRegister,
      register,
      value,
    );
    return await this.send(connection, request);
  }
}
