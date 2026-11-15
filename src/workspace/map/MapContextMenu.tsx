/**
 * The device map's context menu (boards 15-08, 15-20; s15n3): Add waypoint
 * here, Add local marker here and Measure from here, at the spot the viewer
 * right-clicked (desktop) or long-pressed (phone), with a hint chip that makes
 * the path visible. Opening it sends nothing.
 *
 * A long-press needs no timer of ours: touch browsers report a hold as
 * `contextmenu` (Android natively; mobile Safari through Leaflet's TapHold,
 * 600 ms within 15 px), and Leaflet hands both to the map's `contextmenu`
 * event, so Leaflet's own touch handling and the peek's swipe are untouched.
 * The "Map actions at the centre" map button is the keyboard path.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMapEvent } from 'react-leaflet';
import { UiIcon, type UiIconName } from '../../components/icons';
import styles from './MapContextMenu.module.css';

/** Where the menu opened: the map position, and the point in the map's box. */
export interface MapSpot {
  lat: number;
  lon: number;
  x: number;
  y: number;
}

/** Inside the map: a right-click, or a touch hold, opens the menu there. */
export function MapContextBridge({ onOpen }: { onOpen(spot: MapSpot): void }) {
  useMapEvent('contextmenu', (e) =>
    onOpen({ lat: e.latlng.lat, lon: e.latlng.lng, x: e.containerPoint.x, y: e.containerPoint.y }),
  );
  return null;
}

/** The hint chip: shown to those who may add pins. */
export function MapEditHint({ phone }: { phone: boolean }) {
  const { t } = useTranslation();
  return (
    <p className={styles.hint}>
      <UiIcon name="info" size={16} />
      {t(phone ? 'workspace.map_edit.hint_phone' : 'workspace.map_edit.hint_desktop')}
    </p>
  );
}

export interface MapContextMenuProps {
  spot: MapSpot;
  phone: boolean;
  /** Today's waypoint write gate (waypoints:write on this source) on a source that can send one. */
  canWaypoint: boolean;
  /** waypoints:write on this source; without it, and without canWaypoint, only Measure is offered. */
  canMarker: boolean;
  /** Today's Measure Distance gate: 2D, with two positioned nodes. */
  measureDisabled: boolean;
  onWaypoint(): void;
  onMarker(): void;
  onMeasure(): void;
  onClose(): void;
}

export default function MapContextMenu({ spot, phone, canWaypoint, canMarker, measureDisabled, onWaypoint, onMarker, onMeasure, onClose }: MapContextMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const items = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];

  useEffect(() => {
    items()[0]?.focus();
  }, [spot]);

  // A press anywhere else closes it (the press that opened it came before it existed).
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [onClose]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
  };

  const item = (icon: UiIconName, label: string, hint: string, onPick: () => void, disabled = false) => (
    <button type="button" role="menuitem" className={styles.item} disabled={disabled} onClick={() => { onClose(); onPick(); }}>
      <UiIcon name={icon} size={18} />
      <span className={styles.text}>
        <strong>{label}</strong>
        <span className={styles.sub}>{hint}</span>
      </span>
    </button>
  );

  return (
    <div
      ref={ref}
      className={styles.menu}
      data-phone={phone || undefined}
      // shortcut: the clamp assumes the menu's size (CSS max-width / height); measure it if the items grow.
      style={{ left: phone ? undefined : `min(${spot.x}px, calc(100% - 352px))`, top: `min(${spot.y + (phone ? 24 : 0)}px, calc(100% - 300px))` }}
      role="menu"
      aria-label={t('workspace.map_edit.menu')}
      onKeyDown={onKeyDown}
    >
      <p className={styles.head}>{`${spot.lat.toFixed(4)}, ${spot.lon.toFixed(4)}`}</p>
      {canWaypoint && item('location', t('workspace.map_edit.add_waypoint'), t('workspace.map_edit.add_waypoint_hint'), onWaypoint)}
      {canMarker && item('pin', t('workspace.map_edit.add_marker'), t('workspace.map_edit.add_marker_hint'), onMarker)}
      {item('ruler', t('workspace.map_edit.measure'), t('workspace.map_edit.measure_hint'), onMeasure, measureDisabled)}
    </div>
  );
}
