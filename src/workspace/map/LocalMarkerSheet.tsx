/**
 * The local marker editor (boards 15-08, 15-26): LocalMarkerEditorModal's
 * form (useLocalMarkerForm: label, notes, position, altitude, icon, colour and
 * today's save), a right sheet from 768 px and a bottom sheet below. A local
 * marker is stored in MeshMonitor only and never sent to the mesh.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../components/common/NumberInput';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import { UiIcon } from '../../components/icons';
import PinSourcePicker, { type PinSourceChoice } from '../../components/map/PinSourcePicker';
import { COLOR_LABELS, ICON_LABELS, useLocalMarkerForm } from '../../components/map/useLocalMarkerForm';
import {
  MAP_MARKER_COLORS, MAP_MARKER_DESCRIPTION_MAX, MAP_MARKER_ICONS, MAP_MARKER_LABEL_MAX,
  type MapMarker, type MapMarkerColor, type MapMarkerIcon, type MapMarkerInput,
} from '../../types/mapMarker';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import styles from './LocalMarkerSheet.module.css';

export interface LocalMarkerSheetProps {
  open: boolean;
  initial: MapMarker | null;
  defaultCoords: { lat: number; lon: number } | null;
  onClose(): void;
  onSave(input: MapMarkerInput): Promise<void>;
  /** The Overview map (several devices, #6365): the device that keeps the marker; Save stays off until one is picked. */
  storingSource?: PinSourceChoice;
}

export default function LocalMarkerSheet({ open, initial, defaultCoords, onClose, onSave, storingSource }: LocalMarkerSheetProps) {
  const { t } = useTranslation();
  const id = useId();
  const form = useLocalMarkerForm({ isOpen: open, initial, defaultCoords, onClose, onSave, storingSource });
  return (
    <ConfirmSheet
      open={open}
      title={initial ? t('localMarkers.editTitle') : t('localMarkers.newTitle')}
      confirmLabel={form.saving ? t('common.saving') : t('common.save')}
      busy={form.saving}
      confirmDisabled={!form.canSave}
      onCancel={onClose}
      onConfirm={form.save}
      body={
        <NumberInputScope scope={form.numberScope}>
          <div className={styles.form}>
            <p className={styles.hint}>
              <UiIcon name="visibilityOff" size={14} /> {t('localMarkers.editorNote')}
            </p>
            {storingSource && (
              <PinSourcePicker
                id={`${id}-source`}
                label={t('mapPins.markerSourceLabel', 'Source')}
                placeholder={t('mapPins.chooseSource')}
                hint={t('mapPins.markerSourceHint', 'The marker is kept with this source and shows on its maps. No radio sends it.')}
                hiddenNote={t('mapPins.hiddenByFilter')}
                choice={storingSource}
              />
            )}
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>{t('localMarkers.label')}</span>
                <input className={styles.input} value={form.label} maxLength={MAP_MARKER_LABEL_MAX} required
                  onChange={(e) => form.setLabel(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t('localMarkers.description')}</span>
                <textarea className={styles.input} value={form.description} maxLength={MAP_MARKER_DESCRIPTION_MAX} rows={1}
                  onChange={(e) => form.setDescription(e.target.value)} />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field} htmlFor={`${id}-lat`}>
                <span className={styles.label}>{t('localMarkers.latitude')}</span>
                <NumberInput id={`${id}-lat`} className={styles.input} step="any" min={-90} max={90} value={form.lat} allowEmpty onChange={form.setLat} />
              </label>
              <label className={styles.field} htmlFor={`${id}-lon`}>
                <span className={styles.label}>{t('localMarkers.longitude')}</span>
                <NumberInput id={`${id}-lon`} className={styles.input} step="any" min={-180} max={180} value={form.lon} allowEmpty onChange={form.setLon} />
              </label>
              <label className={styles.field} htmlFor={`${id}-alt`}>
                <span className={styles.label}>{t('localMarkers.altitude')}</span>
                <NumberInput id={`${id}-alt`} className={styles.input} step="any" min={-1000} max={100000} value={form.altitude} allowEmpty onChange={form.setAltitude} />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>{t('localMarkers.icon')}</span>
                <select className={styles.input} value={form.icon} onChange={(e) => form.setIcon(e.target.value as MapMarkerIcon)}>
                  {MAP_MARKER_ICONS.map((k) => <option key={k} value={k}>{t(`localMarkers.icons.${k}`, ICON_LABELS[k])}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t('localMarkers.color')}</span>
                <select className={styles.input} value={form.color} onChange={(e) => form.setColor(e.target.value as MapMarkerColor)}>
                  {MAP_MARKER_COLORS.map((k) => <option key={k} value={k}>{t(`localMarkers.colors.${k}`, COLOR_LABELS[k])}</option>)}
                </select>
              </label>
            </div>
            {form.error && <p className={styles.error} role="alert">{form.error}</p>}
            <SendsLine>{t('workspace.node_dialogs.override_sends')}</SendsLine>
          </div>
        </NumberInputScope>
      }
    />
  );
}

/** Delete a local marker: today's question, in a plain confirm. It sends nothing. */
export function DeleteMarkerSheet({ marker, onClose, onDelete }: { marker: MapMarker | null; onClose(): void; onDelete(m: MapMarker): Promise<unknown> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!marker) return null;
  return (
    <ConfirmSheet
      open
      danger
      title={t('localMarkers.confirmDelete', { label: marker.label })}
      body={<div className={styles.form}><SendsLine>{t('workspace.node_dialogs.override_sends')}</SendsLine></div>}
      confirmLabel={t('common.delete')}
      busy={busy}
      onCancel={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          await onDelete(marker);
          onClose();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
