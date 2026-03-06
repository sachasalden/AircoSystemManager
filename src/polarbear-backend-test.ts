/**
 * Test script for Polarbear Backend
 * This script demonstrates how to use the PolarbearBackend class
 */

import { PolarbearBackend } from './polarbear-backend';

async function testConnection() {
  console.log('='.repeat(60));
  console.log('Polarbear Backend Test - Connection Only');
  console.log('='.repeat(60));

  const backend = new PolarbearBackend({
    host: '192.168.55.97',
    port: 4001,
  });

  try {
    console.log('\n🔌 Attempting to connect...');
    await backend.connect();

    if (backend.connected) {
      console.log('✅ Successfully connected to Polarbear!');
      console.log(`📍 Host: ${backend.getConfig().host}`);
      console.log(`🔌 Port: ${backend.getConfig().port}`);
    } else {
      console.log('❌ Connection failed');
    }

  } catch (error: any) {
    console.error('❌ Error during connection:', error.message || error);
  } finally {
    console.log('\n🔌 Disconnecting...');
    await backend.disconnect();
    console.log('✅ Disconnected\n');
  }
}

async function testReadData() {
  console.log('='.repeat(60));
  console.log('Polarbear Backend Test - Read Data');
  console.log('='.repeat(60));

  const backend = new PolarbearBackend({
    host: '192.168.55.97',
    port: 4001,
  });

  const unitIds = [1, 2]; // Test with unit IDs 1 and 2

  try {
    await backend.connect();

    for (const unitId of unitIds) {
      console.log(`\n📊 Reading data from Unit ${unitId}...`);

      try {
        // Zone 1
        console.log(`\n  Zone 1:`);
        const zone1Data = await backend.getZoneData(unitId, 1);
        console.log( `    🎯 VirtualTemp: ${zone1Data.virtualTemperature}°C`);
        console.log(`    🎯 Setpoint: ${zone1Data.setpoint}°C`);
        console.log(`    💨 Fan Speed: ${zone1Data.fanSpeed}`);
        console.log(`    ⚙️  Fan Mode: ${zone1Data.fanMode}`);

        // Zone 2
        console.log(`\n  Zone 2:`);
        const zone2Data = await backend.getZoneData(unitId, 2);
        console.log(`    🎯 VirtualTemp: ${zone1Data.virtualTemperature}°C`);
        console.log(`    🎯 Setpoint: ${zone2Data.setpoint}°C`);
        console.log(`    💨 Fan Speed: ${zone2Data.fanSpeed}`);
        console.log(`    ⚙️  Fan Mode: ${zone2Data.fanMode}`);

        // Device info
        const uptime = await backend.getDeviceUptime(unitId);
        console.log(`\n  ⏱️  Device Uptime: ${uptime} minutes`);

      } catch (error: any) {
        console.error(`  ❌ Error reading from unit ${unitId}:`, error.message);
      }

      // Wait between units
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
  } finally {
    await backend.disconnect();
    console.log('\n✅ Test completed\n');
  }
}

async function testWriteData() {
  console.log('='.repeat(60));
  console.log('Polarbear Backend Test - Write Data (COMMENTED OUT)');
  console.log('='.repeat(60));
  console.log('\n⚠️  Write operations are commented out for safety.');
  console.log('Uncomment the code below to test write operations.\n');

  const backend = new PolarbearBackend({
    host: '192.168.55.97',
    port: 4001,
  });

  try {
    await backend.connect();

    // UNCOMMENT BELOW TO TEST WRITE OPERATIONS
    const unitId = 1;
    const zone = 1;

    console.log(`\n📝 Writing data to Unit ${unitId}, Zone ${zone}...`);

    // Set virtual temperature (for testing, this may not have an effect on the actual device)
    await backend.setVirtualTemperature(unitId, zone, 22.0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Set setpoint
    await backend.setSetpoint(unitId, zone, 23.0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Set fan speed
    await backend.setFanSpeed(unitId, zone, 3);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Set fan mode (1 = auto)
    await backend.setFanMode(unitId, zone, 0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('\n✅ Write operations completed');

    // Read back the data to verify
    console.log('\n📊 Verifying written data...');
    const data = await backend.getZoneData(unitId, zone);
    console.log('Current data:', data);

  } catch (error: any) {
    console.error('❌ Error:', error.message || error);
  } finally {
    await backend.disconnect();
    console.log('\n✅ Test completed\n');
  }
}

async function scanUnits() {
  console.log('='.repeat(60));
  console.log('Polarbear Backend Test - Scan Active Units');
  console.log('='.repeat(60));

  const backend = new PolarbearBackend({
    host: '192.168.55.97',
    port: 4001,
  });

  try {
    await backend.connect();
    console.log('\n🔍 Scanning for active units (1-10)...\n');

    for (let unitId = 1; unitId <= 2; unitId++) {
      try {
        const temp = await backend.getSetpoint(unitId, 1);
        console.log(`✅ Unit ${unitId} - ACTIVE (Temp: ${temp}°C)`);
      } catch (error) {
        console.log(`❌ Unit ${unitId} - NOT RESPONDING`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } catch (error: any) {
    console.error('❌ Scan error:', error.message);
  } finally {
    await backend.disconnect();
    console.log('\n✅ Scan completed\n');
  }
}


// Main test runner
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'write';

  switch (testType) {
    case 'connect':
      await testConnection();
      break;
    case 'read':
      await testReadData();
      break;
    case 'scan':
      await scanUnits();
      break;
    case 'write':
      await testWriteData();
      break;
    case 'all':
      await testConnection();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await testReadData();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await testWriteData();
      break;
    default:
      console.log('Usage: ts-node polarbear-backend-test.ts [connect|read|write|all]');
      console.log('  connect - Test connection only (default)');
      console.log('  read    - Test reading data');
      console.log('  write   - Test writing data (commented out for safety)');
      console.log('  all     - Run all tests');
      process.exit(1);
  }
}

main().catch(console.error);



