import ModbusRTU from 'modbus-serial';

const REGISTERS = {
  Zone1Setpoint: 601,
  Zone2Setpoint: 701,
} as const;

async function writeRegister(
  client: ModbusRTU,
  unitId: number,
  register: number,
  value: number,
): Promise<void> {
  console.log(
    `polarbear::writeRegister: Writing ${value} to register ${register} on unit ${unitId}`,
  );

  try {
    client.setID(unitId);
    await client.writeRegister(register, value);
    console.log('polarbear::writeRegister: Success');
  } catch (error) {
    console.error('polarbear::writeRegister: Error', error);
    throw error;
  }
}

export async function setSetpoint(
  client: ModbusRTU,
  unitIds: number[],
  zone: number,
  setpoint: number,
): Promise<void> {
  const register =
    zone === 1 ? REGISTERS.Zone1Setpoint : REGISTERS.Zone2Setpoint;
  const encodedValue = Math.round(setpoint * 10);

  console.log(
    `Setting setpoint for zone ${zone} to ${setpoint}°C (encoded: ${encodedValue})`,
  );

  for (const unitId of unitIds) {
    console.log(
      `polarbear::setSetpoint: Request for ID ${unitId}, Zone ${zone}`,
    );

    try {
      await writeRegister(client, unitId, register, encodedValue);

      // Verify door terug te lezen
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const actualSetpoint = result.data[0] / 10;

      console.log(`ID ${unitId}: Setpoint set to ${actualSetpoint}°C`);

      if (Math.abs(actualSetpoint - setpoint) > 0.1) {
        console.warn(
          `Warning: Expected ${setpoint}°C but got ${actualSetpoint}°C`,
        );
      }
    } catch (error) {
      console.error(`polarbear::setSetpoint: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
