import {
  SYNC_PROPERTIES,
  PANEL_TO_AIRCO_PROPERTIES,
  AIRCO_TO_PANEL_PROPERTIES,
  createStateKey,
  sameNumericValue,
  createMessageId,
} from '../src/Airco/services/SyncTypes';

describe('SyncTypes runtime helpers', () => {
  const DEVICE_ID = 'device-1';
  const UNIT_ID = 7;
  const ZONE = 1 as const;
  const PROPERTY = 'setpoint' as const;

  const logResult = (label: string, actual: unknown, expected?: unknown) => {
    console.log(`\n[TEST] ${label}`);
    console.log('actual  :', actual);
    if (expected !== undefined) {
      console.log('expected:', expected);
    }
  };

  it('should contain all sync properties', () => {
    const expected = ['setpoint', 'virtualTemperature', 'fanSpeed', 'fanMode'];

    logResult('SYNC_PROPERTIES', SYNC_PROPERTIES, expected);

    expect(SYNC_PROPERTIES).toEqual(expected);
  });

  it('should contain panel to airco properties', () => {
    const expected = ['setpoint', 'fanSpeed', 'fanMode'];

    logResult('PANEL_TO_AIRCO_PROPERTIES', PANEL_TO_AIRCO_PROPERTIES, expected);

    expect(PANEL_TO_AIRCO_PROPERTIES).toEqual(expected);
  });

  it('should contain airco to panel properties', () => {
    const expected = ['setpoint', 'virtualTemperature', 'fanSpeed', 'fanMode'];

    logResult('AIRCO_TO_PANEL_PROPERTIES', AIRCO_TO_PANEL_PROPERTIES, expected);

    expect(AIRCO_TO_PANEL_PROPERTIES).toEqual(expected);
  });

  it('should create a state key', () => {
    const expected = 'device-1:7:1:setpoint';

    const result = createStateKey(DEVICE_ID, UNIT_ID, ZONE, PROPERTY);

    logResult('createStateKey', result, expected);

    expect(result).toBe(expected);
  });

  it('should return true when numbers are equal', () => {
    const left = 21.5;
    const right = 21.5;

    const result = sameNumericValue(left, right);

    logResult('sameNumericValue equal numbers', result, true);

    expect(result).toBe(true);
  });

  it('should return true when numbers are within default tolerance', () => {
    const left = 21.5;
    const right = 21.54;

    const result = sameNumericValue(left, right);

    logResult('sameNumericValue default tolerance', result, true);

    expect(result).toBe(true);
  });

  it('should return false when numbers are outside default tolerance', () => {
    const left = 21.5;
    const right = 21.56;

    const result = sameNumericValue(left, right);

    logResult('sameNumericValue outside default tolerance', result, false);

    expect(result).toBe(false);
  });

  it('should use a custom tolerance', () => {
    const left = 21.5;
    const right = 21.2;
    const tolerance = 0.4;

    const result = sameNumericValue(left, right, tolerance);

    logResult('sameNumericValue custom tolerance', result, true);

    expect(result).toBe(true);
  });

  it('should create a message id as a non-empty string', () => {
    const result = createMessageId();

    logResult('createMessageId', result);

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should create unique message ids', () => {
    const first = createMessageId();
    const second = createMessageId();

    logResult('createMessageId unique', { first, second });

    expect(first).not.toBe(second);
  });

  it('should create message id in expected format', () => {
    const result = createMessageId();

    logResult('createMessageId format', result);

    expect(result).toMatch(/^\d+-[a-z0-9]+$/);
  });
});
