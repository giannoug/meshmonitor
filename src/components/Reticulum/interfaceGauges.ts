/**
 * An interface's live RNode gauges as rows (#6120), shared by today's
 * `ReticulumInfoView` and the Workspace Info page (#6365). A gauge with no
 * value yields no row, so a non-RNode interface yields none.
 */
import type { TFunction } from 'i18next';
import type { ReticulumInterfaceRow } from '../../types/reticulum';

/** One hide-if-empty row inside an interface's status card. */
export interface GaugeRow {
  key: string;
  label: string;
  value: string;
}

/** Compact "time since" for the interference timestamp (RNS epoch SECONDS). */
function formatAgoSeconds(tsSeconds: number): string {
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - tsSeconds));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

/** Joins the short (15s) / long (1h) window samples, skipping absent ones. */
function windowValue(short: number | null, long: number | null): string | null {
  const parts: string[] = [];
  if (short != null) parts.push(`${short}% (15s)`);
  if (long != null) parts.push(`${long}% (1h)`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Build the hide-empty gauge rows for one interface (#6120). A field with no
 * value yields no row, so a non-RNode interface (every gauge null) returns an
 * empty list and renders no card at all.
 */
export function buildInterfaceGaugeRows(iface: ReticulumInterfaceRow, t: TFunction): GaugeRow[] {
  const rows: GaugeRow[] = [];

  if (iface.batteryPercent != null) {
    const state = iface.batteryState ? ` (${iface.batteryState})` : '';
    rows.push({
      key: 'battery',
      label: t('reticulum.info.iface_battery', 'Battery'),
      value: `${iface.batteryPercent}%${state}`,
    });
  }

  const airtime = windowValue(iface.airtimeShort, iface.airtimeLong);
  if (airtime) {
    rows.push({ key: 'airtime', label: t('reticulum.info.iface_airtime', 'Airtime'), value: airtime });
  }

  const channelLoad = windowValue(iface.channelLoadShort, iface.channelLoadLong);
  if (channelLoad) {
    rows.push({ key: 'channel_load', label: t('reticulum.info.iface_channel_load', 'Channel load'), value: channelLoad });
  }

  if (iface.noiseFloor != null) {
    rows.push({ key: 'noise_floor', label: t('reticulum.info.iface_noise_floor', 'Noise floor'), value: `${iface.noiseFloor} dBm` });
  }

  if (iface.interference != null) {
    rows.push({ key: 'interference', label: t('reticulum.info.iface_interference', 'Interference'), value: `${iface.interference} dBm` });
  }

  if (iface.interferenceLastDbm != null && iface.interferenceLastTs != null) {
    rows.push({
      key: 'interference_last',
      label: t('reticulum.info.iface_interference_last', 'Last interference'),
      value: `${iface.interferenceLastDbm} dBm, ${formatAgoSeconds(iface.interferenceLastTs)} ${t('reticulum.info.iface_ago', 'ago')}`,
    });
  }

  if (iface.cpuLoad != null) {
    rows.push({ key: 'cpu_load', label: t('reticulum.info.iface_cpu_load', 'CPU load'), value: `${iface.cpuLoad}%` });
  }

  return rows;
}
