import ModbusRTU from 'modbus-serial';

const registers = Object.freeze({
  DeviceID: 9001,
});

export async function setID(
  client: ModbusRTU,
  currentUnitId: number,
  newUnitId: number,
): Promise<void> {
  try {
    console.log(
      `polarbear::setID: Request for current ID ${currentUnitId} to new ID ${newUnitId}`,
    );

    client.setID(currentUnitId);

    // Schrijf nieuwe ID (range: 1 to 32)
    if (newUnitId < 1 || newUnitId > 32) {
      throw new Error('Unit ID must be between 1 and 32');
    }

    await client.writeRegister(registers.DeviceID, newUnitId);
    console.log(`polarbear::setID: Write successful`);

    // Wacht even
    await new Promise((r) => setTimeout(r, 100));

    // Lees terug
    const result = await client.readHoldingRegisters(registers.DeviceID, 1);
    const value = result.data[0];

    console.log(`ID: ${currentUnitId} changed to: ${value}`);

    if (value === newUnitId) {
      console.log('Handled Successfully ✅');
    } else {
      console.log('Error: Unexpected Response ❌');
    }
  } catch (error) {
    console.error(`Error setting ID for unit ${currentUnitId}:`, error);
  }
  await new Promise((r) => setTimeout(r, 500));
}
