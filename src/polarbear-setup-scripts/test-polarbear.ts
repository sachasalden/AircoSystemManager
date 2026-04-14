import {
  createModbusClient,
  getSetpoint,
  getFanspeed,
  getFanmode,
  getActualTemp,
} from './polarbeargetdata';
import { getFlags } from './polarbeargetflags';
import { getUpperLimit, getLowerLimit } from './polarbeargetlimits';
import { reboot } from './polarbearreboot';
import { setBaudrate} from './polarbearsetbaudrate.ts';
import { setFanmode} from './polarbearsetfanmode.ts';
import { setFanspeed} from './polarbearsetfanspeed.ts';
import { setFanspeedRange, scanRegisters } from './polarbearsetfanspeedrange.ts';
import { setFlags } from './polarbearsetflags.ts';
import { setID} from './polarbearsetid.ts';
import { setVirtualTemp} from './polarbearsetvirtualtemp.ts';
import { setSetpoint } from './polarbearsetsetpoint.ts';
import { setZone2 } from './polarbearsetzone2.ts';
import { setLowerLimit, setUpperLimit } from './polarbearsetlimits.ts';
import {
  getTempSensorSource,
  setTempSensor,
  TempSensorSource,
} from './polarbearsettempsensor.ts';
import { setTowelHeater } from './setpolarbeartowelheater.ts';


async function main() {
  const unitIds = [1, 2];
  let client = await createModbusClient();

  console.log('Connected to polarbear');

  // // Zone 1 uses virtual register
  // await setTempSensor(client, unitIds, 2, TempSensorSource.VirtualRegister);
  // await new Promise((r) => setTimeout(r, 500));
  // //

  // await getActualTemp(client, unitIds, 1);
  // await new Promise((r) => setTimeout(r, 500));

  // Enable beide zones
  // await setTowelHeater(client, unitIds, 1, false);
  // await setTowelHeater(client, unitIds, 2, false);

  // await setUpperLimit(client, unitIds, 30); // Upper limit: 30
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await setLowerLimit(client, unitIds, 15); // Lower limit: 15
  // await new Promise((r) => setTimeout(r, 500));

  await setVirtualTemp(client, [1], 1, 24.0); // Zone 2, 24.0°C
  await new Promise((r) => setTimeout(r, 500));

  // Test setSetpoint op beide devices
  // await setSetpoint(client, unitIds, 1, 23.5); // Zone 1, 23.5°C
  // await new Promise((r) => setTimeout(r, 500));

  // await setZone2(client, unitIds, true); // Enable zone 2
  // await new Promise((r) => setTimeout(r, 500));

  // await scanRegisters(client, 1, 600, 100);

  // await setFanspeedRange(client, unitIds, 6); // zone 1, range 0-6
  // await new Promise((r) => setTimeout(r, 500));

  // await setID(client, 1, 1); // unit 1 gets ID 1
  // await new Promise((r) => setTimeout(r, 500));
  //
  //
  //
  // await setFlags(client, unitIds);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getFanmode(client, [1], 1);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await setFanmode(client, [1], 1, 1); // voor auto 1 voor off 0
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await setFanmode(client, [1], 1, 1); // voor auto 1 voor off 0
  // await new Promise((r) => setTimeout(r, 500));
  // //
  // await getFanmode(client, [1], 1);
  // await new Promise((r) => setTimeout(r, 500));

  // await setFanspeed(client, unitIds, 1, 1);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getFanspeed(client, unitIds, 1);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getSetpoint(client, unitIds, 1);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getFlags(client, unitIds);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getUpperLimit(client, unitIds);
  // await new Promise((r) => setTimeout(r, 500));
  //
  // await getLowerLimit(client, unitIds);
  // await new Promise((r) => setTimeout(r, 500));

  // await setBaudrate(client, unitIds, 115200);
  // await new Promise((r) => setTimeout(r, 500));

  // await reboot(client, unitIds);
  //
  // client.close();
  // console.log('Connection closed, waiting for units to reboot...');
  //
  // // Wait for units to reboot and come back online
  // await new Promise((r) => setTimeout(r, 30000));
  //
  // console.log('Reconnecting to polarbear...');
  // client = await createModbusClient();
  // console.log('Reconnected');
  //
  // await getActualTemp(client, unitIds, 1);
  // await new Promise((r) => setTimeout(r, 500));

  // client.close();
  // console.log('Connection closed');
}

main().catch(console.error);
