import ModbusRTU from 'modbus-serial';

const HOST = '192.168.55.97';
const PORT = 4001;

const UNIT_IDS = [1, 2] as const;

const registers = Object.freeze({
  Zone1Setpoint: 601,
  Zone1FanSpeed: 607,
  Zone1FanMode: 606,
  Zone1VirtualTemp: 603,
  Zone2Setpoint: 701,
  Zone2FanSpeed: 707,
  Zone2FanMode: 706,
  Zone2VirtualTemp: 703,

});

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function connectTelnet(client: ModbusRTU) {
  return new Promise<void>((resolve, reject) => {
    (client as any).connectTelnet(HOST, { port: PORT }, (err: any) =>
      err ? reject(err) : resolve(),
    );
  });
}

async function readHoldingRegister(
  client: ModbusRTU,
  address: number,
  unitId: number,
) {
  client.setID(unitId);
  const res = await client.readHoldingRegisters(address, 1);
  return res.data[0];
}

async function writeSingleRegister(
  client: ModbusRTU,
  address: number,
  value: number,
  unitId: number,
) {
  client.setID(unitId);
  await client.writeRegister(address, value);
}

function tempToRaw(tempC: number) {
  return Math.round(tempC * 10);
}
function rawToTemp(raw: number) {
  return raw / 10;
}

async function writeToAllUnits(
  client: ModbusRTU,
  address: number,
  value: number,
  unitIds: readonly number[] = UNIT_IDS,
) {
  for (const id of unitIds) {
    await writeSingleRegister(client, address, value, id);
    await delay(120);
  }
}

async function readFromAllUnits(
  client: ModbusRTU,
  address: number,
  unitIds: readonly number[] = UNIT_IDS,
) {
  const out: Record<number, number> = {};
  for (const id of unitIds) {
    out[id] = await readHoldingRegister(client, address, id);
    await delay(80);
  }
  return out;
}

async function setFanSpeedSynced(client: ModbusRTU, speed: number) {
  if (!Number.isInteger(speed) || speed < 1 || speed > 6) {
    throw new Error(
      `Fan speed must be an integer between 1 and 6. Got: ${speed}`,
    );
  }
  await writeToAllUnits(client, registers.Zone1FanSpeed, speed);
  return await readFromAllUnits(client, registers.Zone1FanSpeed);
}

async function setSetpointSynced(client: ModbusRTU, tempC: number) {
  const raw = tempToRaw(tempC);
  await writeToAllUnits(client, registers.Zone1Setpoint, raw);
  return await readFromAllUnits(client, registers.Zone1Setpoint);
}

async function setFanModeSynced(client: ModbusRTU, mode: number) {
  if (!Number.isInteger(mode) || mode < 0 || mode > 1) {
    throw new Error(`Fan mode must be 1 for auto and 0 for off. Got: ${mode}`);
  }
  await writeToAllUnits(client, registers.Zone1FanMode, mode);
  return await readFromAllUnits(client, registers.Zone1FanMode);
}

async function setFanSpeeSyncedZone2(client: ModbusRTU, speed: number) {
  if (!Number.isInteger(speed) || speed < 1 || speed > 6) {
    throw new Error(
      `Fan speed must be an integer between 1 and 6. Got: ${speed}`,
    );
  }
  await writeToAllUnits(client, registers.Zone2FanSpeed, speed);
  return await readFromAllUnits(client, registers.Zone2FanSpeed);
}

async function setSetpointSyncedZone2(client: ModbusRTU, tempC: number) {
  const raw = tempToRaw(tempC);
  await writeToAllUnits(client, registers.Zone2Setpoint, raw);
  return await readFromAllUnits(client, registers.Zone2Setpoint);
}

async function setFanModeSyncedZone2(client: ModbusRTU, mode: number) {
  if (!Number.isInteger(mode) || mode < 0 || mode > 1) {
    throw new Error(`Fan mode must be 1 for auto and 0 for off. Got: ${mode}`);
  }
  await writeToAllUnits(client, registers.Zone2FanMode, mode);
  return await readFromAllUnits(client, registers.Zone2FanMode);
}

async function setVirtualTempSynced(client: ModbusRTU, tempC: number) {
  const raw = tempToRaw(tempC);
  await writeToAllUnits(client, registers.Zone1VirtualTemp, raw);
  return await readFromAllUnits(client, registers.Zone1VirtualTemp);
}

async function setVirtualTempSyncedZone2(client: ModbusRTU, tempC: number) {
  const raw = tempToRaw(tempC);
  await writeToAllUnits(client, registers.Zone2VirtualTemp, raw);
  return await readFromAllUnits(client, registers.Zone2VirtualTemp);
}



function logUnit(unitId: number, label: string, value: number, suffix = '') {
  console.log(`Unit ${unitId} | ${label.padEnd(18)} → ${value}${suffix}`);
}




async function main() {
  const client = new ModbusRTU();

  try {
    await connectTelnet(client);
    client.setTimeout(5000);
    console.log('✔ Connected via telnet to', `${HOST}:${PORT}`);

    // Zone 1
    console.log('\n=== ZONE 1 ===');
    const currentSetpoints = await readFromAllUnits(
      client,
      registers.Zone1Setpoint,
    );
    for (const id of UNIT_IDS) {
      logUnit(id, 'Setpoint', rawToTemp(currentSetpoints[id]), ' °C');
    }

    const currentFans = await readFromAllUnits(client, registers.Zone1FanSpeed);
    for (const id of UNIT_IDS) {
      logUnit(id, 'Fan speed', currentFans[id]);
    }

    const newTempC = 23.0;
    console.log(`→ Writing setpoint ${newTempC} °C to Unit 1 & 2`);

    const setpoints = await setSetpointSynced(client, newTempC);
    for (const id of UNIT_IDS) {
      logUnit(id, 'Setpoint', rawToTemp(setpoints[id]), ' °C');
    }

    const newFan = 6;
    console.log(`→ Writing fan speed ${newFan} to Unit 1 & 2`);

    const fans = await setFanSpeedSynced(client, newFan);
    for (const id of UNIT_IDS) {
      logUnit(id, 'Fan speed', fans[id]);
    }

    const currentFanModes = await readFromAllUnits(
      client,
      registers.Zone1FanMode,
    );
    for (const id of UNIT_IDS) {
      logUnit(id, 'Fan mode', currentFanModes[id]);
    }

    const newMode = 0;
    console.log(`→ Writing fan mode ${newMode} to Unit 1 & 2`);

    const modes = await setFanModeSynced(client, newMode);
    for (const id of UNIT_IDS) {
      logUnit(id, 'Fan mode', modes[id]);
    }

    // Zone 1 - Virtual Temperature
    console.log('\n=== ZONE 1 - Virtual Temp ===');
    const currentVirtualTemps = await readFromAllUnits(
      client,
      registers.Zone1VirtualTemp,
    );
    for (const id of UNIT_IDS) {
      logUnit(id, 'Virtual Temp', rawToTemp(currentVirtualTemps[id]), ' °C');
    }

    // Zone 2
    console.log('\n=== ZONE 2 ===');
    const currentSetpointsZ2 = await readFromAllUnits(
      client,
      registers.Zone2Setpoint,
    );
    for (const id of UNIT_IDS) {
      logUnit(id, 'Setpoint', rawToTemp(currentSetpointsZ2[id]), ' °C');
    }

    const newTempCZ2 = 22.0;
    console.log(`→ Writing setpoint ${newTempCZ2} °C to Unit 1 & 2`);

    const setpointsZ2 = await setSetpointSyncedZone2(client, newTempCZ2);
    for (const id of UNIT_IDS) {
      logUnit(id, 'Setpoint', rawToTemp(setpointsZ2[id]), ' °C');
    }

    // Zone 2 - Virtual Temperature
    console.log('\n=== ZONE 2 - Virtual Temp ===');
    const currentVirtualTempsZ2 = await readFromAllUnits(
      client,
      registers.Zone2VirtualTemp,
    );
    for (const id of UNIT_IDS) {
      logUnit(id, 'Virtual Temp', rawToTemp(currentVirtualTempsZ2[id]), ' °C');
    }
  } catch (err) {
    console.error('\n❌ ERROR:', err);
  } finally {
    client.close();
    console.log('Connection closed');
  }
}




main();
