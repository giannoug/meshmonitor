/**
 * @vitest-environment jsdom
 *
 * Device configuration saves, extracted from ConfigurationTab (#6365, Rule X).
 * Each save must send exactly what Classic's handler sent: the same api call,
 * body and sourceId. It returns true when today's success path ran and false
 * when today's error (or held-by-validation) path ran.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  showToast: vi.fn(),
  invalidateQueries: vi.fn(),
  api: {
    getCurrentConfig: vi.fn(),
    getSecurityKeys: vi.fn(),
    setDeviceConfig: vi.fn(),
    setNodeOwner: vi.fn(),
    setLoRaConfig: vi.fn(),
    setPositionConfig: vi.fn(),
    setMQTTConfig: vi.fn(),
    setNeighborInfoConfig: vi.fn(),
    setNetworkConfig: vi.fn(),
    setPowerConfig: vi.fn(),
    setDisplayConfig: vi.fn(),
    setTelemetryConfig: vi.fn(),
    setModuleConfig: vi.fn(),
    setSecurityConfig: vi.fn(),
    rebootDevice: vi.fn(),
    purgeNodeDb: vi.fn(),
    refreshNodes: vi.fn(),
  },
}));

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('../../test/mockI18n');
  return createReactI18nextMock();
});
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }) }));
vi.mock('../../components/ToastContainer', () => ({ useToast: () => ({ showToast: h.showToast }) }));
vi.mock('../../services/api', () => ({ default: h.api }));

import { useDeviceConfigState } from './useDeviceConfigState';
import { useDeviceConfigSaves, type ConfigSaveSection } from './useDeviceConfigSaves';

const SRC = 'src-1';
const onRebootExpected = vi.fn();

function useBoth(opts: { onRebootDevice?: () => Promise<boolean> } = {}) {
  const state = useDeviceConfigState(SRC, 0);
  const saves = useDeviceConfigSaves(state, { onRebootExpected, ...opts });
  return { state, saves };
}

async function renderLoaded(config: Record<string, unknown> = {}, opts: { onRebootDevice?: () => Promise<boolean> } = {}) {
  h.api.getCurrentConfig.mockResolvedValue({
    localNodeInfo: { longName: 'Node', shortName: 'N', firmwareVersion: '2.7.9.70724be' },
    ...config,
  });
  const view = renderHook(() => useBoth(opts));
  await waitFor(() => expect(view.result.current.state.loading).toBe(false));
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.api.getSecurityKeys.mockResolvedValue({});
  for (const [name, fn] of Object.entries(h.api)) {
    if (name !== 'getCurrentConfig' && name !== 'getSecurityKeys') fn.mockResolvedValue({ success: true });
  }
});

afterEach(() => {
  vi.useRealTimers();
});

// Today's api call and body for each save, read from ConfigurationTab's
// handleSave*Config with the state a config of `{}` (plus the owner names)
// loads.
const SAVE_CASES: Array<[ConfigSaveSection, keyof typeof h.api, unknown[]]> = [
  ['device', 'setDeviceConfig', [{
    role: 0, nodeInfoBroadcastSecs: 3600, tzdef: '', rebroadcastMode: 0, doubleTapAsButtonPress: false,
    disableTripleClick: false, ledHeartbeatDisabled: false, buzzerMode: 0, buttonGpio: 0, buzzerGpio: 0,
  }, SRC]],
  ['owner', 'setNodeOwner', ['Node', 'N', false, false, SRC]],
  ['lora', 'setLoRaConfig', [{
    usePreset: false, modemPreset: 0, bandwidth: 250, spreadFactor: 11, codingRate: 8, frequencyOffset: 0,
    overrideFrequency: 0, region: 0, hopLimit: 3, txPower: 0, channelNum: 0, femLnaMode: 0,
    sx126xRxBoostedGain: false, ignoreMqtt: false, configOkToMqtt: false, txEnabled: true,
    overrideDutyCycle: false, paFanDisabled: false,
  }, SRC]],
  ['position', 'setPositionConfig', [{
    positionBroadcastSecs: 900, positionBroadcastSmartEnabled: false, fixedPosition: false,
    latitude: undefined, longitude: undefined, altitude: undefined, gpsUpdateInterval: 0, gpsMode: 0,
    broadcastSmartMinimumDistance: 0, broadcastSmartMinimumIntervalSecs: 0, positionFlags: 0,
    rxGpio: 0, txGpio: 0, gpsEnGpio: 0,
  }, SRC]],
  ['mqtt', 'setMQTTConfig', [{
    enabled: false, address: '', username: '', password: '', encryptionEnabled: false, jsonEnabled: false,
    tlsEnabled: false, root: '', proxyToClientEnabled: false, mapReportingEnabled: false,
    mapReportSettings: { publishIntervalSecs: 0, positionPrecision: 0, shouldReportLocation: false },
  }, SRC]],
  ['neighborinfo', 'setNeighborInfoConfig', [{ enabled: false, updateInterval: 14400, transmitOverLora: false }, SRC]],
  ['network', 'setNetworkConfig', [{
    wifiEnabled: false, wifiSsid: '', wifiPsk: '', ntpServer: '', rsyslogServer: '', addressMode: 0,
    enabledProtocols: 0, ipv4Config: undefined,
  }, SRC]],
  ['power', 'setPowerConfig', [{
    isPowerSaving: false, onBatteryShutdownAfterSecs: 0, adcMultiplierOverride: 0, waitBluetoothSecs: 60,
    sdsSecs: 31536000, lsSecs: 300, minWakeSecs: 10, deviceBatteryInaAddress: 0,
  }, SRC]],
  ['display', 'setDisplayConfig', [{
    screenOnSecs: 60, autoScreenCarouselSecs: 0, flipScreen: false, units: 0, oled: 0, displaymode: 0,
    headingBold: false, wakeOnTapOrMotion: false, compassOrientation: 0,
  }, SRC]],
  ['telemetry', 'setTelemetryConfig', [{
    deviceUpdateInterval: 900, deviceTelemetryEnabled: false, environmentUpdateInterval: 900,
    environmentMeasurementEnabled: false, environmentScreenEnabled: false, environmentDisplayFahrenheit: false,
    airQualityEnabled: false, airQualityInterval: 900, powerMeasurementEnabled: false, powerUpdateInterval: 900,
    powerScreenEnabled: false, healthMeasurementEnabled: false, healthUpdateInterval: 900, healthScreenEnabled: false,
  }, SRC]],
  ['extnotif', 'setModuleConfig', ['extnotif', {
    enabled: false, outputMs: 1000, output: 0, active: false, alertMessage: false, alertMessageVibra: false,
    alertMessageBuzzer: false, alertBell: false, alertBellVibra: false, alertBellBuzzer: false, usePwm: false,
    nagTimeout: 0, useI2sAsBuzzer: false, outputVibra: 0, outputBuzzer: 0,
  }, SRC]],
  ['storeforward', 'setModuleConfig', ['storeforward', {
    enabled: false, heartbeat: false, records: 0, historyReturnMax: 0, historyReturnWindow: 0, isServer: false,
  }, SRC]],
  ['rangetest', 'setModuleConfig', ['rangetest', { enabled: false, sender: 0, save: false }, SRC]],
  ['cannedmsg', 'setModuleConfig', ['cannedmsg', {
    enabled: false, rotary1Enabled: false, inputbrokerPinA: 0, inputbrokerPinB: 0, inputbrokerPinPress: 0,
    inputbrokerEventCw: 0, inputbrokerEventCcw: 0, inputbrokerEventPress: 0, updown1Enabled: false,
    sendBell: false, allowInputSource: 0,
  }, SRC]],
  ['audio', 'setModuleConfig', ['audio', {
    codec2Enabled: false, pttPin: 0, bitrate: 0, i2sWs: 0, i2sSd: 0, i2sDin: 0, i2sSck: 0,
  }, SRC]],
  ['remotehardware', 'setModuleConfig', ['remotehardware', { enabled: false, allowUndefinedPinAccess: false }, SRC]],
  ['detectionsensor', 'setModuleConfig', ['detectionsensor', {
    enabled: false, minimumBroadcastSecs: 0, stateBroadcastSecs: 0, sendBell: false, name: '', monitorPin: 0,
    detectionTriggerType: 0, usePullup: false,
  }, SRC]],
  ['paxcounter', 'setModuleConfig', ['paxcounter', {
    enabled: false, paxcounterUpdateInterval: 0, wifiThreshold: -80, bleThreshold: -80,
  }, SRC]],
  ['statusmessage', 'setModuleConfig', ['statusmessage', { nodeStatus: '' }, SRC]],
  ['tak', 'setModuleConfig', ['tak', { team: 0, role: 0 }, SRC]],
  ['trafficmanagement', 'setModuleConfig', ['trafficmanagement', {
    positionMinIntervalSecs: 0, nodeinfoDirectResponseMaxHops: 0, rateLimitWindowSecs: 0,
    rateLimitMaxPackets: 0, unknownPacketThreshold: 0,
  }, SRC]],
  ['meshbeacon', 'setModuleConfig', ['meshbeacon', {
    flags: 0, broadcastMessage: '', broadcastOfferRegion: 0, broadcastIntervalSecs: 3600, broadcastTargets: [],
  }, SRC]],
  ['serial', 'setModuleConfig', ['serial', {
    enabled: false, echo: false, rxd: 0, txd: 0, baud: 0, timeout: 0, mode: 0, overrideConsoleSerialPort: false,
  }, SRC]],
  ['ambientlighting', 'setModuleConfig', ['ambientlighting', { ledState: false, current: 10, red: 0, green: 0, blue: 0 }, SRC]],
  ['security', 'setSecurityConfig', [{
    adminKeys: [], isManaged: false, serialEnabled: false, debugLogApiEnabled: false, adminChannelEnabled: false,
  }, SRC]],
];

describe('useDeviceConfigSaves: each save sends today\'s request', () => {
  it('covers every section exactly once', async () => {
    const { result } = await renderLoaded();
    const sections = Object.keys(result.current.saves).filter(k => !['reboot', 'purgeNodeDb', 'reload'].includes(k));
    expect(sections.sort()).toEqual(SAVE_CASES.map(c => c[0]).sort());
  });

  it.each(SAVE_CASES)('%s calls %s with today\'s body and returns true', async (section, apiFn, args) => {
    const { result } = await renderLoaded();
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves[section](); });
    expect(ok).toBe(true);
    expect(h.api[apiFn]).toHaveBeenCalledTimes(1);
    expect(h.api[apiFn]).toHaveBeenCalledWith(...args);
    expect(h.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
    expect(result.current.state.isSaving).toBe(false);
  });

  it.each(SAVE_CASES)('%s returns false when %s fails', async (section, apiFn) => {
    const { result } = await renderLoaded();
    h.api[apiFn].mockRejectedValue(new Error('node did not answer'));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves[section](); });
    expect(ok).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('node did not answer'), 'error');
    expect(result.current.state.statusMessage).toMatch(/^Error: /);
    expect(onRebootExpected).not.toHaveBeenCalled();
    expect(result.current.state.isSaving).toBe(false);
  });

  it('mqtt passes a broker preset id through', async () => {
    const { result } = await renderLoaded();
    await act(async () => { await result.current.saves.mqtt({ brokerPresetId: 7 }); });
    expect(h.api.setMQTTConfig).toHaveBeenCalledWith(expect.objectContaining({ brokerPresetId: 7 }), SRC);
  });

  it('a save held by validation sends nothing and returns false', async () => {
    const { result } = await renderLoaded({ deviceConfig: { lora: { hopLimit: 9 } } });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves.lora(); });
    expect(ok).toBe(false);
    expect(h.api.setLoRaConfig).not.toHaveBeenCalled();
    expect(result.current.state.hopLimit).toBe(7);
  });

  it('lora refreshes the TX status query after a save', async () => {
    const { result } = await renderLoaded();
    await act(async () => { await result.current.saves.lora(); });
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['txStatus'] });
  });
});

describe('useDeviceConfigSaves: onRebootExpected follows configRebootRules', () => {
  it.each([
    ['position', 'always'],
    ['mqtt', 'always'],
    ['owner', 'possible'],
    ['device', 'possible'],
    ['lora', 'always'],
  ] as const)('%s on 2.7.x signals %s', async (section, expectation) => {
    const { result } = await renderLoaded();
    await act(async () => { await result.current.saves[section](); });
    expect(onRebootExpected).toHaveBeenCalledTimes(1);
    expect(onRebootExpected).toHaveBeenCalledWith(expectation);
  });

  it.each(['statusmessage', 'meshbeacon'] as const)('%s never signals', async (section) => {
    const { result } = await renderLoaded();
    await act(async () => { await result.current.saves[section](); });
    expect(onRebootExpected).not.toHaveBeenCalled();
  });

  it('lora on 2.8 applies live and does not signal', async () => {
    const { result } = await renderLoaded({ localNodeInfo: { longName: 'Node', shortName: 'N', firmwareVersion: '2.8.1.abc' } });
    await act(async () => { await result.current.saves.lora(); });
    expect(onRebootExpected).not.toHaveBeenCalled();
  });
});

describe('useDeviceConfigSaves: reboot and purge', () => {
  it('reboot uses the parent handler when given, and returns its result', async () => {
    const onRebootDevice = vi.fn().mockResolvedValue(true);
    const { result } = await renderLoaded({}, { onRebootDevice });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves.reboot(); });
    expect(ok).toBe(true);
    expect(onRebootDevice).toHaveBeenCalledTimes(1);
    expect(h.api.rebootDevice).not.toHaveBeenCalled();
    // Reboot is announced by the parent handler, not by onRebootExpected.
    expect(onRebootExpected).not.toHaveBeenCalled();
  });

  it('reboot falls back to the api with today\'s arguments', async () => {
    const { result } = await renderLoaded();
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves.reboot(); });
    expect(ok).toBe(true);
    expect(h.api.rebootDevice).toHaveBeenCalledWith(5, SRC);
  });

  it('reboot returns false on error', async () => {
    h.api.rebootDevice.mockRejectedValue(new Error('down'));
    const { result } = await renderLoaded();
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves.reboot(); });
    expect(ok).toBe(false);
  });

  it('purgeNodeDb sends today\'s request and returns true, false on error', async () => {
    const { result } = await renderLoaded();
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.saves.purgeNodeDb(); });
    expect(ok).toBe(true);
    expect(h.api.purgeNodeDb).toHaveBeenCalledWith(0, SRC);
    h.api.purgeNodeDb.mockRejectedValue(new Error('nope'));
    await act(async () => { ok = await result.current.saves.purgeNodeDb(); });
    expect(ok).toBe(false);
  });
});

describe('useDeviceConfigSaves: reload returns what changed', () => {
  async function reloadWith(next: Record<string, unknown>, initial: Record<string, unknown> = {}) {
    const view = await renderLoaded(initial);
    h.api.getCurrentConfig.mockResolvedValue({ localNodeInfo: { longName: 'Node', shortName: 'N', firmwareVersion: '2.7.9.70724be' }, ...next });
    vi.useFakeTimers();
    let changes: unknown;
    await act(async () => {
      const p = view.result.current.saves.reload();
      await vi.advanceTimersByTimeAsync(2000);
      changes = await p;
    });
    return { view, changes };
  }

  it('one entry per changed field, with section, field, before and after', async () => {
    const { view, changes } = await reloadWith(
      { deviceConfig: { device: { role: 2 }, lora: { hopLimit: 5, bandwidth: 125 } } },
      { deviceConfig: { lora: { hopLimit: 3 } } },
    );
    expect(h.api.refreshNodes).toHaveBeenCalledWith(SRC);
    expect(changes).toEqual([
      { section: 'device', field: 'Device: Role', before: 0, after: 2 },
      { section: 'lora', field: 'LoRa: Hop Limit', before: 3, after: 5 },
    ]);
    // State takes the reloaded values, tracked or not.
    expect(view.result.current.state.role).toBe(2);
    expect(view.result.current.state.bandwidth).toBe(125);
    // Classic's change table keeps its own shape and formatting.
    expect(view.result.current.state.configChanges).toEqual([
      { field: 'Device: Role', oldValue: '0', newValue: '2' },
      { field: 'LoRa: Hop Limit', oldValue: '3', newValue: '5' },
    ]);
    expect(view.result.current.state.showChanges).toBe(true);
  });

  it('booleans compare after proto3 normalisation and keep their raw values', async () => {
    const { changes } = await reloadWith({ moduleConfig: { mqtt: { encryptionEnabled: true } } });
    expect(changes).toEqual([{ section: 'mqtt', field: 'MQTT: Encryption Enabled', before: false, after: true }]);
  });

  it('nothing changed returns an empty list', async () => {
    const { view, changes } = await reloadWith({});
    expect(changes).toEqual([]);
    expect(view.result.current.state.showChanges).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith(expect.any(String), 'success');
  });

  it('a failed reload returns an empty list', async () => {
    const view = await renderLoaded();
    h.api.refreshNodes.mockRejectedValue(new Error('offline'));
    let changes: unknown;
    await act(async () => { changes = await view.result.current.saves.reload(); });
    expect(changes).toEqual([]);
    expect(h.showToast).toHaveBeenCalledWith(expect.stringContaining('offline'), 'error');
    expect(view.result.current.state.isReloading).toBe(false);
  });
});
