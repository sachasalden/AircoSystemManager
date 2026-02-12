/** polarbear-flag-monitor.ts
 * Handles flag monitoring and response processing for Polarbear devices.
 */

import { createRtuMessage, decodeRtuResponse } from '../library/modbus-rtu';
import { inputs, modbusfunctions } from './polarbear-constants';
import { PolarbearDeviceOperations } from './polarbear-device-operations';
import DeviceRepository from '../../../services/database/Light/deviceRepository';
import AirconFactory from '../../apiModule/airconFactory';
import AirconController from '../airconModule/airconditionerController';
import Logger from '../../../libraries/logger/logger';

export class PolarbearFlagMonitor {
  private deviceOps: PolarbearDeviceOperations;
  private logger: Logger;
  private deviceRepository: DeviceRepository;
  private airconFactory: AirconFactory;

  constructor(
    deviceOps: PolarbearDeviceOperations,
    logger: Logger,
    deviceRepository: DeviceRepository,
    airconFactory: AirconFactory,
  ) {
    this.deviceOps = deviceOps;
    this.logger = logger;
    this.deviceRepository = deviceRepository;
    this.airconFactory = airconFactory;
  }

  /**
   * Send a message and wait for response
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
   * Read flags from all panel IDs
   */
  async getFlags(
    connection: any,
    ids: Array<String>,
    airconditioners: any,
    databaseCheckCounter: number,
    checkDatabaseChanges: () => Promise<void>,
  ): Promise<void> {
    if (databaseCheckCounter >= 10) {
      // Prevent getFlags check when running database check
      // skip
    } else {
      try {
        var decodedResponses: any = [];
        for (const id of ids) {
          var request = createRtuMessage(
            Number(id),
            modbusfunctions.ReadHolding,
            inputs.FlagReg0,
            1,
          );
          var response = await this.send(connection, request).catch((error) => {
            this.logger.error(
              'Error sending request for ID: ' + id + ' ' + error.message,
            );
          });
          decodedResponses.push(await decodeRtuResponse(await response));
        }

        // Check if all responses are received
        if (ids.length == decodedResponses.length) {
          for (const decodedResponse of decodedResponses) {
            await this.processResponse(connection, decodedResponse, airconditioners);
          }
        } else {
          this.logger.debug('getFlags:: getFlags:: not all responses');
        }
      } catch (error) {
        this.logger.error('getFlags:: Error in Decoding flags:', error);
      }
    }

    setTimeout(() => {
      this.getFlags(connection, ids, airconditioners, databaseCheckCounter, checkDatabaseChanges).then(
        async () => {
          await checkDatabaseChanges();
        },
      );
    }, 20);
  }

  /**
   * Process response from flag reading
   */
  async processResponse(
    connection: any,
    decodedResponse: any,
    airconditioners: any,
  ): Promise<void> {
    return await new Promise(async (resolve, reject) => {
      let device: any = await this.deviceRepository.getDeviceById(
        airconditioners[0].data.deviceId,
      );
      let aircoApi: AirconController =
        this.airconFactory.getAirconditionerImplementation(device);
      try {
        const value = await decodedResponse.values;
        // Zone 1
        const Zn1SetPoint_CHC = (value & 0x0001) !== 0;
        const Zn1Fanspeed_CHC = (value & 0x0002) !== 0;
        // Zone 2
        const Zn2SetPoint_CHC = (value & 0x0100) !== 0;
        const Zn2Fanspeed_CHC = (value & 0x0200) !== 0;

        if (Zn1SetPoint_CHC || (Zn2SetPoint_CHC && airconditioners[1])) {
          var zone = Zn1SetPoint_CHC ? 1 : 2;
          await this.deviceOps
            .setFlag(connection, decodedResponse.id, zone, 'setPoint', value)
            .then(async () => {
              this.logger.debug('processResponse:: flag cleared');

              const setPointResult = await this.deviceOps.getSetPoint(
                connection,
                decodedResponse.id,
                zone,
              );

              if (typeof setPointResult === 'number') {
                const setPoint: number = setPointResult;
                this.logger.debug(
                  'SetPoint changed for zone: ' + zone,
                  'New setpoint: ' + setPoint,
                );
                resolve();
              } else {
                this.logger.error(
                  'processResponse::setOtherPanelsCorrect Unexpected type for setPointResult: ' +
                    typeof setPointResult,
                );
                resolve();
              }
            })
            .catch((error) => {
              reject('processResponse::setFlag Error: ' + error);
            });
        } else if (Zn1Fanspeed_CHC || (Zn2Fanspeed_CHC && airconditioners[1])) {
          var zone = Zn1Fanspeed_CHC ? 1 : 2;

          await this.deviceOps
            .setFlag(connection, decodedResponse.id, zone, 'fanSpeed', value)
            .then(async () => {
              this.logger.debug('processResponse:: flag cleared');

              var fanmodeResult: number = Number(
                await this.deviceOps.getFanMode(connection, decodedResponse.id, zone),
              );
              if (typeof fanmodeResult === 'number') {
                const fanmode: number = fanmodeResult;

                this.logger.debug(
                  'FanSpeed changed for zone: ' + zone,
                  'New fanmode: ' + fanmode,
                );

                // Update airconditioner (database) based on panel type
                if (fanmode === 0) {
                  await aircoApi.setFanSpeed(airconditioners[zone - 1], 0);
                } else if (fanmode === 1) {
                  await aircoApi.setFanSpeed(airconditioners[zone - 1], -1);
                } else {
                  await aircoApi.setFanSpeed(
                    airconditioners[zone - 1],
                    fanmode - 1,
                  );
                }
                resolve();
              } else {
                this.logger.error(
                  'processResponse fanmode is not a number type: ' +
                    typeof fanmodeResult +
                    ' value: ' +
                    fanmodeResult,
                );
                resolve();
              }
            })
            .catch((error) => {
              reject('processResponse::setFlag Error: ' + error);
            });
        } else {
          resolve();
        }
      } catch (error) {
        reject('Error in processResponse: ' + error);
      }
    });
  }
}
