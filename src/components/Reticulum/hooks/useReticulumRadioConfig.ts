/**
 * The own-mode RNode radio configuration and device info (#3960 Phase 3),
 * shared by today's `ReticulumConfigurationView` and the Workspace RNode radio
 * page (#6365): read once on open (radio config and device info), and Apply,
 * one PUT per press with every non-blank field, then read again.
 *
 * Talks to (both `ok()` envelopes, read via `.data`):
 *   GET/PUT /api/sources/:id/reticulum/radio-config   configuration:read / write
 *   GET     /api/sources/:id/reticulum/device-info    configuration:read
 *
 * Apply writes the radio over its serial link: it sends nothing on the network.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';

export interface RadioConfig {
  frequency: number | null;
  bandwidth: number | null;
  spreadingFactor: number | null;
  codingRate: number | null;
  txPower: number | null;
  stAlock: number | null;
  ltAlock: number | null;
  radioState: boolean | null;
}

export interface DeviceInfo {
  firmwareVersion?: string | null;
  mcu?: string | null;
  platform?: string | null;
  chipTemp?: number | null;
  csma?: Record<string, unknown> | null;
  phy?: Record<string, unknown> | null;
}

export const EMPTY_RADIO_CONFIG: RadioConfig = {
  frequency: null, bandwidth: null, spreadingFactor: null, codingRate: null,
  txPower: null, stAlock: null, ltAlock: null, radioState: null,
};

function unwrap<T>(res: unknown): T | null {
  if (res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)) {
    return (res as { data: T }).data;
  }
  return (res as T) ?? null;
}

export function useReticulumRadioConfig(sourceId: string, showRadio: boolean) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<RadioConfig>(EMPTY_RADIO_CONFIG);
  /** The values last read from the radio (the editable `config` starts as these). */
  const [saved, setSaved] = useState<RadioConfig>(EMPTY_RADIO_CONFIG);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(showRadio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const base = `/api/sources/${encodeURIComponent(sourceId)}/reticulum`;

  const load = useCallback(async () => {
    if (!showRadio) return;
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, devRes] = await Promise.all([
        api.get<unknown>(`${base}/radio-config`),
        api.get<unknown>(`${base}/device-info`).catch(() => null),
      ]);
      const cfg = unwrap<RadioConfig>(cfgRes);
      // The bridge reports radioState as a boolean; coerce defensively.
      if (cfg) {
        const read = { ...EMPTY_RADIO_CONFIG, ...cfg, radioState: cfg.radioState == null ? null : Boolean(cfg.radioState) };
        setConfig(read);
        setSaved(read);
      }
      const dev = devRes ? unwrap<DeviceInfo>(devRes) : null;
      setDeviceInfo(dev);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reticulum.config.loadError', 'Failed to load radio configuration'));
    } finally {
      setLoading(false);
    }
  }, [base, t, showRadio]);

  useEffect(() => { void load(); }, [load]);

  // Blank is legal here: a null field is left out of the patch (#5649: the
  // field emits null for blank and never emits out-of-range text).
  const setField = (key: keyof RadioConfig, value: number | null) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  /** One PUT with `values` (default: the edited config); true when the radio took it. */
  const apply = async (values: RadioConfig = config): Promise<boolean> => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      // PUT is the server's verb; null (blank) fields are left out of the
      // patch, as the server rejects a null value.
      const patch = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== null && v !== undefined));
      await api.put(`${base}/radio-config`, patch);
      setStatus(t('reticulum.config.saved', 'Radio configuration applied'));
      void load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reticulum.config.saveError', 'Failed to apply radio configuration'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { config, setConfig, setField, saved, deviceInfo, loading, saving, error, status, apply };
}
