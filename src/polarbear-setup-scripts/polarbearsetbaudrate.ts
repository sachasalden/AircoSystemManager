import ModbusRTU from 'modbus-serial';

const registers = Object.freeze({
  BaudRate: 9002,
});

function writeRegister(
  client: ModbusRTU,
  unitId: number,
  register: number,
  value: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('polarbear::writeRegister: Timed out, no response.');
    }, 3000);

    client.setID(unitId);
    client
      .writeRegister(register, value)
      .then(() => {
        clearTimeout(timeout);
        setTimeout(() => {
          console.log('ID:', unitId, 'Baudrate set to:', value);
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

export function setBaudrate(
  client: ModbusRTU,
  unitIds: number[],
  baudrate: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const baudrateMap: { [key: number]: number } = {
      9600: 2,
      19200: 3,
      57600: 4,
      115200: 5,
    };


    const encodedValue = baudrateMap[baudrate];
    if (encodedValue === undefined) {
      reject(
        new Error(
          `Unsupported baudrate: ${baudrate}. Supported: 9600, 19200, 57600`,
        ),
      );
      return;
    }

    console.log(`Setting baudrate to ${baudrate} (encoded: ${encodedValue})`);

    let index = 0;
    const processNext = () => {
      if (index >= unitIds.length) {
        resolve();
        return;
      }

      const unitId = unitIds[index];
      index++;

      console.log(`polarbear::setBaudrate: Request for ID ${unitId}`);
      writeRegister(client, unitId, registers.BaudRate, encodedValue)
        .then(() => new Promise<void>((r) => setTimeout(r, 500)))
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::setBaudrate: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}
