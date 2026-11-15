/**
 * @vitest-environment jsdom
 *
 * Device configuration state, extracted from ConfigurationTab (#6365, Rule X).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  getCurrentConfig: vi.fn(),
  getSecurityKeys: vi.fn(),
}));

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('../../test/mockI18n');
  return createReactI18nextMock();
});
vi.mock('../../services/api', () => ({
  default: { getCurrentConfig: h.getCurrentConfig, getSecurityKeys: h.getSecurityKeys },
}));

import { useDeviceConfigState } from './useDeviceConfigState';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDeviceConfigState', () => {
  it('loads the config for its source and reports loading, configVersion and securityKeys', async () => {
    h.getCurrentConfig.mockResolvedValue({
      localNodeInfo: { longName: 'Node', shortName: 'N', firmwareVersion: '2.7.9' },
      deviceConfig: { lora: { usePreset: true, modemPreset: 3, hopLimit: 5 } },
      moduleConfig: { telemetry: { deviceUpdateInterval: 1800 } },
      supportedModules: { statusmessage: true, trafficManagement: false, meshBeacon: true },
    });
    h.getSecurityKeys.mockResolvedValue({ publicKey: 'pub', privateKey: 'priv' });

    const { result } = renderHook(() => useDeviceConfigState('src-9', 0));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(h.getCurrentConfig).toHaveBeenCalledWith('src-9');
    expect(h.getSecurityKeys).toHaveBeenCalledWith('src-9');
    expect(result.current.longName).toBe('Node');
    expect(result.current.localFirmwareVersion).toBe('2.7.9');
    expect(result.current.usePreset).toBe(true);
    expect(result.current.modemPreset).toBe(3);
    expect(result.current.hopLimit).toBe(5);
    expect(result.current.deviceUpdateInterval).toBe(1800);
    expect(result.current.configVersion).toBe(1);
    expect(result.current.supportedModules?.trafficManagement).toBe(false);
    expect(result.current.securityKeys).toEqual({ publicKey: 'pub', privateKey: 'priv' });
  });

  it('reloads when refreshTrigger changes, and warns when the load fails', async () => {
    h.getCurrentConfig.mockResolvedValue({});
    h.getSecurityKeys.mockResolvedValue({});
    const { result, rerender } = renderHook(({ trigger }) => useDeviceConfigState('src-9', trigger), {
      initialProps: { trigger: 0 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.getCurrentConfig).toHaveBeenCalledTimes(1);

    h.getCurrentConfig.mockRejectedValue(new Error('down'));
    rerender({ trigger: 1 });
    await waitFor(() => expect(h.getCurrentConfig).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statusMessage).toBe('config.load_warning');
  });
});
