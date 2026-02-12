import ModbusRTU from 'modbus-serial';

const registers = Object.freeze({
  Zone1FanMode: 606,
  Zone2FanMode: 706,
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
      .then((data) => {
        clearTimeout(timeout);
        setTimeout(() => {
          console.log('polarbear::setFanmode: Response received');
          console.log('ID:', unitId, 'fanmode:', value);
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

export function setFanmode(
  client: ModbusRTU,
  unitIds: number[],
  zone: number,
  fanmode: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const register =
      zone === 1 ? registers.Zone1FanMode : registers.Zone2FanMode;

    let index = 0;
    const processNext = () => {
      if (index >= unitIds.length) {
        resolve();
        return;
      }

      const unitId = unitIds[index];
      index++;

      console.log(`polarbear::setFanmode: Request for ID ${unitId}`);
      writeRegister(client, unitId, register, fanmode)
        .then(() => new Promise<void>((r) => setTimeout(r, 500)))
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::setFanmode: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}
