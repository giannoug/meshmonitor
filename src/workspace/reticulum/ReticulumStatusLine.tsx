/**
 * The Reticulum status line (board 9-01, note s9n0), above every desktop view:
 * the connection, the raw mode (own, attach or tcp_peer), "N destinations ·
 * N interfaces", the first Up RNode's badge (Connected, Battery, Airtime, one
 * at a time as today's header badge rotates them; a screen reader hears all
 * three) and Refresh. It reads the screen's one poll; Refresh is today's
 * re-fetch of the same five reads, once per press. An error replaces it with
 * today's message and Retry.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useRotatingFace } from '../../components/AppHeader/useRotatingFace';
import { reticulumHeaderMetrics } from '../../components/Reticulum/reticulumHeaderMetrics';
import { useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

type Face = 'status' | 'battery' | 'airtime';

export default function ReticulumStatusLine() {
  const { t } = useTranslation();
  const { rns } = useRnsRuntime();
  const { status, interfaces, loading, error, refresh } = rns;
  const connected = status?.connected ?? false;
  const metrics = useMemo(() => reticulumHeaderMetrics(interfaces), [interfaces]);
  const faces = useMemo<Face[]>(() => {
    const list: Face[] = ['status'];
    if (connected && metrics?.batteryLevel != null) list.push('battery');
    if (connected && (metrics?.airUtilTx != null || metrics?.channelUtilization != null)) list.push('airtime');
    return list;
  }, [connected, metrics]);
  const face = useRotatingFace(faces);

  const statusText =
    status === null
      ? t('reticulum.status.connecting', 'Connecting…')
      : connected
        ? t('reticulum.status.connected', 'Connected')
        : t('reticulum.status.disconnected', 'Disconnected');
  const battery = metrics?.batteryLevel != null ? t('workspace.reticulum.badge_battery', { value: metrics.batteryLevel }) : null;
  const airtimeValue = metrics?.airUtilTx ?? metrics?.channelUtilization;
  const airtime = airtimeValue != null ? t('workspace.reticulum.badge_airtime', { value: airtimeValue.toFixed(1) }) : null;
  const faceText = face === 'battery' ? battery : face === 'airtime' ? airtime : statusText;

  const refreshButton = (label: string) => (
    <button type="button" className={styles.plainButton} disabled={loading} onClick={() => void refresh()}>
      <UiIcon name="refresh" size={16} /> {label}
    </button>
  );

  if (error) {
    return (
      <div className={styles.statusLine} role="alert">
        <UiIcon name="alert" size={16} />
        <span className={styles.statusError}>{error}</span>
        <span className={styles.statusEnd}>{refreshButton(t('common.retry', 'Retry'))}</span>
      </div>
    );
  }

  return (
    <div className={styles.statusLine}>
      <span className={styles.dot} data-on={connected || undefined} aria-hidden="true" />
      <span className={styles.statusText}>{statusText}</span>
      {status?.mode && <span className={styles.chip}>{status.mode}</span>}
      {status && (
        <span className={styles.statusMeta}>
          {t('reticulum.status.counts', '{{destinations}} destinations · {{interfaces}} interfaces', {
            destinations: status.destinationCount,
            interfaces: status.interfaceCount,
          })}
        </span>
      )}
      <span className={styles.statusEnd}>
        {metrics && (
          <span className={styles.badge}>
            <UiIcon name="radio" size={16} />
            <span aria-hidden="true">{t('workspace.reticulum.badge', { face: faceText })}</span>
            <span className={styles.srOnly}>
              {[t('workspace.reticulum.badge', { face: statusText }), battery, airtime].filter(Boolean).join(' · ')}
            </span>
          </span>
        )}
        {refreshButton(t('common.refresh', 'Refresh'))}
      </span>
    </div>
  );
}
