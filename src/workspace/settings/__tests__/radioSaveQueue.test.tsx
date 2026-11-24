/**
 * @vitest-environment jsdom
 *
 * The radio save queue's rules (Task 5.3): the Save words are the strongest
 * restart rule of the queued sections for the firmware (configRebootRules),
 * every queued value has the state setter Discard uses, and Review labels a
 * value with today's label.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { useDeviceConfigState, type DeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import type { DeviceConfigSaves } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import { saveLabel, useRadioSaveQueueState, type SaveResult } from '../useRadioSaveQueue';
import { QUEUED_FIELDS, fieldLabel, formatValue, isQueued, setterOf } from '../radioSections';
import en from '../../../../public/locales/en.json';

const t = ((key: string, fallback?: unknown) => (en as Record<string, string>)[key] ?? fallback ?? key) as unknown as TFunction;

describe('saveLabel', () => {
  it('LoRa on firmware 2.7.15 → Save & restart', () => {
    expect(saveLabel(['lora'], '2.7.15')).toBe('saveAndRestart');
  });
  it('LoRa on 2.8.0 applies live → Save', () => {
    expect(saveLabel(['lora'], '2.8.0')).toBe('save');
  });
  // Channels has no queued section (its slots save from their own page), so it can never be in the queue: an empty queue reads Save.
  it('nothing queued (Channels never queues) → Save', () => {
    expect(saveLabel([], '2.7.15')).toBe('save');
  });
  it('Identity → Save (may restart)', () => {
    expect(saveLabel(['owner'], '2.7.15')).toBe('saveMayRestart');
  });
  it('the strongest rule wins across categories', () => {
    expect(saveLabel(['owner', 'statusmessage', 'lora'], '2.7.15')).toBe('saveAndRestart');
    expect(saveLabel(['statusmessage', 'meshbeacon'], '2.8.1')).toBe('save');
  });
});

describe('queued values', () => {
  it('every queued value has the setter Discard calls', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useDeviceConfigState(null));
    const missing = Object.values(QUEUED_FIELDS).flat().filter((k) => k && !(k in result.current) || typeof setterOf(result.current, k!) !== 'function');
    expect(missing).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('Security queues (Task 5.5); MQTT keeps its own save', () => {
    expect(isQueued('security')).toBe(true);
    expect(isQueued('mqtt')).toBe(false);
    expect(isQueued('lora')).toBe(true);
  });

  it('labels a value with today\'s label, else its name in words', () => {
    expect(fieldLabel(t, 'lora', 'hopLimit')).toBe('Hop Limit');
    expect(fieldLabel(t, 'lora', 'configOkToMqtt')).toBe('OK to MQTT');
    expect(fieldLabel(t, 'device', 'rebroadcastMode')).toBe('Rebroadcast Mode');
    expect(fieldLabel(t, 'storeforward', 'storeForwardHistoryReturnMax')).toBe('History Return Max');
    // No en.json key for this one: its name in words.
    expect(fieldLabel(t, 'power', 'deviceBatteryInaAddress')).toBe('Device battery ina address');
  });

  it('shows an option by its name and a switch as On / Off', () => {
    expect(formatValue(t, 'modemPreset', 4)).toBe('MEDIUM_FAST');
    expect(formatValue(t, 'rebroadcastMode', 2)).toBe('LOCAL_ONLY');
    expect(formatValue(t, 'txEnabled', false)).toBe('Off');
    expect(formatValue(t, 'hopLimit', 4)).toBe('4');
  });
});

describe('useRadioSaveQueueState', () => {
  // The few values the test edits; every other queued value reads undefined on both sides.
  function useFakeConfig(saves: Record<string, () => Promise<boolean>>, guards: Record<string, () => Promise<boolean>> = {}) {
    const [loading, setLoading] = useState(true);
    const [hopLimit, setHopLimit] = useState(3);
    const [longName, setLongName] = useState('Station G2');
    const [storeForwardRecords, setStoreForwardRecords] = useState(100);
    const [fixedLatitude, setFixedLatitude] = useState(37.98);
    const [configVersion, setConfigVersion] = useState(0);
    const state = {
      loading, setLoading, hopLimit, setHopLimit, longName, setLongName, storeForwardRecords, setStoreForwardRecords,
      fixedLatitude, setFixedLatitude, configVersion, setConfigVersion, localFirmwareVersion: '2.7.15',
    };
    const queue = useRadioSaveQueueState(
      { state: state as unknown as DeviceConfigState, saves: saves as unknown as DeviceConfigSaves },
      { numberScope: { invalid: false, reset: () => {}, context: { report: () => {}, resetSignal: 0 } }, runBatch: (fn) => fn(), guards },
    );
    return { state, queue };
  }

  it('a section\'s guard runs before any write; declined, that section stays queued and unsent while the others save', async () => {
    const order: string[] = [];
    const saves = { lora: vi.fn(async () => (order.push('lora'), true)), owner: vi.fn(async () => (order.push('owner'), true)) };
    const { result } = renderHook(() => useFakeConfig(saves, { lora: async () => (order.push('ask lora'), false) }));
    act(() => result.current.state.setLoading(false));
    act(() => {
      result.current.state.setHopLimit(4);
      result.current.state.setLongName('Station G3');
    });
    let outcome: SaveResult | undefined;
    await act(async () => {
      outcome = await result.current.queue.saveAll();
    });
    expect(order).toEqual(['ask lora', 'owner']);
    expect(outcome).toEqual({ ok: ['owner'], failed: [], cancelled: ['lora'] });
    expect(result.current.queue.queue.map((e) => e.section)).toEqual(['lora']);
  });

  it('a failed section stays queued, also after the reload that follows the restart', async () => {
    const saves = { lora: vi.fn(async () => false), owner: vi.fn(async () => true) };
    const { result } = renderHook(() => useFakeConfig(saves));
    act(() => result.current.state.setLoading(false));
    act(() => {
      result.current.state.setHopLimit(4);
      result.current.state.setLongName('Station G3');
    });
    expect(result.current.queue.queue.map((e) => e.section)).toEqual(['owner', 'lora']);
    let outcome: SaveResult | undefined;
    await act(async () => {
      outcome = await result.current.queue.saveAll();
    });
    expect(outcome).toEqual({ ok: ['owner'], failed: ['lora'], cancelled: [] });
    expect(result.current.queue.queue.map((e) => e.section)).toEqual(['lora']);
    // The reboot notice closes and the configuration reloads from the node.
    act(() => result.current.state.setLoading(true));
    act(() => {
      result.current.state.setHopLimit(3);
      result.current.state.setLoading(false);
    });
    expect(result.current.state.hopLimit).toBe(4);
    expect(result.current.queue.queue).toMatchObject([{ section: 'lora', changes: [{ field: 'hopLimit', from: 3, to: 4 }] }]);
  });

  it('Reload config re-baselines only what it re-reads: module and fixed-position edits stay queued', () => {
    const { result } = renderHook(() => useFakeConfig({}));
    act(() => result.current.state.setLoading(false));
    act(() => {
      result.current.state.setStoreForwardRecords(200);
      result.current.state.setFixedLatitude(38.01);
      result.current.state.setHopLimit(4);
    });
    expect(result.current.queue.queue.map((e) => e.section)).toEqual(['lora', 'position', 'storeforward']);
    // reload(): LoRa is re-read (the node now holds 5) and configVersion bumps; Store & Forward and the fixed position are not re-read.
    act(() => {
      result.current.state.setHopLimit(5);
      result.current.state.setConfigVersion(1);
    });
    expect(result.current.queue.queue).toMatchObject([
      { section: 'position', changes: [{ field: 'fixedLatitude', from: 37.98, to: 38.01 }] },
      { section: 'storeforward', changes: [{ field: 'storeForwardRecords', from: 100, to: 200 }] },
    ]);
  });

  it('an edit typed while saving stays queued: the baseline is what was sent', async () => {
    let finish: (ok: boolean) => void = () => {};
    const saves = { lora: vi.fn(() => new Promise<boolean>((r) => { finish = r; })) };
    const { result } = renderHook(() => useFakeConfig(saves));
    act(() => result.current.state.setLoading(false));
    act(() => result.current.state.setHopLimit(4));
    let pending: Promise<SaveResult> = Promise.resolve({ ok: [], failed: [] });
    act(() => {
      pending = result.current.queue.saveAll();
    });
    act(() => result.current.state.setHopLimit(5));
    await act(async () => {
      finish(true);
      await pending;
    });
    expect(result.current.queue.queue).toMatchObject([{ section: 'lora', changes: [{ field: 'hopLimit', from: 4, to: 5 }] }]);
  });

  // F.2 C-M1: a section with no sender (a remote target's saves cover only what it sends) fails visibly.
  it('a queued section with no sender is "not saved", and the others still save', async () => {
    const saves = { owner: vi.fn(async () => true) };
    const { result } = renderHook(() => useFakeConfig(saves));
    act(() => result.current.state.setLoading(false));
    act(() => {
      result.current.state.setHopLimit(4);
      result.current.state.setLongName('Station G3');
    });
    let outcome: SaveResult | undefined;
    await act(async () => {
      outcome = await result.current.queue.saveAll();
    });
    expect(outcome).toEqual({ ok: ['owner'], failed: ['lora'], cancelled: [] });
    expect(result.current.queue.saving).toBe(false);
  });

  // F.2 C-M4: while the configuration reloads, half-loaded values are not counted as changes.
  it('counts nothing while the configuration loads', () => {
    const { result } = renderHook(() => useFakeConfig({}));
    act(() => result.current.state.setLoading(false));
    act(() => result.current.state.setLoading(true));
    act(() => result.current.state.setHopLimit(6));
    expect(result.current.queue.queue).toEqual([]);
  });
});
