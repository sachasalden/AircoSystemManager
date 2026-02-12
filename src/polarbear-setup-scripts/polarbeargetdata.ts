import ModbusRTU from 'modbus-serial';

const HOST = '192.168.55.97';
const PORT = 4001;

export const registers = Object.freeze({
  Zone1Setpoint: 601,
  Zone1FanMode: 606,
  Zone1FanSpeed: 607,
  Zone2FanMode: 706,
  Zone2FanSpeed: 707,
  Zone2Setpoint: 701,
  Zone1VirtualTemp: 603,
  Zone2VirtualTemp: 703,
});

function connectTelnet(client: ModbusRTU) {
  return new Promise<void>((resolve, reject) => {
    (client as any).connectTelnet(HOST, { port: PORT }, (err: any) =>
      err ? reject(err) : resolve(),
    );
  });
}

export async function createModbusClient() {
  const client = new ModbusRTU();
  await connectTelnet(client);
  client.setTimeout(10000); // 10 seconden ipv 5
  return client;
}

function send(
  client: ModbusRTU,
  unitId: number,
  register: number,
  count: number = 1,
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject('polarbear::send: Timed out, no response.');
    }, 3000);

    client.setID(unitId);
    client
      .readHoldingRegisters(register, count)
      .then((data) => {
        clearTimeout(timeout);
        // Wacht 10ms zoals in originele code
        setTimeout(() => {
          resolve(data.data);
        }, 10);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error('polarbear::send: Error', error);
        reject(error);
      });
  });
}



export async function getActualTemp(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2 = 1,
): Promise<void> {
  const register =
    zone === 1 ? registers.Zone1VirtualTemp : registers.Zone2VirtualTemp;

  console.log(`\n=== Reading Actual Temperature (Zone ${zone}) ===`);

  for (const unitId of unitIds) {
    try {
      console.log(`polarbear::getActualTemp: Request for ID ${unitId}`);

      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const temperature = result.data[0] / 10;

      console.log(`✅ ID ${unitId} - ActualTemp: ${temperature}°C`);
    } catch (error) {
      console.error(`❌ Error reading temp for ID ${unitId}:`, error);
    }

    // Wacht tussen requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}


export async function getSetpoint(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2 = 1,
): Promise<void> {
  const register =
    zone === 1 ? registers.Zone1Setpoint : registers.Zone2Setpoint;

  console.log(`\n=== Reading Setpoint (Zone ${zone}) ===`);

  for (const unitId of unitIds) {
    try {
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const setpoint = result.data[0] / 10;

      console.log(`✅ ID ${unitId} - Setpoint: ${setpoint}°C`);
    } catch (error) {
      console.error(`❌ Error reading setpoint for ID ${unitId}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function getFanspeed(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2 = 1,
): Promise<void> {
  const register =
    zone === 1 ? registers.Zone1FanSpeed : registers.Zone2FanSpeed;

  console.log(`\n=== Reading Fanspeed (Zone ${zone}) ===`);

  for (const unitId of unitIds) {
    try {
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const fanspeed = result.data[0];

      console.log(`✅ ID ${unitId} - Fanspeed: ${fanspeed}`);
    } catch (error) {
      console.error(`❌ Error reading fanspeed for ID ${unitId}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function getFanmode(
  client: ModbusRTU,
  unitIds: number[],
  zone: 1 | 2 = 1,
): Promise<void> {
  const register = zone === 1 ? registers.Zone1FanMode : registers.Zone2FanMode;

  console.log(`\n=== Reading Fanmode (Zone ${zone}) ===`);

  for (const unitId of unitIds) {
    try {
      client.setID(unitId);
      const result = await client.readHoldingRegisters(register, 1);
      const fanmode = result.data[0];

      console.log(`✅ ID ${unitId} - Fanmode: ${fanmode}`);
    } catch (error) {
      console.error(`❌ Error reading fanmode for ID ${unitId}:`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}


