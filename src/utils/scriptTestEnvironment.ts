/**
 * The environment a script sees in a test (ScriptTestModal's list), moved as
 * is from ScriptTestModal (Task 8.3, Rule X) so the Workspace's script test
 * shows the same list. Display only: the server builds the real one.
 */
export interface ScriptTestEnvContext {
  triggerType: 'auto-responder' | 'geofence' | 'timer';
  scriptPath: string;
  testMessage: string;
  mockNodeNum: string;
  mockShortName: string;
  mockLongName: string;
  mockNodeLat: string;
  mockNodeLon: string;
  eventType: 'entry' | 'exit' | 'while_inside';
  trigger?: string | string[];
  geofenceName?: string;
  geofenceId?: string;
  timerName?: string;
  timerId?: string;
}

export function scriptTestEnvironment({
  triggerType, scriptPath, testMessage, mockNodeNum, mockShortName, mockLongName, mockNodeLat, mockNodeLon, eventType,
  trigger, geofenceName, geofenceId, timerName, timerId,
}: ScriptTestEnvContext): Record<string, string> {
  const env: Record<string, string> = {
    IP: '(server IP)',
    PORT: '(server port)',
    VERSION: '(server version)',
  };

  if (triggerType === 'auto-responder') {
    env.MESSAGE = testMessage || '(test message)';
    env.FROM_NODE = mockNodeNum;
    env.FROM_SHORT_NAME = mockShortName;
    env.FROM_LONG_NAME = mockLongName;
    env.PACKET_ID = '99999';
    env.TRIGGER = Array.isArray(trigger) ? trigger.join(', ') : (trigger || '');
  } else if (triggerType === 'geofence') {
    env.GEOFENCE_NAME = geofenceName || 'Test Geofence';
    env.GEOFENCE_ID = geofenceId || 'test-id';
    env.GEOFENCE_EVENT = eventType;
    env.EVENT = eventType;
    env.NODE_LAT = mockNodeLat;
    env.NODE_LON = mockNodeLon;
    env.NODE_NUM = mockNodeNum;
    env.NODE_ID = mockNodeNum;
    env.SHORT_NAME = mockShortName;
    env.LONG_NAME = mockLongName;
    env.DISTANCE_TO_CENTER = '0.5';
  } else if (triggerType === 'timer') {
    env.TIMER_NAME = timerName || 'Test Timer';
    env.TIMER_ID = timerId || 'test-id';
    env.TIMER_SCRIPT = scriptPath;
  }

  return env;
}
