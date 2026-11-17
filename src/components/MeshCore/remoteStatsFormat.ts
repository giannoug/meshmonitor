/** Today's remote status formatters (MeshCoreRemoteStatsPanel), shared with the Workspace (Task 7.3). */

export function formatNumber(v: number | undefined): string {
  if (v === undefined || v === null) return '—';
  return v.toLocaleString();
}

export function formatUptime(secs: number | undefined): string {
  if (secs === undefined || secs === null) return '—';
  if (secs < 60) return `${secs}s`;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatBattery(mv: number | undefined): string {
  if (mv === undefined || mv === null) return '—';
  return `${(mv / 1000).toFixed(2)} V`;
}

export function formatRssi(rssi: number | undefined): string {
  if (rssi === undefined || rssi === null) return '—';
  return `${rssi} dBm`;
}

export function formatSnr(snr: number | undefined): string {
  if (snr === undefined || snr === null) return '—';
  // The wire value is a signed int16 representing dB×10 in some firmware
  // versions and raw dB in others — meshcore.js currently emits raw dB,
  // so render as-is with one decimal.
  return `${snr.toFixed(1)} dB`;
}

export function formatAirTime(secs: number | undefined): string {
  if (secs === undefined || secs === null) return '—';
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
