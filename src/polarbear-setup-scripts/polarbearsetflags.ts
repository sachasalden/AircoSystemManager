import ModbusRTU from 'modbus-serial';

const registers = Object.freeze({
  FlagsRegister: 110,
});

const flagValues = Object.freeze({
  SetFlags: 0x8001,
});

export async function setFlags(
  client: ModbusRTU,
  unitIds: number[],
): Promise<void> {
  for (const unitId of unitIds) {
    try {
      console.log(`polarbear::setFlags: Request for ID ${unitId}`);

      await writeAndReadRegister(
        client,
        unitId,
        registers.FlagsRegister,
        flagValues.SetFlags,
      );

      console.log(`polarbear::setFlags: Response received`);
      // Lees de waarde terug om te verifiëren
      const value = await readRegister(client, unitId, registers.FlagsRegister);
      console.log(`ID: ${unitId} Flags: ${value}`);
      console.log('Handled Successfully ✅');
    } catch (error) {
      console.error(`Error setting flags for ID ${unitId}:`, error);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function writeAndReadRegister(
  client: ModbusRTU,
  unitId: number,
  register: number,
  value: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('polarbear::setFlags: Timed out, no response.');
    }, 3000);

    client.setID(unitId);
    client
      .writeRegister(register, value)
      .then(() => {
        clearTimeout(timeout);
        setTimeout(() => {
          resolve();
        }, 10);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('polarbear::setFlags: Error', error);
        reject(error);
      });
  });
}

function readRegister(
  client: ModbusRTU,
  unitId: number,
  register: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('polarbear::setFlags: Read timed out.');
    }, 3000);

    client.setID(unitId);
    client
      .readHoldingRegisters(register, 1)
      .then((data) => {
        clearTimeout(timeout);
        setTimeout(() => {
          resolve(data.data[0]);
        }, 10);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('polarbear::setFlags: Read error', error);
        reject(error);
      });
  });
}
