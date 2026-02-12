import ModbusRTU from 'modbus-serial';

const TOWEL_HEATER_COILS = {
  Zone1FanMode: 606,
  Zone2FanMode: 706,
} as const;

async function writeCoil(
  client: ModbusRTU,
  unitId: number,
  coil: number,
  value: boolean,
): Promise<void> {
  console.log(
    `polarbear::writeCoil: Writing ${value} to coil ${coil} on unit ${unitId}`,
  );

  try {
    client.setID(unitId);
    await client.writeCoil(coil, value);
    console.log('polarbear::writeCoil: Success');
  } catch (error) {
    console.error('polarbear::writeCoil: Error', error);
    throw error;
  }
}

export async function setTowelHeater(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2,
  enabled: boolean,
): Promise<void> {
  const coil = zone === 1 ? TOWEL_HEATER_COILS.Zone1FanMode : TOWEL_HEATER_COILS.Zone2FanMode;

  console.log(
    `Setting towel heater Zone ${zone} to ${enabled ? 'ENABLED' : 'DISABLED'}`,
  );

  for (const unitId of unitIds) {
    console.log(`polarbear::setTowelHeater: Request for ID ${unitId}`);

    try {
      await writeCoil(client, unitId, coil, enabled);

      // Verify
      client.setID(unitId);
      const result = await client.readCoils(coil, 1);
      const actualValue = result.data[0];

      console.log(
        `✅ ID ${unitId}: Zone ${zone} towel heater = ${actualValue ? 'ENABLED' : 'DISABLED'}`,
      );
      if (actualValue !== enabled) {
        console.warn(`⚠️ Warning: Expected ${enabled} but got ${actualValue}`);
      }
    } catch (error) {
      console.error(`polarbear::setTowelHeater: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
