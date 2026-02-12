import ModbusRTU from 'modbus-serial';

const globalRegister = 50; // Global fan speed range (sets both zones)

function writeRegister(
  client: ModbusRTU,
  unitId: number,
  register: number,
  value: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('polarbear::writeRegister: Timed out, no response.'));
    }, 3000);

    client.setID(unitId);
    client
      .writeRegister(register, value)
      .then(() => {
        clearTimeout(timeout);
        setTimeout(() => {
          console.log('polarbear::setFanspeedRange: Response received');
          console.log('ID:', unitId, 'speed range set to:', value);
          console.log('Handled Successfully ✅');
          resolve();
        }, 10);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('polarbear::writeRegister: Error', error);
        reject(error);
      });
  });
}

export async function setFanspeedRange(
  client: ModbusRTU,
  unitIds: number[],
  range: 0 | 1 | 2 | 3 | 4 | 5 | 6,
): Promise<void> {
  console.log(`\n=== Setting Global Fan Speed Range ===`);

  for (const unitId of unitIds) {
    try {
      console.log(`polarbear::setFanspeedRange: Request for ID ${unitId}`);
      client.setID(unitId);
      await client.writeRegister(globalRegister, range);
      console.log(`✅ ID ${unitId} - Global fan speed range set to: ${range}`);
    } catch (error) {
      console.error(`❌ Error setting range for ID ${unitId}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}


export async function scanRegisters(
  client: ModbusRTU,
  unitId: number,
  startRegister: number,
  count: number,
): Promise<void> {
  console.log(
    `\n=== Scanning ${count} registers starting at ${startRegister} for unit ${unitId} ===`,
  );

  for (
    let register = startRegister;
    register < startRegister + count;
    register++
  ) {
    try {
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      console.log(`Register ${register}: ${result.data[0]}`);
    } catch (error: any) {
      // Skip registers that don't exist
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
