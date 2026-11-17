/**
 * A source's status dot and label, as the Dashboard source card shows it
 * (moved out of DashboardSidebar unchanged, #6365, so Server › Devices shows
 * the same words). `idle` marks the manual state (auto-connect off, not
 * connected), so a caller need not compare the translated label.
 */
import type { DashboardSource, SourceStatus } from '../../hooks/useDashboardData';

export function getStatusInfo(
  source: DashboardSource,
  status: SourceStatus | null | undefined,
  t: (key: string) => string,
): { dotClass: string; label: string; idle?: boolean } {
  if (!source.enabled) {
    return { dotClass: 'disabled', label: t('source.status_disabled') };
  }
  const autoConnectDisabled = (source.config as { autoConnect?: unknown } | undefined)?.autoConnect === false;
  if (autoConnectDisabled && (!status || !status.connected)) {
    // autoConnect=false → source is enabled but manager isn't running until the
    // user explicitly connects (issue #2773). Show a distinct "idle" state
    // instead of a misleading "connecting" dot.
    return { dotClass: 'disabled', label: t('source.status_idle'), idle: true };
  }
  if (!status) {
    return { dotClass: 'disconnected', label: t('source.status_connecting') };
  }
  if (status.authStopped && !status.connected) {
    // The broker kept rejecting the login and the source gave up (#5596).
    // "Connecting" would be a lie: nothing is retrying.
    return { dotClass: 'disconnected', label: t('source.status_auth_stopped') };
  }
  if (status.evictionStopped && !status.connected) {
    // An MQTT bridge the broker kept evicting gave up (#5893). Nothing retries.
    return { dotClass: 'disconnected', label: t('source.status_eviction_stopped') };
  }
  if (status.connected) {
    return { dotClass: 'connected', label: t('source.status_connected') };
  }
  return { dotClass: 'connecting', label: t('source.status_connecting') };
}
