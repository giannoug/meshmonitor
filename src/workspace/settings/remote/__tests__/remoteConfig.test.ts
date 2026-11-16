/**
 * @vitest-environment jsdom
 *
 * Task 5.9 fix round 1 (I5): what a remote read puts on screen and what Send
 * to node then sends, pinned to today's Admin Commands for all 13 commands.
 *
 * Each case is one node reply with the fields its wire elides, as today's
 * server hands them back (proto3 drops 0, false and ''). `today` is the body
 * AdminCommandsTab's handleSet*Config builds from the same reply through
 * today's appliers (AdminCommandsTab.tsx:1028-1632, useAdminCommandsState's
 * initial state), written out by hand. The two are compared as the node
 * receives them: a field left out and a field sent as its proto3 zero are the
 * same message, so `wire()` drops both before comparing.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { useDeviceConfigState } from '../../../../hooks/deviceConfig/useDeviceConfigState';
import type { ConfigSaveSection } from '../../../../hooks/deviceConfig/useDeviceConfigSaves';
import { applyRemoteConfig, applyRemoteOwner, remoteCommand } from '../remoteConfig';
import type { LoadConfigType } from '../../../../components/admin-commands/applyLoadedConfig';

const t = ((key: string) => key) as unknown as TFunction;
const NODE = 0x7c3e10a2;

/** The protobuf the node receives: unset and proto3-zero fields are the same. */
function wire(v: unknown): unknown {
  if (Array.isArray(v)) {
    const out = v.map(wire).filter((x) => x !== undefined);
    return out.length ? out : undefined;
  }
  if (v && typeof v === 'object') {
    const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wire(x)]).filter(([, x]) => x !== undefined));
    return Object.keys(out).length ? out : undefined;
  }
  return v === 0 || v === false || v === '' || v === null || v === undefined || Number.isNaN(v) ? undefined : v;
}

function remoteState() {
  return renderHook(() => useDeviceConfigState(null, 0, { load: false }));
}

const read = (type: LoadConfigType, reply: Record<string, unknown>) => {
  const h = remoteState();
  act(() => void applyRemoteConfig(type, reply, h.result.current, NODE));
  return h;
};

type Case = [ConfigSaveSection, LoadConfigType, Record<string, unknown>, string, Record<string, unknown>];

const CASES: Case[] = [
  ['device', 'device', { role: 2, nodeInfoBroadcastSecs: 10800 }, 'setDeviceConfig', { role: 2, nodeInfoBroadcastSecs: 10800 }],
  // Presets on: today sends modemPreset (elided: 0) and never the custom parameters.
  ['lora', 'lora', { usePreset: true, region: 3, hopLimit: 3, txPower: 20 }, 'setLoRaConfig', { usePreset: true, hopLimit: 3, txPower: 20, txEnabled: true, region: 3 }],
  ['position', 'position', { positionBroadcastSecs: 1800, positionBroadcastSmartEnabled: true, gpsMode: 2, positionFlags: 3 }, 'setPositionConfig', {
    positionBroadcastSecs: 1800, positionBroadcastSmartEnabled: true, positionFlags: 3, gpsMode: 2,
  }],
  ['network', 'network', { wifiEnabled: true, wifiSsid: 'Hilltop', addressMode: 1, ipv4Config: { ip: '10.0.0.2', gateway: '10.0.0.1' } }, 'setNetworkConfig', {
    wifiEnabled: true, wifiSsid: 'Hilltop', addressMode: 1, ipv4Config: { ip: '10.0.0.2', gateway: '10.0.0.1' },
  }],
  ['mqtt', 'mqtt', { enabled: true, address: 'mqtt.example.org', root: 'msh/EU', mapReportSettings: { publishIntervalSecs: 3600 } }, 'setMQTTConfig', {
    enabled: true, address: 'mqtt.example.org', root: 'msh/EU', mapReportSettings: { publishIntervalSecs: 3600 },
  }],
  // No keypair, and the policy only when changed (it is not here).
  ['security', 'security', { adminKeys: ['S2V5MQ=='], serialEnabled: true, packetSignaturePolicy: 1 }, 'setSecurityConfig', { adminKeys: ['S2V5MQ=='], serialEnabled: true }],
  // The case I5 found: interval and enabled elided go back as the node's zero, never 14400.
  ['neighborinfo', 'neighborinfo', { transmitOverLora: true }, 'setNeighborInfoConfig', { transmitOverLora: true }],
  ['telemetry', 'telemetry', { deviceUpdateInterval: 1800, environmentMeasurementEnabled: true }, 'setTelemetryConfig', {
    deviceUpdateInterval: 1800, environmentUpdateInterval: 900, environmentMeasurementEnabled: true, airQualityInterval: 900, powerUpdateInterval: 900,
    healthUpdateInterval: 900,
  }],
  ['statusmessage', 'statusmessage', { nodeStatus: 'Out hiking' }, 'setStatusMessageConfig', { nodeStatus: 'Out hiking' }],
  ['trafficmanagement', 'trafficmanagement', { positionMinIntervalSecs: 60 }, 'setTrafficManagementConfig', { positionMinIntervalSecs: 60 }],
  ['tak', 'tak', { team: 3 }, 'setTAKConfig', { team: 3 }],
  // flags 1 = listen; an absent offer preset stays absent (null), the interval reads as the 3600 floor.
  ['meshbeacon', 'meshbeacon', { flags: 1, broadcastMessage: 'Hilltop here' }, 'setMeshBeaconConfig', {
    flags: 1, broadcastMessage: 'Hilltop here', broadcastIntervalSecs: 3600,
  }],
];

describe('remote reads and sends match today’s Admin Commands', () => {
  it.each(CASES)('%s', (section, type, reply, command, today) => {
    const h = read(type, reply);
    const sent = remoteCommand(section, h.result.current, t);
    expect('command' in sent && sent.command).toBe(command);
    expect(wire('params' in sent ? sent.params.config : undefined)).toEqual(wire(today));
  });

  it('owner: setOwner with today’s fields', () => {
    const h = remoteState();
    act(() => void applyRemoteOwner({ longName: 'Hilltop Relay', shortName: 'HTR' }, h.result.current));
    const sent = remoteCommand('owner', h.result.current, t);
    expect(sent).toEqual({ command: 'setOwner', params: { longName: 'Hilltop Relay', shortName: 'HTR', isUnmessagable: false, isLicensed: false } });
  });

  it('lora with custom parameters sends them and no preset, as today', () => {
    const h = read('lora', { bandwidth: 125, spreadFactor: 12, codingRate: 5, region: 1, hopLimit: 4 });
    const sent = remoteCommand('lora', h.result.current, t);
    expect(wire('params' in sent && sent.params.config)).toEqual({ hopLimit: 4, txEnabled: true, bandwidth: 125, spreadFactor: 12, codingRate: 5, region: 1 });
    expect('params' in sent && (sent.params.config as Record<string, unknown>)).not.toHaveProperty('modemPreset');
  });

  it('a field a later read elides is the node’s zero, not the earlier read', () => {
    const h = read('neighborinfo', { enabled: true, updateInterval: 21600 });
    expect(h.result.current.neighborInfoInterval).toBe(21600);
    act(() => void applyRemoteConfig('neighborinfo', { transmitOverLora: true }, h.result.current, NODE));
    expect(h.result.current.neighborInfoInterval).toBe(0);
    expect(h.result.current.neighborInfoEnabled).toBe(false);
  });

  it('the security reply’s firmware names the node’s firmware', () => {
    const h = read('security', { adminKeys: [], firmwareVersion: '2.8.1' });
    expect(h.result.current.localFirmwareVersion).toBe('2.8.1');
  });
});
