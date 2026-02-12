import ModbusRTU from 'modbus-serial';

const LIMIT_REGISTERS = {
  UpperLimit: 663,
  LowerLimit: 664,
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

const DEVICE_SCALING: Record<number, number> = {
  1: 1, // Device 1: geen schaling (30 = 30°C)
  2: 10, // Device 2: × 10 schaling (30 → 300 = 30.0°C)
};

export async function setUpperLimit(
  client: ModbusRTU,
  unitIds: number[],
  limit: number,
): Promise<void> {
  console.log(`Setting upper limit to ${limit}°C`);

  for (const unitId of unitIds) {
    const scaling = DEVICE_SCALING[unitId] ?? 10; // Default × 10
    const encodedValue = Math.round(limit * scaling);

    console.log(
      `polarbear::setUpperLimit: ID ${unitId}, ${limit}°C → ${encodedValue} (scaling: ${scaling})`,
    );

    try {
      await writeRegister(
        client,
        unitId,
        LIMIT_REGISTERS.UpperLimit,
        encodedValue,
      );

      client.setID(unitId);
      const result = await client.readHoldingRegisters(
        LIMIT_REGISTERS.UpperLimit,
        1,
      );
      const actualLimit = result.data[0] / scaling;

      console.log(` ID ${unitId}: Upper limit set to ${actualLimit}°C`);

      if (Math.abs(actualLimit - limit) > 0.1) {
        console.warn(
          ` Warning: Expected ${limit}°C but got ${actualLimit}°C`,
        );
      }
    } catch (error) {
      console.error(`polarbear::setUpperLimit: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function setLowerLimit(
  client: ModbusRTU,
  unitIds: number[],
  limit: number,
): Promise<void> {
  console.log(`Setting lower limit to ${limit}°C`);

  for (const unitId of unitIds) {
    const scaling = DEVICE_SCALING[unitId] ?? 10;
    const encodedValue = Math.round(limit * scaling);

    console.log(
      `polarbear::setLowerLimit: ID ${unitId}, ${limit}°C → ${encodedValue} (scaling: ${scaling})`,
    );

    try {
      await writeRegister(
        client,
        unitId,
        LIMIT_REGISTERS.LowerLimit,
        encodedValue,
      );

      client.setID(unitId);
      const result = await client.readHoldingRegisters(
        LIMIT_REGISTERS.LowerLimit,
        1,
      );
      const actualLimit = result.data[0] / scaling;

      console.log(` ID ${unitId}: Lower limit set to ${actualLimit}°C`);

      if (Math.abs(actualLimit - limit) > 0.1) {
        console.warn(
          ` Warning: Expected ${limit}°C but got ${actualLimit}°C`,
        );
      }
    } catch (error) {
      console.error(`polarbear::setLowerLimit: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}


