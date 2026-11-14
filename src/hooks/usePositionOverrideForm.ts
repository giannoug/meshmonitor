/**
 * The position-override form (PositionOverrideModal's logic, shared with the
 * Workspace's OverridePositionSheet): load the saved override once per open,
 * validate, and save through the caller's `onSave`. It sends nothing on the
 * mesh; the override lives in MeshMonitor.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNumberInputScope } from '../components/common/numberInputScopeContext';
import apiService from '../services/api';
import { useResolvedSourceId } from './useResolvedSourceId';

export interface PositionOverrideValue {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  isPrivate?: boolean;
}

export interface UsePositionOverrideFormOptions {
  isOpen: boolean;
  /** Meshtastic: the node's `!id`; MeshCore: the contact's public key. */
  nodeId: string | undefined;
  nodeNum: number | undefined;
  onSave: (nodeNum: number, data: PositionOverrideValue) => Promise<void>;
  onClose: () => void;
  protocol?: 'meshtastic' | 'meshcore';
}

export function usePositionOverrideForm({ isOpen, nodeId, nodeNum, onSave, onClose, protocol = 'meshtastic' }: UsePositionOverrideFormOptions) {
  const { t } = useTranslation();
  const sourceId = useResolvedSourceId();
  const [enabled, setEnabled] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [altitude, setAltitude] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation state
  const [latError, setLatError] = useState<string | null>(null);
  const [lngError, setLngError] = useState<string | null>(null);
  const numberScope = useNumberInputScope();

  // Track if we've loaded data for current modal session to prevent poll refresh from resetting
  const loadedForNodeRef = useRef<string | null>(null);

  // Load current override when modal opens (only once per modal session)
  useEffect(() => {
    // Defer until the sourceId resolves — the endpoint now requires it.
    if (isOpen && nodeId && sourceId && loadedForNodeRef.current !== nodeId) {
      loadedForNodeRef.current = nodeId;
      setLoading(true);
      setError(null);
      const load = protocol === 'meshcore'
        ? apiService
          .get<{ data: PositionOverrideValue }>(
            `/api/sources/${encodeURIComponent(sourceId)}/meshcore/nodes/${encodeURIComponent(nodeId)}/position-override`,
          )
          .then((body) => body.data)
        : apiService.get<PositionOverrideValue>(
          `/api/nodes/${nodeId}/position-override?sourceId=${encodeURIComponent(sourceId)}`,
        );
      load
        .then((data) => {
          setEnabled(data.enabled);
          setIsPrivate(data.isPrivate ?? false);
          setLatitude(data.latitude?.toString() ?? '');
          setLongitude(data.longitude?.toString() ?? '');
          setAltitude(data.altitude?.toString() ?? '');
        })
        .catch(err => {
          console.error('Error loading position override:', err);
          // Reset to defaults if load fails
          setEnabled(false);
          setIsPrivate(false);
          setLatitude('');
          setLongitude('');
          setAltitude('');
        })
        .finally(() => setLoading(false));
    }
    // Reset the ref when modal closes so it reloads on next open
    if (!isOpen) {
      loadedForNodeRef.current = null;
    }
  }, [isOpen, nodeId, sourceId, protocol]);

  // Reset error state when values change
  useEffect(() => {
    setError(null);
  }, [enabled, latitude, longitude, altitude, isPrivate]);

  const validateLatitude = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num < -90 || num > 90) {
      setLatError(t('position_override.latitude_error'));
      return false;
    }
    setLatError(null);
    return true;
  };

  const validateLongitude = (value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num) || num < -180 || num > 180) {
      setLngError(t('position_override.longitude_error'));
      return false;
    }
    setLngError(null);
    return true;
  };

  const handleSave = async () => {
    if (nodeNum === undefined) return;
    // #5649: a blank or out-of-range coordinate is never stored.
    if (numberScope.invalid) return;
    setError(null);

    // Validate if enabled
    if (enabled) {
      const latValid = validateLatitude(latitude);
      const lngValid = validateLongitude(longitude);
      if (!latValid || !lngValid) {
        return;
      }
    }

    setSaving(true);
    try {
      await onSave(nodeNum, {
        enabled,
        latitude: enabled ? parseFloat(latitude) : undefined,
        longitude: enabled ? parseFloat(longitude) : undefined,
        altitude: enabled && altitude ? parseFloat(altitude) : undefined,
        isPrivate: enabled ? isPrivate : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save position override');
    } finally {
      setSaving(false);
    }
  };

  // NumberInput emits only numbers inside min/max, so a change clears the error.
  const handleLatitudeChange = (value: number) => {
    setLatitude(String(value));
    setLatError(null);
  };

  const handleLongitudeChange = (value: number) => {
    setLongitude(String(value));
    setLngError(null);
  };

  const saveDisabled = saving || numberScope.invalid || (enabled && (latError !== null || lngError !== null));

  return {
    enabled, setEnabled, isPrivate, setIsPrivate, latitude, longitude, altitude, setAltitude, loading, saving, error,
    latError, lngError, numberScope, handleSave, handleLatitudeChange, handleLongitudeChange, saveDisabled,
  };
}
