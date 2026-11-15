/**
 * WaypointEditorModal — create/edit dialog for waypoints.
 *
 * Wraps the shared `<Modal />` component for consistent overlay/escape/focus
 * behavior. In create mode pass `initial={null}` (or omit it); in edit mode
 * pass the existing waypoint and the dialog pre-fills.
 */
import Modal from './common/Modal';
import type { Waypoint, WaypointInput } from '../types/waypoint';
import './WaypointEditorModal.css';
import { UiIcon } from './icons';
import { useTranslation } from 'react-i18next';
import { HopLimitOverrideSelect } from './HopLimitOverrideSelect';
import { NumberInput } from './common/NumberInput';
import { NumberInputScope } from './common/NumberInputScope';
import PinSourcePicker, { type PinSourceChoice } from './map/PinSourcePicker';
import WaypointGeofenceFields from './WaypointGeofenceFields';
import { DEFAULT_EMOJIS, useWaypointEditorForm, type WaypointChannelOption } from './useWaypointEditorForm';

export type { WaypointChannelOption };

export interface WaypointEditorModalProps {
  isOpen: boolean;
  initial?: Waypoint | null;
  /**
   * Channels of the waypoint's own source. Slots above 7 (Channel Database
   * virtual channels) are ignored — the radio cannot transmit on them.
   */
  channels?: WaypointChannelOption[];
  /** Optional callback to enter map-pick mode for coordinates. */
  onPickLocation?: () => void;
  onClose: () => void;
  onSave: (input: WaypointInput) => Promise<void> | void;
  /** Local node's nodeNum, used when the user toggles "lock to me". */
  selfNodeNum?: number | null;
  /** Coordinates to seed when opening in create mode (e.g. from a map click). */
  defaultCoords?: { lat: number; lon: number } | null;
  /**
   * Which source sends the waypoint, for a surface with no implied source
   * (Map Analysis, #5685). Shown at the top of the form; Save stays off until
   * a source is chosen. `channels` and `selfNodeNum` must follow the choice.
   * Omitted on the Nodes map, where the active source sends.
   */
  sendingSource?: PinSourceChoice;
}

export default function WaypointEditorModal(props: WaypointEditorModalProps) {
  const { isOpen, initial, onPickLocation, onClose, selfNodeNum, sendingSource } = props;
  const { t } = useTranslation();
  const {
    sourceMissing, deviceChannels, channelOptions,
    lat, setLat, lon, setLon, name, setName, description, setDescription, emoji, setEmoji,
    expireLocal, setExpireLocal, hasExpiry, setHasExpiry, lockToSelf, setLockToSelf,
    virtual, setVirtual, channel, setChannel, rebroadcast, setRebroadcast, hopLimit, setHopLimit,
    geofence, setGeofence, error, numberScope, saving, handleSave,
  } = useWaypointEditorForm(props);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? 'Edit Waypoint' : 'New Waypoint'}
      maxWidth="500px"
      className="waypoint-editor-modal"
      >
        <NumberInputScope scope={numberScope}>
        <div className="waypoint-editor-form">
        {sendingSource && (
          <PinSourcePicker
            id="waypoint-sending-source"
            label={t('mapPins.waypointSourceLabel', 'Sending source')}
            placeholder={t('mapPins.chooseSource', 'Choose a source…')}
            hint={t(
              'mapPins.waypointSourceHint',
              "This source's radio broadcasts the waypoint to the mesh when you save. Nothing is sent before that.",
            )}
            hiddenNote={t(
              'mapPins.hiddenByFilter',
              'This source is not in the map\'s source filter, so the new pin will not show until you add it.',
            )}
            choice={sendingSource}
          />
        )}
        <div className="form-row">
          <label className="form-label">
            Latitude
            <NumberInput
              className="form-input"
              step={0.000001}
              min={-90}
              max={90}
              value={lat === '' ? null : Number(lat)}
              onChange={(v) => setLat(String(v))}
              showReason
            />
          </label>
          <label className="form-label">
            Longitude
            <NumberInput
              className="form-input"
              step={0.000001}
              min={-180}
              max={180}
              value={lon === '' ? null : Number(lon)}
              onChange={(v) => setLon(String(v))}
              showReason
            />
          </label>
        </div>
        {onPickLocation && (
          <button
            type="button"
            className="form-button form-button-secondary"
            onClick={onPickLocation}
          >
            <UiIcon name="location" size={15} /> Pick on map…
          </button>
        )}

        <label className="form-label">
          Name (≤29 bytes)
          <input
            className="form-input"
            type="text"
            maxLength={29}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Trailhead"
          />
        </label>

        <label className="form-label">
          Description (≤99 bytes)
          <textarea
            className="form-input"
            rows={2}
            maxLength={99}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <fieldset className="waypoint-editor-icon-group">
          <legend>Icon</legend>
          <div className="waypoint-editor-icon-row">
            {DEFAULT_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                className={`waypoint-editor-icon-pick${emoji === e ? ' selected' : ''}`}
              >
                {e}
              </button>
            ))}
            <input
              className="form-input waypoint-editor-icon-custom"
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
              aria-label="Custom emoji"
            />
          </div>
        </fieldset>

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={hasExpiry}
            onChange={(e) => setHasExpiry(e.target.checked)}
          />
          <span>Expires</span>
        </label>
        {hasExpiry && (
          <label className="form-label">
            Expire at
            <input
              className="form-input"
              type="datetime-local"
              value={expireLocal}
              onChange={(e) => setExpireLocal(e.target.value)}
            />
          </label>
        )}

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={lockToSelf}
            onChange={(e) => setLockToSelf(e.target.checked)}
            disabled={selfNodeNum == null}
          />
          <span>
            Lock to this node (
            {selfNodeNum != null ? `!${selfNodeNum.toString(16).padStart(8, '0')}` : 'unknown'})
          </span>
        </label>

        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={virtual}
            onChange={(e) => setVirtual(e.target.checked)}
          />
          <span>Virtual (do not broadcast)</span>
        </label>

        <label className="form-label">
          Channel
          <select
            className="form-input"
            value={channel}
            onChange={(e) => setChannel(Number(e.target.value))}
            disabled={virtual || deviceChannels.length === 0}
            aria-label="Broadcast channel"
          >
            {channelOptions.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name || `Channel ${ch.id}`}
                {ch.id === 0 ? ' (Primary)' : ''}
              </option>
            ))}
          </select>
          <span className="form-hint">
            {virtual
              ? 'Virtual waypoints are never transmitted, so the channel is unused.'
              : 'The waypoint and any rebroadcasts go out on this channel.'}
          </span>
        </label>

        <HopLimitOverrideSelect
          id="waypoint-hop-limit"
          value={hopLimit}
          onChange={setHopLimit}
          disabled={virtual}
          description={t(
            'waypoints.hop_limit.description',
            "How far this waypoint may travel. Blank uses the node's own hop limit. Capped at the node's own hop limit, so it can only shorten reach, never extend it. 0 keeps it to nodes that hear this radio directly.",
          )}
          warning={virtual ? undefined : t(
            'waypoints.hop_limit.warning',
            'Every node within this many hops rebroadcasts the waypoint. On a 30-node mesh at 3 hops one send is about 30 transmissions. Use the lowest value that reaches the area you need.',
          )}
        />

        <label className="form-label">
          Rebroadcast every (minutes, optional)
          <NumberInput
            className="form-input"
            allowEmpty
            integer
            min={10}
            step={1}
            value={rebroadcast.trim() === '' ? null : Number(rebroadcast)}
            onChange={(v) => setRebroadcast(v === null ? '' : String(v))}
          />
          <span className="form-hint">
            Minimum 10 minutes. The scheduler rebroadcasts at most one waypoint per minute across the whole mesh.
          </span>
          {rebroadcast.trim().length > 0 && (
            <span className="waypoint-rebroadcast-warning" role="note">
              <UiIcon name="alert" size={14} /> Android clients notify on every
              rebroadcast, so repeat broadcasts can spam users in range. Leave
              this blank unless the waypoint really needs to stay refreshed.
            </span>
          )}
        </label>

        <WaypointGeofenceFields
          value={geofence}
          onChange={setGeofence}
          center={
            lat !== '' && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
              ? { lat: Number(lat), lon: Number(lon) }
              : null
          }
        />

        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}

        <div className="waypoint-editor-actions">
          <button
            type="button"
            className="form-button form-button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="form-button form-button-primary"
            onClick={handleSave}
              disabled={saving || numberScope.invalid || sourceMissing}
            >
            {saving ? 'Saving…' : initial ? 'Save' : 'Create'}
          </button>
              </div>
            </div>
            </NumberInputScope>
          </Modal>
  );
}
