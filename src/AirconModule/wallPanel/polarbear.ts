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

import { AcPanel, Airconditioner } from '../custom_typings/entities';
import ModbusRTU from 'modbus-serial';
import DeviceRepository from '../../../services/database/Light/deviceRepository';
import AirconFactory from '../../apiModule/airconFactory';
import AirconController from '../airconModule/airconditionerController';
import Ipolarbear from './Ipolarbear';
import Logger from '../../../libraries/logger/logger';


//From: Zentium_RTU_PointsList_r02.01.pdf
//Coils:

const flagBits: any = Object.freeze({
  Zn1SetPoint: 0,
  Zn1FanSpeed: 1,
  Zn2SetPoint: 8,
  Zn2FanSpeed: 9,
});

const coils: any = Object.freeze({
  CentigradeOrFahrenheit: 11,
  DisplayFlameSymbol: 12,
  DisplaySnowflakeSymbol: 13,
  DisplayStatus: 31,
});

//Registers:
const registers: any = Object.freeze({
  Zone1SetPoint: 601,
  Zone1FanMode: 606,
  Zone1FanSpeed: 607,
  Zone2FanMode: 706,
  Zone2FanSpeed: 707,
  Zone2SetPoint: 701,
  Zone1VirtualTemp: 603,
  Zone2VirtualTemp: 703,
  NewZone1VirtualTemp: 21051,
  NewZone2VirtualTemp: 22051,
});

//Analogue inputs:
const inputs: any = Object.freeze({
  DeviceUptime: 100,
  FlagReg0: 110,
  FlagReg7: 117,
  FlagReg8: 118,
  Zone1UserSetPoint: 691,
  Zone2UserSetPoint: 791,
});

var fanspeeds: Array<number> = [];
var setPoints: Array<number> = [];
var fanmodes: Array<number> = [];
var fanspeedsZn2: Array<number> = [];
var setPointsZn2: Array<number> = [];
var fanmodesZn2: Array<number> = [];
var lastIdChanged: Number = 0;

//Modbus functions:
const modbusfunctions: any = Object.freeze({
  ReadCoil: 0x01,
  ReadDiscrete: 0x02,
  ReadHolding: 0x03,
  ReadInput: 0x04,
  WriteCoil: 0x05,
  WriteRegister: 0x06,
  WriteCoils: 0x0f,
  WriteRegisters: 0x10,
});

class PolarbearController implements Ipolarbear {
  client: ModbusRTU;
  acpanel: AcPanel;
  deviceRepository: DeviceRepository;
  airconFactory: AirconFactory;
  databaseCheckCounter: number = 0;
  previousAcState: Airconditioner[] = [];
  logger: Logger;
  private reconnectDelay: number = 5000; // 5 seconds
  private connectionTimeout: number = 10000; // 10 seconds
  private reconnecting: boolean = false;
  private isConnected: boolean = false;

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
    this.client = new ModbusRTU();
    this.client.setTimeout(this.connectionTimeout);
  }
  getDeviceId(): String {
    return this.acpanel.id;
  }

  updateAcPanels(airconditioners: Array<Airconditioner>): Airconditioner[] {
    this.connect().catch((error) => {
      this.logger.error(
        'updateAcPanels::connect Error, connection: ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
        error,
      );
    });

    if (airconditioners.length === 0) {
      this.logger.error(
        'updateAcPanels::airconditioners is empty, polarbear panels will not be updated.',
      );
    } else {
      try {
        this.getFlags(this.acpanel.ids, airconditioners)
          .then(async () => {
            await this.checkDatabaseChanges(airconditioners).catch((error) => {
              this.logger.error(
                'updateAcPanels::getFlags::checkDatabaseChanges Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' ids: ' +
                  this.acpanel.ids.toString(),
                error,
              );
            });
          })
          .catch((error) => {
            this.logger.error(
              'updateAcPanels::getFlags Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port +
                ' ids: ' +
                this.acpanel.ids.toString(),
              error,
            );
          });
      } catch (error) {
        this.logger.error(
          'updateAcPanel:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port +
            ' ids: ' +
            this.acpanel.ids.toString(),
          error,
        );
      }
    }
    return airconditioners;
  }

  private async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        (this.client as any).connectTelnet(
          this.acpanel.ip,
          { port: this.acpanel.port },
          (err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      this.isConnected = true;
      this.reconnecting = false;
      this.logger.info(
        'PolarbearController::connect:: Successfully connected to ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
      );

      // Set up error handling
      (this.client as any)._port?.on('error', (error: any) => {
        this.logger.error(
          'PolarbearController::connect:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error,
        );
        this.isConnected = false;
        this.handleReconnect();
      });

      (this.client as any)._port?.on('close', () => {
        this.logger.warn(
          `PolarbearController::connect:: Connection closed, attempting to reconnect... ${this.acpanel.ip}:${this.acpanel.port}`,
        );
        this.isConnected = false;
        this.handleReconnect();
      });

    } catch (error: any) {
      this.logger.error(
        'PolarbearController::connect:: Error connecting to ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
        error,
      );
      this.isConnected = false;
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnecting) {
      // Prevent multiple reconnection attempts
      return;
    }
    this.reconnecting = true;
    this.logger.info(
      `PolarbearController::handleReconnect:: Attempting to reconnect... ${this.acpanel.ip}:${this.acpanel.port}`,
    );
    setTimeout(async () => {
      await this.connect();
    }, this.reconnectDelay);
  }

  private async checkDatabaseChanges(
    airconditioners: Array<Airconditioner>,
  ): Promise<void | any> {
    if (this.databaseCheckCounter === 10) {
      // Prevent database overload
      this.databaseCheckCounter++;

      return await new Promise(async (resolve, reject) => {
        var currentFanspeedZone1Changed: boolean = false;
        if (airconditioners[0]) {
          if (this.previousAcState[0]) {
            if ('currentFanspeed' in this.previousAcState[0]) {
              currentFanspeedZone1Changed =
                airconditioners[0].currentFanspeed !==
                this.previousAcState[0].currentFanspeed;
            } else {
              this.logger.error(
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 1',
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
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 2',
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
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 1',
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
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 2',
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
              this.logger.error(
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 1',
                'this.previousAcState[0].setTemperature error',
              );
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
              this.logger.error(
                'checkDatabaseChanges:: Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' zone: 2',
                'this.previousAcState[1].setTemperature error',
              );
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
          await new Promise(async (resolve, reject) => {
            if (currentFanspeedZone1Changed) {
              // Check if the fan speed has changed in airconditioner 1 (zone 1)
              var fanMode: number;
              var fanSpeed: number = airconditioners[0].currentFanspeed;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeedZone1Changed: ' +
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
                await this.setFanMode(Number(id), 1, fanMode)
                  .then(async () => {
                    await this.setFlag(Number(id), 1, 'fanSpeed', 0).catch(
                      (error) => {
                        reject(
                          this.acpanel.ip +
                            ':' +
                            this.acpanel.port +
                            ' checkDatabaseChanges::setFlag Error: ' +
                            error,
                        );
                      },
                    );
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setFanMode Error: ' +
                        error,
                    );
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeed zone 1 changes',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeed zone 1 no changes',
              );
            }
          }).catch((error) => {
            this.logger.error(
              'checkDatabaseChanges::currentFanspeedZone1 Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port,
              error,
            );
          });

          await new Promise(async (resolve, reject) => {
            if (currentFanspeedZone2Changed && airconditioners[1]) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var fanMode: number;
              var fanSpeed: number = airconditioners[1].currentFanspeed;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeedZone2Changed: ' +
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
                await this.setFanMode(Number(id), 2, fanMode)
                  .then(async () => {
                    await this.setFlag(Number(id), 2, 'fanSpeed', 0).catch(
                      (error) => {
                        reject(
                          this.acpanel.ip +
                            ':' +
                            this.acpanel.port +
                            ' checkDatabaseChanges::setFlag Error: ' +
                            error,
                        );
                      },
                    );
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setFanMode Error: ' +
                        error,
                    );
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeed zone 2 changes',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentFanspeed zone 2 no changes',
              );
            }
          }).catch((error) => {
            this.logger.error(
              'checkDatabaseChanges::currentFanspeedZone2 Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port,
              error,
            );
          });

          await new Promise(async (resolve, reject) => {
            if (currentTemperatureZone1Changed) {
              // Check if the setpoint has changed in airconditioner 1 (zone 1)
              var currentTemperature: number =
                airconditioners[0].currentTemperature;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperatureZone1Changed: ' +
                  currentTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.setCurrentTemperature(
                  Number(id),
                  1,
                  currentTemperature,
                  this.acpanel.type,
                )
                  .then(async () => {
                    await bluePromise.delay(100); // Delay to prevent overloading the modbus
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setCurrentTemperature Error: ' +
                        error,
                    );
                  });
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperature zone 1 changes',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperature zone 1 no changes',
              );
            }
          })
            .then(async () => {
              if (currentTemperatureZone1Changed) {
                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
            })
            .catch((error) => {
              this.logger.error(
                'checkDatabaseChanges::currentTemperatureZone1 Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port,
                error,
              );
            });

          await new Promise(async (resolve, reject) => {
            if (currentTemperatureZone2Changed && airconditioners[1]) {
              // Check if the setpoint has changed in airconditioner 1 (zone 1)
              var currentTemperature: number =
                airconditioners[1].currentTemperature;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperatureZone2Changed: ' +
                  currentTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                await this.setCurrentTemperature(
                  Number(id),
                  2,
                  currentTemperature,
                  this.acpanel.type,
                )
                  .then(async () => {
                    await bluePromise.delay(100); // Delay to prevent overloading the modbus
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setCurrentTemperature Error: ' +
                        error,
                    );
                  });
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperature zone 2 changes',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' currentTemperature zone 2 no changes',
              );
            }
          })
            .then(async () => {
              if (currentTemperatureZone2Changed) {
                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
            })
            .catch((error) => {
              this.logger.error(
                'checkDatabaseChanges::currentTemperatureZone2 Error, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port,
                error,
              );
            });

          await new Promise(async (resolve, reject) => {
            if (setTemperatureZone1Changed) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var setTemperature: number = airconditioners[0].setTemperature;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperatureZone1Changed: ' +
                  setTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                if (setTemperature * 10 > 300) {
                  console.error('Temperature is too high, setting to 30');
                  await this.getSetPoint(Number(id), 1).then((setPoint) => {
                    setTemperature = setPoint;
                    if (setTemperature * 10 > 300) {
                      console.error(
                        'Temperature is still too high, after two retries',
                      );
                    }
                  });
                }
                await this.setSetPoint(Number(id), 1, setTemperature)
                  .then(async () => {
                    await this.setFlag(Number(id), 1, 'setPoint', 0).catch(
                      (error) => {
                        reject(
                          this.acpanel.ip +
                            ':' +
                            this.acpanel.port +
                            ' checkDatabaseChanges::setFlag Error: ' +
                            error,
                        );
                      },
                    );
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setSetPoint Error: ' +
                        error,
                    );
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperature zone 1',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperature zone 1 no changes',
              );
            }
          }).catch((error) => {
            this.logger.error(
              'checkDatabaseChanges::setTemperatureZone1 Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port,
              error,
            );
          });

          await new Promise(async (resolve, reject) => {
            if (setTemperatureZone2Changed && airconditioners[1]) {
              // Check if the fan speed has changed in airconditioner 2 (zone 2)
              var setTemperature: number = airconditioners[1].setTemperature;
              this.logger.debug(
                'checkDatabaseChanges::, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperatureZone2Changed: ' +
                  setTemperature,
              );

              // Update polarbear units
              for (const id of this.acpanel.ids) {
                if (setTemperature * 10 > 300) {
                  console.error('Temperature is too high, getting new zn2');
                  await this.getSetPoint(Number(id), 2).then((setPoint) => {
                    setTemperature = setPoint;
                    if (setTemperature * 10 > 300) {
                      console.error(
                        'Temperature is still too high, after two retries zn2',
                      );
                    }
                  });
                }
                await this.setSetPoint(Number(id), 2, setTemperature)
                  .then(async () => {
                    await this.setFlag(Number(id), 2, 'setPoint', 0).catch(
                      (error) => {
                        reject(
                          this.acpanel.ip +
                            ':' +
                            this.acpanel.port +
                            ' checkDatabaseChanges::setFlag Error: ' +
                            error,
                        );
                      },
                    );
                  })
                  .catch((error) => {
                    reject(
                      this.acpanel.ip +
                        ':' +
                        this.acpanel.port +
                        ' checkDatabaseChanges::setSetPoint Error: ' +
                        error,
                    );
                  });

                await bluePromise.delay(100); // Delay to prevent overloading the modbus
              }
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperature zone 2 changes',
              );
            } else {
              resolve(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setTemperature zone 2 no changes',
              );
            }
          }).catch((error) => {
            this.logger.error(
              'checkDatabaseChanges::setTemperatureZone2 Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port,
              error,
            );
          });

          this.previousAcState = JSON.parse(JSON.stringify(airconditioners)); // Update previous state with new database state
          resolve(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' checkDatabaseChanges:: done',
          );
        }

        this.databaseCheckCounter = 0;
      }).catch((error) => {
        this.logger.error(
          'checkDatabaseChanges:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error,
        );
      });
    } else {
      this.databaseCheckCounter++;
      return;
    }
  }

  private async setFlag(
    id: number,
    zone: number,
    type: string,
    value: number,
  ): Promise<void | any> {
    return await new Promise(async (resolve, reject) => {
      var bit: any;
      //val 32769
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
              reject(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setFlag:: undefined zone for setpoint: ' +
                  zone,
              );
              break;
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
              reject(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' setFlag:: undefined zone for setpoint: ' +
                  zone,
              );
              break;
          }
          break;
        default:
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' setFlag:: undefined type: ' +
              type,
          );
          break;
      }

      try {
        const currentValue: any = value;
        const modifiedValue: any = currentValue & ~(1 << bit);

        // Write polar bear unit flag to false (clear bit)
        await this.writeRegister(id, inputs.FlagReg0, modifiedValue);

        // Read polar bear unit to check if the flag has cleared to false
        const response = await this.readHoldingRegisters(id, inputs.FlagReg0, 1);
        const newValue: any = response[0];

        if ((newValue & (1 << bit)) !== 0) {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' Bit was not cleared for id: ' +
              id,
          );
        } else {
          resolve(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' Bit was cleared for id: ' +
              id,
          );
        }
      } catch (error: any) {
        reject(
          'Error clearing flag, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port +
            ' id: ' +
            id +
            ' error: ' +
            (error.message || error),
        );
      }
    });
  }

  private async getFlags(
    ids: Array<String>,
    airconditioners: any,
  ): Promise<void | any> {
    if (this.databaseCheckCounter >= 10) {
      // Prevent getFlags check when running database check
      // skip
    } else {
      try {
        var decodedResponses: any = [];
        for (const id of ids) {
          try {
            const response = await this.readHoldingRegisters(
              Number(id),
              inputs.FlagReg0,
              1,
            );

            if (response === undefined || response[0] === undefined) {
              this.logger.error(
                'Response undefined for:',
                this.acpanel.ip,
                'port:',
                this.acpanel.port,
                'id:',
                id,
              );
            } else {
              decodedResponses.push({
                unitId: Number(id),
                values: response,
              });
            }
          } catch (error: any) {
            this.logger.error(
              'getFlags::send Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port +
                ' id: ' +
                id,
              error.message,
            );
          }
        }

        // Check if all responses are received
        if (ids.length === decodedResponses.length) {
          for (const decodedResponse of decodedResponses) {
            await this.processResponse(decodedResponse, airconditioners);
          }
        } else {
          this.logger.debug(
            'getFlags::, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            'not all responses',
          );
        }
      } catch (error) {
        this.logger.error(
          'getFlags:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error,
        );
      }
    }

    setTimeout(() => {
      this.getFlags(ids, airconditioners)
        .then(async () => {
          await this.checkDatabaseChanges(airconditioners).catch((error) => {
            this.logger.error(
              'getFlags::checkDatabaseChanges Error, connection: ' +
                this.acpanel.ip +
                ':' +
                this.acpanel.port,
              error,
            );
          });
        })
        .catch((error) => {
          this.logger.error(
            'getFlags:: Error, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            error,
          );
        });
    }, 20);
  }

  private async setOtherPanelsCorrect(
    id: number,
    zone: number,
    setPoint: number,
    aircoApi: any,
    airconditioners: any,
  ): Promise<void | any> {
    for (const id of this.acpanel.ids) {
      await this.setSetPoint(Number(id), zone, (await setPoint) / 10)
        .then(async () => {
          await aircoApi.setTemperature(
            airconditioners[zone - 1],
            (await setPoint) / 10,
          );
        })
        .catch(async (error) => {
          this.logger.error(
            'setOtherPanelsCorrect:: Error, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            error,
          );
        });
    }
  }

  private async processResponse(
    decodedResponse: any,
    airconditioners: any,
  ): Promise<void | any> {
    return await new Promise(async (resolve, reject) => {
      let device: any = await this.deviceRepository.getDeviceById(
        airconditioners[0].data.deviceId,
      );
      let aircoApi: AirconController | null =
        this.airconFactory.getAirconditionerImplementation(device);

      if (!aircoApi) {
        this.logger.error(
          'processResponse:: Error, AirconController implementation not found for device:',
          device,
        );
        return;
      }
      try {
        const value: any = await decodedResponse.values;
        // Zone 1
        const zn1SetPointChc: any = (value & 0x0001) !== 0;
        const zn1FanspeedChc: any = (value & 0x0002) !== 0;
        // Zone 2
        const zn2SetPointChc: any = (value & 0x0100) !== 0;
        const zn2FanspeedChc: any = (value & 0x0200) !== 0;
        var zone: any;

        if (zn1SetPointChc || (zn2SetPointChc && airconditioners[1])) {
          zone = zn1SetPointChc ? 1 : 2;
          await this.setFlag(decodedResponse.id, zone, 'setPoint', value)
            .then(async (response: any) => {
              this.logger.debug(
                'processResponse::setFlag response, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port,
                response,
              );

              const setPointResult: any = await this.getSetPoint(
                decodedResponse.id,
                zone,
              );

              if (typeof setPointResult === 'number') {
                const setPoint: number = setPointResult;
                // Set all other panels to the same setPoint
                if (aircoApi) {
                  await aircoApi
                    .setTemperature(airconditioners[zone - 1], setPoint / 10)
                    .then(async () => {
                      this.logger.debug(
                        'processResponse::setFlag::setTemperature, connection: ' +
                          this.acpanel.ip +
                          ':' +
                          this.acpanel.port,
                        'For zone: ' + zone,
                        ' Set to setpoint: ' + setPoint,
                      );
                      resolve(
                        this.acpanel.ip +
                          ':' +
                          this.acpanel.port +
                          ' processResponse::setFlag::setTemperature: All panels have the same setpoint',
                      );
                    })
                    .catch((error) => {
                      this.logger.error(
                        'processResponse::setFlag::setTemperature Error, connection: ' +
                          this.acpanel.ip +
                          ':' +
                          this.acpanel.port,
                        error,
                      );
                    });
                } else {
                  console.error('AircoApi not found');
                }
                // await this.setOtherPanelsCorrect(
                //   decodedResponse.id,
                //   zone,
                //   setPoint,
                //   aircoApi,
                //   airconditioners
                // )
                //   .then(async () => {
                //     this.logger.debug(
                //       "All panels connected to IP: " +
                //       this.acpanel.ip +
                //       ":" +
                //       this.acpanel.port +
                //       " For zone: " + zone,
                //       " Have been set to setpoint: " + setPoint
                //     );
                //     resolve(this.acpanel.ip +
                //       ":" +
                //       this.acpanel.port +
                //       " processResponse::setOtherPanelsCorrect: All panels have the same setpoint"
                //     );
                //   })
                //   .catch(async (error) => {
                //     this.logger.error("processResponse::setFlag::setOtherPanelsCorrect Error, connection: " +
                //       this.acpanel.ip +
                //       ":" +
                //       this.acpanel.port,
                //       error
                //     );
                //   });
              } else {
                this.logger.error(
                  'processResponse::setFlag::setOtherPanelsCorrect Error, connection: ' +
                    this.acpanel.ip +
                    ':' +
                    this.acpanel.port,
                  'Unexpected type for setPointResult: ' +
                    typeof setPointResult,
                );
              }
            })
            .catch((error) => {
              reject(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' processResponse::setFlag Error: ' +
                  error,
              );
            });
        } else if (zn1FanspeedChc || (zn2FanspeedChc && airconditioners[1])) {
          zone = zn1FanspeedChc ? 1 : 2;

          await this.setFlag(decodedResponse.id, zone, 'fanSpeed', value)
            .then(async (response: any) => {
              this.logger.debug(
                'processResponse::setFlag response, connection: ' +
                  this.acpanel.ip +
                  ':' +
                  this.acpanel.port,
                response,
              );

              var fanmodeResult: number = Number(
                await this.getFanMode(decodedResponse.id, zone),
              );
              if (typeof fanmodeResult === 'number') {
                const fanmode: number = fanmodeResult;

                // Set all other panels to the same fanmode
                // for (const id of this.acpanel.ids) {
                //   this.setFanMode(Number(id), zone, fanmode);
                //   await bluePromise.delay(100);
                // }
                this.logger.debug(
                  'All panels connected to IP: ' +
                    this.acpanel.ip +
                    ':' +
                    this.acpanel.port +
                    ' For zone: ' +
                    zone +
                    ' Have been set to fanmode: ' +
                    fanmode,
                );

                // Update airconditioner (database)
                switch (this.acpanel.type) {
                  case 'polarbear-v2':
                  case 'polarbear-v3':
                    if (fanmode === 0) {
                      //is off

                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], 0)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    } else if (fanmode === 1) {
                      //is auto
                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], -1)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    } else {
                      // ToDo @Niek add resolve after setting the fanmode
                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], fanmode - 1)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    }
                    break;
                  case 'polarbear-v1':
                    if (fanmode === 0) {
                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], 0)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    } else if (fanmode === 1) {
                      //is auto
                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], -1)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    } else {
                      if (aircoApi) {
                        await aircoApi
                          .setFanSpeed(airconditioners[zone - 1], fanmode - 1)
                          .then(async () => {
                            resolve(
                              this.acpanel.ip +
                                ':' +
                                this.acpanel.port +
                                ' setFanMode',
                            );
                          });
                      } else {
                        console.error('AircoApi not found');
                      }
                    }
                    break;
                  default:
                    this.logger.error(
                      'processResponse::setFlag Error, connection: ' +
                        this.acpanel.ip +
                        ':' +
                        this.acpanel.port,
                      'Unknown type of polarbear: ' + this.acpanel.type,
                    );
                    break;
                }
              } else {
                this.logger.error(
                  'processResponse::setFlag Error, connection: ' +
                    this.acpanel.ip +
                    ':' +
                    this.acpanel.port,
                  'fanmode is not a number type: ' +
                    typeof fanmodeResult +
                    ' value: ' +
                    fanmodeResult,
                );
              }
            })
            .catch((error) => {
              reject(
                this.acpanel.ip +
                  ':' +
                  this.acpanel.port +
                  ' processResponse::setFlag Error: ' +
                  error,
              );
            });
        } else {
          resolve(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' processResponse:: No flags set',
          );
        }
      } catch (error) {
        reject(
          this.acpanel.ip +
            ':' +
            this.acpanel.port +
            ' Error in processResponse: ' +
            error,
        );
      }
    });
  }

  private async getFanMode(id: number, zone: number): Promise<void | any> {
    return await new Promise(async (resolve: any, reject: any) => {
      try {
        var availableRegisters: any = {
          1: inputs.FlagReg7,
          2: inputs.FlagReg8,
        };
        if (availableRegisters[zone] === undefined) {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' Invalid zone in get fanmode: ' +
              zone,
          );
        }

        // Send request to read holding registers
        const response = await this.readHoldingRegisters(
          id,
          availableRegisters[zone],
          1,
        );
        const value: any = response[0];

        // Extract lower 3 bits as fan mode
        const fanMode: any = value & 0x0007;

        if (typeof fanMode === 'number') {
          this.logger.debug(
            'getFanMode::, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            'Zn1 Room Fanmode: ' + fanMode,
          );
          resolve(fanMode);
        } else {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' getFanMode:: Invalid response value: ' +
              value,
          );
        }
      } catch (error: any) {
        this.logger.error(
          'getFanMode:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error.message,
        );
        reject(error);
      }
    });
  }

  private async setFanMode(
    id: number,
    zone: number,
    fanmode: number,
  ): Promise<void | any> {
    try {
      var availableRegisters: any = {
        1: registers.Zone1FanMode,
        2: registers.Zone2FanMode,
      };
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.writeRegister(id, availableRegisters[zone], fanmode);
    } catch (error) {
      this.logger.error(
        'setFanMode:: Error, connection: ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
        error,
      );
    }
  }

  private async getSetPoint(id: number, zone: number): Promise<void | any> {
    return await new Promise(async (resolve, reject) => {
      try {
        var availableRegisters: any = {
          1: inputs.FlagReg7,
          2: inputs.FlagReg8,
        };
        if (availableRegisters[zone] === undefined) {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' Invalid zone in get setpoint: ' +
              zone,
          );
        }

        const response = await this.readHoldingRegisters(
          Number(id),
          availableRegisters[zone],
          1,
        );
        const value: any = response[0];

        // Interpret low bits 7 to 8 as Zn1 Room SetPoint Temperature (Lo 7 + Lo 8)
        const zn1RoomSetPointTempLow: any = (value & 0x00c0) >> 6;

        // Interpret high bits 1 to 8 as Zn1 Room SetPoint Temperature (Hi 1 to Hi 8)
        const zn1RoomSetPointTempHigh: any = (value & 0xff00) >> 8;

        const zn1RoomSetPointTemp: any =
          (zn1RoomSetPointTempHigh << 2) | zn1RoomSetPointTempLow;

        if (zn1RoomSetPointTemp) {
          resolve(zn1RoomSetPointTemp);
        } else {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' getSetpoint:: Invalid value: ' +
              value,
          );
        }
      } catch (error: any) {
        this.logger.error(
          'getSetPoint:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error,
        );
        reject(error);
      }
    });
  }

  private async setSetPoint(
    id: number,
    zone: number,
    setPoint: number,
  ): Promise<void | any> {
    try {
      var availableRegisters: any = {
        1: registers.Zone1SetPoint,
        2: registers.Zone2SetPoint,
      };
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.writeRegister(id, availableRegisters[zone], setPoint * 10);
    } catch (error) {
      this.logger.error(
        'setSetPoint:: Error, connection: ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
        error,
      );
    }
  }

  private async setCurrentTemperature(
    id: number,
    zone: number,
    temperature: number,
    acpanelType: String,
  ): Promise<void | any> {
    try {
      var availableRegisters: any = {};
      if (acpanelType === 'polarbear-v3') {
        availableRegisters = {
          1: registers.NewZone1VirtualTemp,
          2: registers.NewZone2VirtualTemp,
        };
      } else {
        availableRegisters = {
          1: registers.Zone1VirtualTemp,
          2: registers.Zone2VirtualTemp,
        };
      }
      if (availableRegisters[zone] === undefined) {
        return;
      }

      await this.writeRegister(id, availableRegisters[zone], temperature * 10);
    } catch (error) {
      this.logger.error(
        'setCurrentTemperature:: Error, connection: ' +
          this.acpanel.ip +
          ':' +
          this.acpanel.port,
        error,
      );
    }
  }

  private async readHoldingRegisters(
    unitId: number,
    register: number,
    count: number = 1,
  ): Promise<number[]> {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' polarbear::readHoldingRegisters: Timed out, no response.',
          ),
        );
      }, 3000);

      this.client.setID(unitId);
      this.client
        .readHoldingRegisters(register, count)
        .then((data) => {
          clearTimeout(timeout);
          setTimeout(() => {
            resolve(data.data);
          }, 10);
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.logger.error(
            'readHoldingRegisters:: Error, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            error,
          );
          reject(error);
        });
    });
  }

  private async writeRegister(
    unitId: number,
    register: number,
    value: number,
  ): Promise<void> {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' polarbear::writeRegister: Timed out, no response.',
          ),
        );
      }, 3000);

      this.client.setID(unitId);
      this.client
        .writeRegister(register, value)
        .then(() => {
          clearTimeout(timeout);
          setTimeout(() => {
            resolve();
          }, 10);
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.logger.error(
            'writeRegister:: Error, connection: ' +
              this.acpanel.ip +
              ':' +
              this.acpanel.port,
            error,
          );
          reject(error);
        });
    });
  }

  private async send(connection: any, message: any): Promise<void | any> {
    return await new Promise((resolve, reject) => {
      try {
        var timeout: any = setTimeout(() => {
          reject(
            this.acpanel.ip +
              ':' +
              this.acpanel.port +
              ' polarbear::send: Timed out, no response.',
          );
        }, 3000);
        connection.once('data', async (data: Buffer) => {
          // this.logger.debug("send::RESP, connection: " +
          //   this.acpanel.ip +
          //   ":" +
          //   this.acpanel.port,
          //   data
          // );
          clearTimeout(timeout);
          await setTimeout(() => {
            resolve(data);
          }, 10);
        });
        // this.logger.debug("send::, connection: " +
        //   this.acpanel.ip +
        //   ":" +
        //   this.acpanel.port,
        //   message
        // );
        connection.write(message);
      } catch (error) {
        this.logger.error(
          'send:: Error, connection: ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
          error,
        );
        reject(error); // Add reject here to handle the error
      }
    });
  }

  closeConnection(): void {
    if (this.client && this.isConnected) {
      this.client.close(() => {
        this.isConnected = false;
        this.logger.info(
          'PolarbearController::closeConnection:: Connection closed ' +
            this.acpanel.ip +
            ':' +
            this.acpanel.port,
        );
      });
    }
  }
}

export default PolarbearController;
