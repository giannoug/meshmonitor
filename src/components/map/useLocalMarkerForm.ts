/**
 * The local marker editor's form state and save (Rule X, #6365): moved out of
 * `LocalMarkerEditorModal` so the Workspace's LocalMarkerSheet runs the same
 * fields and checks. The modal renders from this hook unchanged.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import type { MapMarker, MapMarkerColor, MapMarkerIcon, MapMarkerInput } from '../../types/mapMarker';
import type { PinSourceChoice } from './PinSourcePicker';

export const ICON_LABELS: Record<MapMarkerIcon, string> = {
  pin: 'Pin', star: 'Star', target: 'Target', antenna: 'Antenna', home: 'Home', warning: 'Warning',
};
export const COLOR_LABELS: Record<MapMarkerColor, string> = {
  accent: 'Blue', success: 'Green', warning: 'Amber', error: 'Red', info: 'Teal', muted: 'Grey',
};

export interface LocalMarkerFormOptions {
  isOpen: boolean;
  initial?: MapMarker | null;
  defaultCoords?: { lat: number; lon: number } | null;
  onClose: () => void;
  onSave: (input: MapMarkerInput) => Promise<void>;
  storingSource?: PinSourceChoice;
}

/** A map click gives ~15 decimals; 6 (about 0.1 m) is plenty and fits the field. */
const roundCoord = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 1e6) / 1e6;

export function useLocalMarkerForm({ isOpen, initial, defaultCoords, onClose, onSave, storingSource }: LocalMarkerFormOptions) {
  const { t } = useTranslation();
  const numberScope = useNumberInputScope();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [altitude, setAltitude] = useState<number | null>(null);
  const [icon, setIcon] = useState<MapMarkerIcon>('pin');
  const [color, setColor] = useState<MapMarkerColor>('accent');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLabel(initial?.label ?? '');
    setDescription(initial?.description ?? '');
    setLat(roundCoord(initial?.latitude ?? defaultCoords?.lat));
    setLon(roundCoord(initial?.longitude ?? defaultCoords?.lon));
    setAltitude(initial?.altitude ?? null);
    setIcon(initial?.icon ?? 'pin');
    setColor(initial?.color ?? 'accent');
    setError(null);
    setSaving(false);
  }, [isOpen, initial, defaultCoords]);

  const sourceMissing = Boolean(storingSource) && !storingSource?.value;
  const canSave = !sourceMissing && label.trim().length > 0 && lat !== null && lon !== null && !numberScope.invalid && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        label: label.trim(), description: description.trim() || null,
        latitude: lat as number, longitude: lon as number, altitude, icon, color,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('localMarkers.saveFailed', 'Could not save the marker'));
      setSaving(false);
    }
  };

  return {
    numberScope,
    label, setLabel,
    description, setDescription,
    lat, setLat,
    lon, setLon,
    altitude, setAltitude,
    icon, setIcon,
    color, setColor,
    saving,
    error,
    canSave,
    save,
  };
}
