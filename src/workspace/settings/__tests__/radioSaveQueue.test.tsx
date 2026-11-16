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
  it('Channels (no queued section) → Save', () => {
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

  it('Security and MQTT keep their own save', () => {
    expect(isQueued('security')).toBe(false);
    expect(isQueued('mqtt')).toBe(false);
    expect(isQueued('lora')).toBe(true);
  });

  it('labels a value with today\'s label, else its name in words', () => {
    expect(fieldLabel(t, 'lora', 'hopLimit')).toBe('Hop Limit');
    expect(fieldLabel(t, 'lora', 'configOkToMqtt')).toBe('OK to MQTT');
    expect(fieldLabel(t, 'device', 'rebroadcastMode')).toBe('Rebroadcast Mode');
    expect(fieldLabel(t, 'storeforward', 'storeForwardHistoryReturnMax')).toMatch(/^History return max$|History/);
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
  function useFakeConfig(saves: Record<string, () => Promise<boolean>>) {
    const [loading, setLoading] = useState(true);
    const [hopLimit, setHopLimit] = useState(3);
    const [longName, setLongName] = useState('Station G2');
    const state = { loading, setLoading, hopLimit, setHopLimit, longName, setLongName, configVersion: 0, localFirmwareVersion: '2.7.15' };
    const queue = useRadioSaveQueueState(
      { state: state as unknown as DeviceConfigState, saves: saves as unknown as DeviceConfigSaves },
      { numberScope: { invalid: false, reset: () => {}, context: { report: () => {}, resetSignal: 0 } }, runBatch: (fn) => fn() },
    );
    return { state, queue };
  }

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
    expect(outcome).toEqual({ ok: ['owner'], failed: ['lora'] });
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
});
