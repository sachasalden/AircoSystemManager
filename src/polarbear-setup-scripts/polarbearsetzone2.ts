import ModbusRTU from 'modbus-serial';

async function writeCoil(
  client: ModbusRTU,
  unitId: number,
  address: number,
  value: boolean,
): Promise<void> {
  console.log(
    `polarbear::writeCoil: Writing ${value} to coil ${address} on unit ${unitId}`,
  );

  try {
    client.setID(unitId);
    await client.writeCoil(address, value);
    console.log('polarbear::writeCoil: Success');
  } catch (error) {
    console.error('polarbear::writeCoil: Error', error);
    throw error;
  }
}

export async function setZone2(
  client: ModbusRTU,
  unitIds: number[],
  enabled: boolean,
): Promise<void> {
  const coilAddress = 700;

  console.log(
    `Setting zone 2 to ${enabled ? 'enabled' : 'disabled'} (coil ${coilAddress})`,
  );

  for (const unitId of unitIds) {
    console.log(`polarbear::setZone2: Request for ID ${unitId}`);

    try {
      await writeCoil(client, unitId, coilAddress, enabled);

      // Verify door terug te lezen
      client.setID(unitId);
      const result = await client.readCoils(coilAddress, 1);
      const actualValue = result.data[0];

      console.log(
        ` ID ${unitId}: Zone 2 set to ${actualValue ? 'enabled' : 'disabled'}`,
      );
      if (actualValue !== enabled) {
        console.warn(`Warning: Expected ${enabled} but got ${actualValue}`);
      }
    } catch (error) {
      console.error(`polarbear::setZone2: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
