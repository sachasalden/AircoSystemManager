/** polarbear.ts
 * This module allows reading/writing from/to "Polarbear Zentium Palladium" wall panel/thermostats.
 * This module uses Modbus RTU and TCP.
 *
 * You will have to configure "SENSOR 9" for each zone, to use the 'virtual temperature'.
 *
 * Known issues and hardware limitations:
 * - Units will have to be set up manually
 * - If one unit is offline, it will cause to also not read/write the next unit.
 * - The loop time of domotics may be affected if one of the units does not respond, or a network timeout is blocking a response.
 * [Workaround] - When rebooted, the Zentium Palladium will set "Last user change" to 0 minutes,
 *      this will trigger the software to read the user set temperature and write to the database.
 *      Also, it will set the 'Setpoint temperature' of both zones to 21.
 * [Workaround] - When user changes the temperature, the Zentium Palladium will set "Last user change" to 0 minutes,
 *       however, when reading the 'Setpoint', it'll still have the old value, until the menu is exited.
 *       This does not seem to cause an issue, since after a few seconds it will be saved and since "Last user change" is still 0,
 *       the system will overwrite with the new actual value in the next loop.
 * - This may cause an issue if the loop time is more than ±30 seconds, since it may otherwise not update twice in a minute.
 */

import { AcPanel, Airconditioner } from '../../../../custom_typings/entities';
import DeviceRepository from '../../../services/database/Light/deviceRepository';
import AirconFactory from '../../apiModule/airconFactory';
import Ipolarbear from './Ipolarbear';
import Logger from '../../../libraries/logger/logger';
import { PolarbearDeviceOperations } from './polarbear-device-operations';
import { PolarbearFlagMonitor } from './polarbear-flag-monitor';

const bluePromise: any = require('bluebird');
var net: any = require('net');


class PolarbearController implements Ipolarbear {
  connection: any;
  acpanel: AcPanel;
  deviceRepository: DeviceRepository;
  airconFactory: AirconFactory;
  databaseCheckCounter: number = 0;
  previousAcState: Airconditioner[] = [];
  logger: Logger;
  deviceOps: PolarbearDeviceOperations;
  flagMonitor: PolarbearFlagMonitor;

  constructor(
    acpanel: AcPanel,
    deviceRepository: DeviceRepository,
    airconFactory: AirconFactory,
    logger: Logger,
  ) {
    this.deviceRepository = deviceRepository;
    this.airconFactory = airconFactory;
    this.acpanel = acpanel;
    this.logger = logger;
    this.deviceOps = new PolarbearDeviceOperations(logger);
    this.flagMonitor = new PolarbearFlagMonitor(
      this.deviceOps,
      logger,
      deviceRepository,
      airconFactory,
    );
  }
  getDeviceId(): String {
    return this.acpanel.id;
  }

  updateAcPanels(airconditioners: Array<Airconditioner>): Airconditioner[] {
    this.connection = net.connect({
      host: this.acpanel.ip,
      port: this.acpanel.port,
    });
    if (airconditioners.length == 0) {
      this.logger.error(
        'updateAcPanels::airconditioners is empty, polarbear panels will not be updated.',
      );
    } else {
      try {
        this.flagMonitor.getFlags(
          this.connection,
          this.acpanel.ids,
          airconditioners,
          this.databaseCheckCounter,
          () => this.checkDatabaseChanges(airconditioners),
        );
      } catch (error) {
        this.logger.error('updateAcPanels::getFlags Error', error);
      }
    }
    return airconditioners;
  }

  private async checkDatabaseChanges(airconditioners: Array<Airconditioner>): Promise<void> {
    if (this.databaseCheckCounter == 10) {
      // Prevent database overload
      this.databaseCheckCounter++;

      await new Promise<void>(async (resolve, reject) => {
        var currentFanspeedZone1Changed: boolean = false;
        if (airconditioners[0]) {
          if (this.previousAcState[0]) {
            if ('currentFanspeed' in this.previousAcState[0]) {
              currentFanspeedZone1Changed =
                airconditioners[0].currentFanspeed !==
                this.previousAcState[0].currentFanspeed;
            } else {
              this.logger.error(
                'this.previousAcState[0].currentFanspeed error',
              );
              currentFanspeedZone1Changed = false;
            }
          } else {
            currentFanspeedZone1Changed = true;
          }
        } else {
          currentFanspeedZone1Changed = false;
        }

        var currentFanspeedZone2Changed: boolean = false;
        if (airconditioners[1]) {
          if (this.previousAcState[1]) {
            if ('currentFanspeed' in this.previousAcState[1]) {
              currentFanspeedZone2Changed =
                airconditioners[1].currentFanspeed !==
                this.previousAcState[1].currentFanspeed;
            } else {
              this.logger.error(
                'this.previousAcState[1].currentFanspeed error',
              );
              currentFanspeedZone2Changed = false;
            }
          } else {
            currentFanspeedZone2Changed = true;
          }
        } else {
          currentFanspeedZone2Changed = false;
        }

        var currentTemperatureZone1Changed: boolean = false;
        if (airconditioners[0]) {
          if (this.previousAcState[0]) {
            if (this.previousAcState[0].currentTemperature) {
              currentTemperatureZone1Changed =
                airconditioners[0].currentTemperature !==
                this.previousAcState[0].currentTemperature;
            } else {
              this.logger.error(
                'this.previousAcState[0].currentTemperature error',
              );
              currentTemperatureZone1Changed = false;
            }
          } else {
            currentTemperatureZone1Changed = true;
          }
        } else {
          currentTemperatureZone1Changed = false;
        }

        var currentTemperatureZone2Changed: boolean = false;
        if (airconditioners[1]) {
          if (this.previousAcState[1]) {
            if (this.previousAcState[1].currentTemperature) {
              currentTemperatureZone2Changed =
                airconditioners[1].currentTemperature !==
                this.previousAcState[1].currentTemperature;
            } else {
              this.logger.error(
                'this.previousAcState[1].currentTemperature error',
              );
              currentTemperatureZone2Changed = false;
            }
          } else {
            currentTemperatureZone2Changed = true;
          }
        } else {
          currentTemperatureZone2Changed = false;
        }

        var setTemperatureZone1Changed: boolean = false;
        if (airconditioners[0]) {
          if (this.previousAcState[0]) {
            if (this.previousAcState[0].setTemperature) {
              setTemperatureZone1Changed =
                airconditioners[0].setTemperature !==
                this.previousAcState[0].setTemperature;
            } else {
              this.logger.error('this.previousAcState[0].setTemperature error');
              setTemperatureZone1Changed = false;
            }
          } else {
            setTemperatureZone1Changed = true;
          }
        } else {
          setTemperatureZone1Changed = false;
        }

        var setTemperatureZone2Changed: boolean = false;
        if (airconditioners[1]) {
          if (this.previousAcState[1]) {
            if (this.previousAcState[1].setTemperature) {
              setTemperatureZone2Changed =
                airconditioners[1].setTemperature !==
                this.previousAcState[1].setTemperature;
            } else {
              this.logger.error('this.previousAcState[1].setTemperature error');
              setTemperatureZone2Changed = false;
            }
          } else {
            setTemperatureZone2Changed = true;
          }
        } else {
          setTemperatureZone2Changed = false;
        }

        if (
          currentFanspeedZone1Changed ||
          currentFanspeedZone2Changed ||
          currentTemperatureZone1Changed ||
          currentTemperatureZone2Changed ||
          setTemperatureZone1Changed ||
          setTemperatureZone2Changed
        ) {
          await bluePromise.delay(1500); // Delay to prevent update while person is still busy changing the fan speed

          await new Promise(async (resolve, reject) => {
            if (currentFanspeedZone1Changed) {
              // Check if the fan speed has changed in airconditioner 1 (zone 1)
              var fanMode: number;
              var fanSpeed: number = airconditioners[0].currentFanspeed;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' currentFanspeedZone1Changed',
                fanSpeed,
              );

              // Convert speed from database to polarbear
              if (fanSpeed === 0) {
                fanMode = 0;
              } else if (fanSpeed === -1) {
                fanMode = 1;
              } else {
                fanMode = fanSpeed + 1;
              }

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setFanMode(this.connection, Number(id), 1, fanMode)
                  .then(async () => {
                    await this.deviceOps.setFlag(this.connection, Number(id), 1, 'fanSpeed', 0).catch(
                      (error) => {
                        reject('checkDatabaseChanges::setFlag Error: ' + error);
                      },
                    );
                  })
                  .catch((error) => {
                    reject('checkDatabaseChanges::setFanMode Error: ' + error);
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve('currentFanspeed zone 1 changes');
            } else {
              resolve('currentFanspeed zone 1 no changes');
            }
          });

          await new Promise(async (resolve, reject) => {
            if (currentFanspeedZone2Changed && airconditioners[1]) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var fanMode: number;
              var fanSpeed: number = airconditioners[1].currentFanspeed;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' currentFanspeedZone2Changed',
                fanSpeed,
              );

              // Convert speed from database to polarbear
              if (fanSpeed === 0) {
                fanMode = 0;
              } else if (fanSpeed === -1) {
                fanMode = 1;
              } else {
                fanMode = fanSpeed + 1;
              }

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setFanMode(this.connection, Number(id), 2, fanMode)
                  .then(async () => {
                    await this.deviceOps.setFlag(this.connection, Number(id), 2, 'fanSpeed', 0).catch(
                      (error) => {
                        reject('checkDatabaseChanges::setFlag Error: ' + error);
                      },
                    );
                  })
                  .catch((error) => {
                    reject('checkDatabaseChanges::setFanMode Error: ' + error);
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve('currentFanspeed zone 2 changes');
            } else {
              resolve('currentFanspeed zone 2 no changes');
            }
          });

          await new Promise(async (resolve, reject) => {
            if (currentTemperatureZone1Changed) {
              // Check if the setpoint has changed in airconditioner 1 (zone 1)
              var currentTemperature: number =
                airconditioners[0].currentTemperature;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' currentTemperatureZone1Changed',
                currentTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setCurrentTemperature(
                  this.connection,
                  Number(id),
                  1,
                  currentTemperature,
                )
                  .then(async () => {
                    await bluePromise.delay(100); // Delay to prevent overloading the modbus
                  })
                  .catch((error) => {
                    reject(
                      'checkDatabaseChanges::setCurrentTemperature Error: ' +
                        error,
                    );
                  });
              }
              resolve('currentTemperature zone 1 changes');
            } else {
              resolve('currentTemperature zone 1 no changes');
            }
          }).then(async () => {
            if (currentTemperatureZone1Changed) {
              await bluePromise.delay(100); // Delay to prevent overloading the modbus
            }
          });

          await new Promise(async (resolve, reject) => {
            if (currentTemperatureZone2Changed && airconditioners[1]) {
              // Check if the setpoint has changed in airconditioner 1 (zone 1)
              var currentTemperature: number =
                airconditioners[1].currentTemperature;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' currentTemperatureZone2Changed',
                currentTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setCurrentTemperature(
                  this.connection,
                  Number(id),
                  2,
                  currentTemperature,
                )
                  .then(async () => {
                    await bluePromise.delay(100); // Delay to prevent overloading the modbus
                  })
                  .catch((error) => {
                    reject(
                      'checkDatabaseChanges::setCurrentTemperature Error: ' +
                        error,
                    );
                  });
              }
              resolve('currentTemperature zone 2 changes');
            } else {
              resolve('currentTemperature zone 2 no changes');
            }
          }).then(async () => {
            if (currentTemperatureZone2Changed) {
              await bluePromise.delay(100); // Delay to prevent overloading the modbus
            }
          });

          await new Promise(async (resolve, reject) => {
            if (setTemperatureZone1Changed) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var setTemperature: number = airconditioners[0].setTemperature;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' setTemperatureZone1Changed',
                setTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setSetPoint(this.connection, Number(id), 1, setTemperature)
                  .then(async () => {
                    await this.deviceOps.setFlag(this.connection, Number(id), 1, 'setPoint', 0).catch(
                      (error) => {
                        reject('checkDatabaseChanges::setFlag Error: ' + error);
                      },
                    );
                  })
                  .catch((error) => {
                    reject('checkDatabaseChanges::setSetPoint Error: ' + error);
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve('setTemperature zone 1');
            } else {
              resolve('setTemperature zone 1 no changes');
            }
          });

          await new Promise(async (resolve, reject) => {
            if (setTemperatureZone2Changed && airconditioners[1]) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var setTemperature: number = airconditioners[1].setTemperature;
              this.logger.debug(
                'checkDatabaseChanges::' +
                  this.acpanel.ip +
                  ' setTemperatureZone2Changed',
                setTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.deviceOps.setSetPoint(this.connection, Number(id), 2, setTemperature)
                  .then(async () => {
                    await this.deviceOps.setFlag(this.connection, Number(id), 2, 'setPoint', 0).catch(
                      (error) => {
                        reject('checkDatabaseChanges::setFlag Error: ' + error);
                      },
                    );
                  })
                  .catch((error) => {
                    reject('checkDatabaseChanges::setSetPoint Error: ' + error);
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve('setTemperature zone 2 changes');
            } else {
              resolve('setTemperature zone 2 no changes');
            }
          });

          this.previousAcState = JSON.parse(JSON.stringify(airconditioners)); // Update previous state with new database state
          resolve('checkDatabaseChanges:: done');
        }

        this.databaseCheckCounter = 0;
      });
    } else {
      this.databaseCheckCounter++;
      return;
    }
  }


  closeConnection(): void {
    this.connection.close();
  }
}

export default PolarbearController;
