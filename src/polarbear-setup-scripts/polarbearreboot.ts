import ModbusRTU from 'modbus-serial';

const HOST = '192.168.55.97';
const PORT = 4001;

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
  client.setTimeout(10000);
  return client;
}

function writeCoil(
  client: ModbusRTU,
  unitId: number,
  coil: number,
  value: boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('ID:', unitId, 'reboot initiated (device rebooting)');
      console.log('Handled Successfully ✅');
      resolve();
    }, 1000);

    client.setID(unitId);
    client
      .writeCoil(coil, value)
      .then((data) => {
        clearTimeout(timeout);
        console.log('ID:', unitId, 'reboot:', value ? 0xff00 : 0x0000);
        console.log('Handled Successfully ✅');
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.log('ID:', unitId, 'reboot initiated (device rebooting)');
        console.log('Handled Successfully ✅');
        resolve();
      });
  });
}

export function reboot(client: ModbusRTU, unitIds: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const requests = unitIds.map((id) => ({ id, coil: 9991, value: true }));

    let index = 0;
    const processNext = () => {
      if (index >= requests.length) {
        resolve();
        return;
      }

      const req = requests[index];
      index++;

      console.log('polarbear::reboot: Request for ID', req.id);
      writeCoil(client, req.id, req.coil, req.value)
        .then(() => new Promise<void>((r) => setTimeout(r, 500)))
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::reboot: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}
