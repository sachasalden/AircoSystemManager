/** polarbear-constants.ts
 * Modbus register mappings and constants for Polarbear Zentium Palladium wall panel/thermostats.
 * From: Zentium_RTU_PointsList_r02.01.pdf
 */

// Flag bits for change detection
export const flagBits: any = Object.freeze({
  Zn1SetPoint: 0,
  Zn1FanSpeed: 1,
  Zn2SetPoint: 8,
  Zn2FanSpeed: 9,
});

// Coil registers
export const coils: any = Object.freeze({
  CentigradeOrFahrenheit: 11,
  DisplayFlameSymbol: 12,
  DisplaySnowflakeSymbol: 13,
  DisplayStatus: 31,
});

// Holding registers
export const registers: any = Object.freeze({
  Zone1SetPoint: 601,
  Zone1FanMode: 606,
  Zone1FanSpeed: 607,
  Zone2FanMode: 706,
  Zone2FanSpeed: 707,
  Zone2SetPoint: 701,
  Zone1VirtualTemp: 603,
  Zone2VirtualTemp: 703,
});

// Input registers
export const inputs: any = Object.freeze({
  DeviceUptime: 100,
  FlagReg0: 110,
  FlagReg7: 117,
  FlagReg8: 118,
  Zone1UserSetPoint: 691,
  Zone2UserSetPoint: 791,
});

// Modbus function codes
export const modbusfunctions: any = Object.freeze({
  ReadCoil: 0x01,
  ReadDiscrete: 0x02,
  ReadHolding: 0x03,
  ReadInput: 0x04,
  WriteCoil: 0x05,
  WriteRegister: 0x06,
  WriteCoils: 0x0f,
  WriteRegisters: 0x10,
});
