import SyncEchoGuard from '../../src/Airco/services/SyncEchoGuard';
import type { SyncProperty, Zone } from '../../src/Airco/services/SyncTypes';

const DEVICE_ID = 'airco-device-1';
const UNIT_ID = 1;
const ZONE_ONE = 1 as Zone;

const SETPOINT_PROPERTY = 'setpoint' as SyncProperty;
const FAN_MODE_PROPERTY = 'fanMode' as SyncProperty;

const TTL_MS = 15000;
const CURRENT_TIME = 100000;
const EXPECTED_VALUE = 21.5;
const DIFFERENT_VALUE = 22.5;

describe('SyncEchoGuard', () => {
  let guard: SyncEchoGuard;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME);
    guard = new SyncEchoGuard(TTL_MS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should remember and consume expected value', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(true);
  });

  it('should return false when no value was remembered', () => {
    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should return false when remembered value is different', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      DIFFERENT_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should keep entry when value is different', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      DIFFERENT_VALUE,
    );

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(true);
  });

  it('should consume remembered value only once', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    const firstResult = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    const secondResult = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
  });

  it('should return false when entry is expired', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME + TTL_MS + 1);

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should delete expired entry after consume attempt', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME + TTL_MS + 1);

    guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME);

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should use different keys for different properties', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      FAN_MODE_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should cleanup expired entries', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME + TTL_MS + 1);

    guard.cleanup();

    jest.spyOn(Date, 'now').mockReturnValue(CURRENT_TIME);

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(false);
  });

  it('should not cleanup entries that are not expired', () => {
    guard.remember(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    guard.cleanup();

    const result = guard.consumeIfExpected(
      DEVICE_ID,
      UNIT_ID,
      ZONE_ONE,
      SETPOINT_PROPERTY,
      EXPECTED_VALUE,
    );

    expect(result).toBe(true);
  });
});
