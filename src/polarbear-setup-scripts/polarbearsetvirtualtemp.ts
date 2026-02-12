import ModbusRTU from 'modbus-serial';

const registers = Object.freeze({
  Zone1VirtualTemp: 603,
  Zone2VirtualTemp: 703,
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
          console.log(
            `ID: ${unitId} Virtual temp set to: ${(value / 10).toFixed(1)}°C (raw: ${value})`,
          );
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

export function setVirtualTemp(
  client: ModbusRTU,
  unitIds: number[],
  zone: number,
  temperature: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate zone
    if (zone !== 1 && zone !== 2) {
      reject(new Error(`Invalid zone: ${zone}. Must be 1 or 2.`));
      return;
    }

    // Validate temperature range (assuming 5°C to 35°C)
    if (temperature < 5 || temperature > 35) {
      reject(
        new Error(
          `Invalid temperature: ${temperature}°C. Must be between 5-35°C.`,
        ),
      );
      return;
    }

    const register =
      zone === 1 ? registers.Zone1VirtualTemp : registers.Zone2VirtualTemp;

    // Temperature is sent as value * 10 (e.g., 24.5°C → 245)
    const encodedValue = Math.round(temperature * 10);

    console.log(
      `Setting virtual temp for zone ${zone} to ${temperature}°C (encoded: ${encodedValue})`,
    );

    let index = 0;
    const processNext = () => {
      if (index >= unitIds.length) {
        resolve();
        return;
      }

      const unitId = unitIds[index];
      index++;

      console.log(
        `polarbear::setVirtualTemp: Request for ID ${unitId}, Zone ${zone}`,
      );
      writeRegister(client, unitId, register, encodedValue)
        .then(() => new Promise<void>((r) => setTimeout(r, 500)))
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::setVirtualTemp: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}
