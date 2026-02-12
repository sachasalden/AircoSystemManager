import ModbusRTU from 'modbus-serial';

const TEMP_SENSOR_REGISTERS = {
  Zone1: 640,
  Zone2: 740,
} as const;

export enum TempSensorSource {
  WallSensor = 2,
  FloorSensor = 6,
  WallAndReturnAir = 7,
  ReturnAir = 8,
  VirtualRegister = 9,
}

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

export async function setTempSensor(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2,
  sensorSource: TempSensorSource,
): Promise<void> {
  const register =
    zone === 1 ? TEMP_SENSOR_REGISTERS.Zone1 : TEMP_SENSOR_REGISTERS.Zone2;
  const sensorName = TempSensorSource[sensorSource];

  console.log(
    `Setting zone ${zone} temperature sensor to ${sensorName} (${sensorSource})`,
  );

  for (const unitId of unitIds) {
    console.log(`polarbear::setTempSensor: Request for ID ${unitId}`);

    try {
      await writeRegister(client, unitId, register, sensorSource);

      // Verify
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const actualValue = result.data[0];
      const actualName = TempSensorSource[actualValue] || 'Unknown';

      console.log(
        `ID ${unitId}: Zone ${zone} temp sensor set to ${actualName} (${actualValue})`,
      );

      if (actualValue !== sensorSource) {
        console.warn(
          `Warning: Expected ${sensorSource} but got ${actualValue}`,
        );
      }
    } catch (error) {
      console.error(`polarbear::setTempSensor: Error for ID ${unitId}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
