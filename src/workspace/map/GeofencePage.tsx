/**
 * The waypoint's geofence (boards 15-07, 15-24): today's WaypointGeofenceFields
 * (shape, radius 160 m to 16 km, the box, the enter / leave / favourites-only
 * alerts and today's warning). On desktop it sits inside the waypoint sheet;
 * on a phone it is a step of that sheet, reached from GeofenceRow, with Back
 * and Done. It is part of the editor, not a route. It sends nothing itself:
 * the geofence goes out with the waypoint.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import WaypointGeofenceFields from '../../components/WaypointGeofenceFields';
import { geofenceBody, type GeofenceDraft } from '../../components/waypointGeofenceDraft';
import { geofenceSummary } from '../../components/map/layers/waypointGeofenceSummary';
import type { Waypoint } from '../../types/waypoint';
import SendsLine from '../patterns/SendsLine';
import styles from './GeofencePage.module.css';

export interface GeofencePageProps {
  value: GeofenceDraft;
  onChange(next: GeofenceDraft): void;
  center: { lat: number; lon: number } | null;
  /** The phone step: Back and Done return to the editor, whose title `backLabel` is. */
  onDone?(): void;
  /** Back and Done stay off while a field here is rejected (#5649). */
  doneDisabled?: boolean;
  backLabel?: string;
}

export default function GeofencePage({ value, onChange, center, onDone, doneDisabled, backLabel }: GeofencePageProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      {onDone && (
        <button type="button" className={styles.back} onClick={onDone} disabled={doneDisabled}>
          <UiIcon name="back" size={18} />
          {backLabel}
        </button>
      )}
      <WaypointGeofenceFields value={value} onChange={onChange} center={center} />
      {onDone && (
        <>
          <SendsLine>{t('workspace.waypoint.geofence_sends')}</SendsLine>
          <button type="button" className={styles.done} onClick={onDone} disabled={doneDisabled}>{t('common.done')}</button>
        </>
      )}
    </div>
  );
}

/** The phone editor's Geofence row: today's one-line summary, opening the page. */
export function GeofenceRow({ value, onOpen, disabled }: { value: GeofenceDraft; onOpen(): void; disabled?: boolean }) {
  const { t } = useTranslation();
  const body = geofenceBody(value);
  const summary = 'error' in body ? null : geofenceSummary({
    geofenceRadiusM: body.geofence_radius_m,
    boundingBox: body.bounding_box,
    notifyOnEnter: body.notify_on_enter,
    notifyOnExit: body.notify_on_exit,
    notifyFavoritesOnly: body.notify_favorites_only,
  } as Waypoint);
  return (
    <button type="button" className={styles.row} onClick={onOpen} disabled={disabled}>
      <span className={styles.rowText}>
        <strong>{t('waypoints.geofence.legend')}</strong>
        <span className={styles.summary}>{summary?.replace(/^Geofence: /, '') ?? t('common.none')}</span>
      </span>
      <UiIcon name="chevronRight" size={18} />
    </button>
  );
}
