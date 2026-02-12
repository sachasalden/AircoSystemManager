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

export function getUpperLimit(
  client: ModbusRTU,
  unitIds: number[],
): Promise<void> {
  console.log('getUpperLimit');
  return new Promise((resolve, reject) => {
    const requests = unitIds.map((id) => ({ id, register: 663 }));

    let index = 0;
    const processNext = () => {
      if (index >= requests.length) {
        resolve();
        return;
      }

      const req = requests[index];
      index++;

      send(client, req.id, req.register, 1)
        .then((values) => {
          console.log('ID:', req.id, 'Upperlimit', values[0]);
          return new Promise<void>((r) => setTimeout(r, 500));
        })
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::read response: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}

export function getLowerLimit(
  client: ModbusRTU,
  unitIds: number[],
): Promise<void> {
  console.log('getLowerLimit');
  return new Promise((resolve, reject) => {
    const requests = unitIds.map((id) => ({ id, register: 664 }));

    let index = 0;
    const processNext = () => {
      if (index >= requests.length) {
        resolve();
        return;
      }

      const req = requests[index];
      index++;

      send(client, req.id, req.register, 1)
        .then((values) => {
          console.log('ID:', req.id, 'LowerLimit', values[0]);
          return new Promise<void>((r) => setTimeout(r, 500));
        })
        .then(() => processNext())
        .catch((error) => {
          console.error('polarbear::read response: Error', error);
          reject(error);
        });
    };

    processNext();
  });
}
