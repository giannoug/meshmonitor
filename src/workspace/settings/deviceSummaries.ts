/**
 * Device ›'s one-line summaries (boards 12-06 / 12-22): what each hardware
 * category holds now, from the frame's shared state. Only values today's
 * sections expose are named (Ruling EA): no clock or Ethernet.
 */
import type { TFunction } from 'i18next';
import { REBROADCAST_MODE_OPTIONS, ROLE_OPTIONS } from '../../components/configuration/constants';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';

/** "3 h", "15 min", "60 s": the largest unit that divides the time evenly. */
export function compactDuration(t: TFunction, seconds: number): string {
  if (seconds % 86400 === 0) return t('workspace.settings.summary.days', { count: seconds / 86400 });
  if (seconds % 3600 === 0) return t('workspace.settings.summary.hours', { count: seconds / 3600 });
  if (seconds % 60 === 0) return t('workspace.settings.summary.mins', { count: seconds / 60 });
  return t('workspace.settings.summary.secs', { count: seconds });
}

export function deviceSummary(t: TFunction, id: string, s: DeviceConfigState): string | null {
  const onOff = (on: boolean) => t(on ? 'workspace.settings.summary.on' : 'workspace.settings.summary.off');
  const every = (secs: number) => (secs > 0 ? compactDuration(t, secs) : t('workspace.settings.summary.default'));
  let parts: string[];
  switch (id) {
    case 'device/device':
      parts = [
        t('workspace.settings.summary.role', { role: ROLE_OPTIONS.find((o) => o.value === s.role)?.name ?? s.role }),
        t('workspace.settings.summary.rebroadcast', { mode: REBROADCAST_MODE_OPTIONS.find((o) => o.value === s.rebroadcastMode)?.name ?? s.rebroadcastMode }),
        t('workspace.settings.summary.nodeinfo', { every: every(s.nodeInfoBroadcastSecs) }),
        t('workspace.settings.summary.led_heartbeat', { state: onOff(!s.ledHeartbeatDisabled) }),
      ];
      break;
    case 'device/position':
      parts = [
        t(s.fixedPosition ? 'workspace.settings.summary.fixed_position' : 'workspace.settings.summary.gps_position'),
        t('workspace.settings.summary.broadcast_every', { every: every(s.positionBroadcastSecs) }),
        t('workspace.settings.summary.smart_broadcast', { state: onOff(s.positionSmartEnabled) }),
        t(`workspace.settings.summary.gps_mode_${s.gpsMode}`, ''),
      ];
      break;
    case 'device/power':
      parts = [
        t('workspace.settings.summary.power_saving', { state: onOff(s.isPowerSaving) }),
        t('workspace.settings.summary.shutdown_after', {
          after: s.onBatteryShutdownAfterSecs > 0 ? compactDuration(t, s.onBatteryShutdownAfterSecs) : t('workspace.settings.summary.never'),
        }),
        t('workspace.settings.summary.adc', { value: s.adcMultiplierOverride > 0 ? s.adcMultiplierOverride : t('workspace.settings.summary.default') }),
      ];
      break;
    case 'device/display':
      parts = [
        t('workspace.settings.summary.screen_on', { secs: every(s.screenOnSecs) }),
        t(`workspace.settings.summary.units_${s.displayUnits}`, ''),
        t('workspace.settings.summary.flip', { state: onOff(s.flipScreen) }),
      ];
      break;
    case 'device/network':
      parts = [
        t('workspace.settings.summary.wifi', { state: onOff(s.wifiEnabled) }),
        ...(s.wifiEnabled ? [s.wifiSsid, t(`workspace.settings.summary.address_${s.addressMode}`, '')] : []),
        ...(s.ntpServer ? [t('workspace.settings.summary.ntp', { server: s.ntpServer })] : []),
      ];
      break;
    default:
      return null;
  }
  return parts.filter(Boolean).join(' · ');
}
