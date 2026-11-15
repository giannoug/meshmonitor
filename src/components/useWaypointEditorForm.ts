/**
 * The waypoint editor's form state, validation and save (Rule X, #6365):
 * moved out of `WaypointEditorModal` so the Workspace's WaypointSheet runs
 * the same fields and checks. The modal renders from this hook unchanged.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Waypoint, WaypointInput } from '../types/waypoint';
import { hopLimitSettingValue } from '../utils/hopLimitOverride';
import { useNumberInputScope } from './common/numberInputScopeContext';
import type { PinSourceChoice } from './map/PinSourcePicker';
import {
  EMPTY_GEOFENCE,
  geofenceBody,
  geofenceDraftFrom,
  type GeofenceDraft,
} from './waypointGeofenceDraft';

// eslint-disable-next-line meshmonitor-ui/no-hardcoded-ui-glyph -- #6365 waypoint icons are protocol content (the Waypoint icon codepoint), moved from WaypointEditorModal
export const DEFAULT_EMOJIS = ['📍', '🏠', '🏕️', '⛺', '🚗', '🛟', '⚠️', '⭐', '🚩', '🛠️'];
/** The icon a new waypoint starts with. */
const DEFAULT_ICON = DEFAULT_EMOJIS[0];

/**
 * Highest device channel slot a Meshtastic radio exposes. Virtual channels
 * from the Channel Database use ids at/above `CHANNEL_DB_OFFSET` (100) and
 * cannot carry an outgoing waypoint, so they are filtered out of the picker.
 */
const MAX_CHANNEL_INDEX = 7;

/** Minimal shape the picker needs — matches `Channel` from `types/device`. */
export interface WaypointChannelOption {
  id: number;
  name?: string;
}

export interface WaypointEditorFormOptions {
  isOpen: boolean;
  initial?: Waypoint | null;
  channels?: WaypointChannelOption[];
  onClose: () => void;
  onSave: (input: WaypointInput) => Promise<void> | void;
  selfNodeNum?: number | null;
  defaultCoords?: { lat: number; lon: number } | null;
  sendingSource?: PinSourceChoice;
}

function expireSecondsToLocal(expire: number | null | undefined): string {
  if (expire === null || expire === undefined || expire === 0) return '';
  const d = new Date(expire * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localToExpireSeconds(local: string): number | null {
  if (!local) return null;
  const ms = Date.parse(local);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export function useWaypointEditorForm(props: WaypointEditorFormOptions) {
  const { isOpen, initial, channels, onClose, onSave, selfNodeNum, defaultCoords, sendingSource } = props;
  const sendingSourceId = sendingSource?.value ?? null;
  const sourceMissing = Boolean(sendingSource) && !sendingSourceId;

  const deviceChannels = useMemo(
    () => (channels ?? []).filter((c) => Number.isInteger(c.id) && c.id >= 0 && c.id <= MAX_CHANNEL_INDEX),
    [channels],
  );

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState(DEFAULT_ICON);
  const [expireLocal, setExpireLocal] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [lockToSelf, setLockToSelf] = useState(false);
  const [virtual, setVirtual] = useState(false);
  const [channel, setChannel] = useState(0);
  const [rebroadcast, setRebroadcast] = useState('');
  /** '' = the node's configured hop limit; '0'-'7' pins it (#5482). */
  const [hopLimit, setHopLimit] = useState('');
  const [geofence, setGeofence] = useState<GeofenceDraft>(EMPTY_GEOFENCE);
  const [error, setError] = useState<string | null>(null);
  const numberScope = useNumberInputScope();
  const [saving, setSaving] = useState(false);

  // A waypoint can name a slot the source no longer reports (renamed, or the
  // channel list has not loaded). Keep it in the list so the picker shows the
  // real stored value instead of silently rendering blank.
  const channelOptions = useMemo(() => {
    if (deviceChannels.some((c) => c.id === channel)) return deviceChannels;
    return [...deviceChannels, { id: channel, name: `Channel ${channel}` }].sort(
      (a, b) => a.id - b.id,
    );
  }, [deviceChannels, channel]);

  // Reset form when opened or `initial` changes. Not on `selfNodeNum`: it
  // arrives late and, with a source picker, changes with the picked source,
  // and a reset then would wipe what the user has typed (#5685).
  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      setLat(String(initial.latitude));
      setLon(String(initial.longitude));
      setName(initial.name ?? '');
      setDescription(initial.description ?? '');
      setEmoji(initial.iconEmoji ?? DEFAULT_ICON);
      setHasExpiry(initial.expireAt != null && initial.expireAt > 0);
      setExpireLocal(expireSecondsToLocal(initial.expireAt));
      setVirtual(Boolean(initial.isVirtual));
      // `null` on rows created before #4341 — those went out on slot 0.
      setChannel(initial.channel ?? 0);
      setRebroadcast(
        initial.rebroadcastIntervalS
          ? String(Math.max(10, Math.round(initial.rebroadcastIntervalS / 60)))
          : '',
      );
      setHopLimit(hopLimitSettingValue(initial.hopLimit));
      setGeofence(geofenceDraftFrom(initial));
    } else {
      setLat(defaultCoords ? String(defaultCoords.lat) : '');
      setLon(defaultCoords ? String(defaultCoords.lon) : '');
      setName('');
      setDescription('');
      setEmoji(DEFAULT_ICON);
      setHasExpiry(false);
      setExpireLocal('');
      setLockToSelf(false);
      setVirtual(false);
      setChannel(0);
      setRebroadcast('');
      setHopLimit('');
      setGeofence(EMPTY_GEOFENCE);
    }
    setError(null);
  }, [isOpen, initial, defaultCoords]);

  // Edit mode: the lock box follows the stored lock and this source's node.
  useEffect(() => {
    if (!isOpen || !initial) return;
    setLockToSelf(
      initial.lockedTo != null && selfNodeNum != null && initial.lockedTo === selfNodeNum,
    );
  }, [isOpen, initial, selfNodeNum]);

  // A slot index means a different channel on each radio, and "this node" is
  // a different node. Picking another sending source puts both back to their
  // defaults instead of carrying the first source's choice over (#4341).
  const [seenSourceId, setSeenSourceId] = useState(sendingSourceId);
  if (seenSourceId !== sendingSourceId) {
    setSeenSourceId(sendingSourceId);
    if (isOpen && !initial) {
      setChannel(0);
      setLockToSelf(false);
    }
  }

  function validate(): WaypointInput | null {
    const latN = Number(lat);
    const lonN = Number(lon);
    if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
      setError('Latitude must be between -90 and 90');
      return null;
    }
    if (!Number.isFinite(lonN) || lonN < -180 || lonN > 180) {
      setError('Longitude must be between -180 and 180');
      return null;
    }
    if (name.length > 30) {
      setError('Name must be 30 characters or fewer');
      return null;
    }
    if (description.length > 100) {
      setError('Description must be 100 characters or fewer');
      return null;
    }
    let expire: number | null = null;
    if (hasExpiry) {
      const sec = localToExpireSeconds(expireLocal);
      if (!sec) {
        setError('Invalid expiration date/time');
        return null;
      }
      expire = sec;
    }
    let rebroadcastIntervalS: number | null = null;
    if (rebroadcast.trim().length > 0) {
      const minutes = Number(rebroadcast);
      if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 10) {
        setError('Rebroadcast interval must be at least 10 minutes');
        return null;
      }
      rebroadcastIntervalS = minutes * 60;
    }
    const geofenceFields = geofenceBody(geofence);
    if ('error' in geofenceFields) {
      setError(geofenceFields.error);
      return null;
    }
    return {
      lat: latN,
      lon: lonN,
      name: name.trim(),
      description: description.trim(),
      icon: emoji,
      expire,
      locked_to: lockToSelf && selfNodeNum != null ? selfNodeNum : null,
      virtual,
      channel,
      rebroadcast_interval_s: rebroadcastIntervalS,
      hop_limit: hopLimit === '' ? null : Number(hopLimit),
      ...geofenceFields,
    };
  }

  async function handleSave() {
    // #5649: a blank or out-of-range number field is never sent to the mesh.
    if (numberScope.invalid || sourceMissing) return;
    const input = validate();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(input);
      onClose();
    } catch (err) {
      setError((err as { message?: string } | null)?.message ?? 'Save failed');
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return {
    sourceMissing,
    deviceChannels,
    channelOptions,
    lat, setLat,
    lon, setLon,
    name, setName,
    description, setDescription,
    emoji, setEmoji,
    expireLocal, setExpireLocal,
    hasExpiry, setHasExpiry,
    lockToSelf, setLockToSelf,
    virtual, setVirtual,
    channel, setChannel,
    rebroadcast, setRebroadcast,
    hopLimit, setHopLimit,
    geofence, setGeofence,
    error,
    numberScope,
    saving,
    handleSave,
  };
}

export type WaypointEditorForm = ReturnType<typeof useWaypointEditorForm>;
