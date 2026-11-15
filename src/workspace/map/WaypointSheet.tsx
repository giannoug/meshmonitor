/**
 * The waypoint editor and its delete confirm (boards 15-07, 15-13, 15-23;
 * s15n1, s15n2). The editor is WaypointEditorModal's form
 * (useWaypointEditorForm: the same fields, checks and save), a right sheet
 * from 768 px and a bottom sheet below, with its geofence inline on desktop
 * and as a step on phone (GeofencePage). Delete is a plain confirm with
 * today's broadcast words and the sending source.
 *
 * Airtime (today's server behaviour, unchanged): Save sends 1 waypoint on its
 * channel within its hop limit; a rebroadcast interval (at least 10 minutes,
 * refused below that here and by the server) repeats it from the server's
 * scheduler, which sends at most one waypoint a minute; Virtual sends nothing;
 * Delete sends 1 delete on the waypoint's channel. Enter in a field sends
 * nothing: only the button does.
 */
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HopLimitOverrideSelect } from '../../components/HopLimitOverrideSelect';
import { NumberInput } from '../../components/common/NumberInput';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import PinSourcePicker from '../../components/map/PinSourcePicker';
import { UiIcon } from '../../components/icons';
import {
  DEFAULT_EMOJIS,
  useWaypointEditorForm,
  type WaypointChannelOption,
} from '../../components/useWaypointEditorForm';
import type { Waypoint, WaypointInput } from '../../types/waypoint';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import GeofencePage, { GeofenceRow } from './GeofencePage';
import styles from './WaypointSheet.module.css';

/** A channel's name as the editor's picker shows it. */
const channelName = (channels: WaypointChannelOption[], id: number) =>
  channels.find((c) => c.id === id)?.name || `Channel ${id}`;

export interface WaypointSheetProps {
  open: boolean;
  sourceId: string;
  sourceName: string;
  /** The waypoint being edited; null for a new one at `defaultCoords`. */
  initial: Waypoint | null;
  defaultCoords: { lat: number; lon: number } | null;
  channels: WaypointChannelOption[];
  selfNodeNum: number | null;
  onClose(): void;
  onSave(input: WaypointInput): Promise<void>;
}

export default function WaypointSheet(p: WaypointSheetProps) {
  const { t } = useTranslation();
  const id = useId();
  const isPhone = useIsPhone();
  const form = useWaypointEditorForm({
    isOpen: p.open,
    initial: p.initial,
    channels: p.channels,
    onClose: p.onClose,
    onSave: p.onSave,
    selfNodeNum: p.selfNodeNum,
    defaultCoords: p.defaultCoords,
    sendingSource: { options: [{ id: p.sourceId, name: p.sourceName }], value: p.sourceId },
  });
  // The phone's Geofence step (15-24); every open starts on the form.
  const [step, setStep] = useState<'form' | 'geofence'>('form');
  useEffect(() => {
    if (p.open) setStep('form');
  }, [p.open]);

  const title = t(p.initial ? 'workspace.waypoint.edit_title' : 'workspace.waypoint.new_title');
  const center = form.lat !== '' && form.lon !== '' && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lon))
    ? { lat: Number(form.lat), lon: Number(form.lon) }
    : null;
  const sends = form.virtual
    ? t('workspace.node_dialogs.override_sends')
    : t('workspace.waypoint.sends', { channel: channelName(form.channelOptions, form.channel) }) +
      (form.hopLimit !== '' ? t('workspace.waypoint.sends_hops', { hops: form.hopLimit }) : '') +
      (form.rebroadcast.trim() ? t('workspace.waypoint.sends_repeat', { minutes: form.rebroadcast.trim() }) : '');
  const geofence = isPhone && step === 'geofence';

  return (
    <ConfirmSheet
      open={p.open}
      title={geofence ? t('waypoints.geofence.legend') : title}
      confirmLabel={form.saving ? t('common.saving') : t(p.initial ? 'common.save' : 'common.create')}
      busy={form.saving}
      confirmDisabled={form.numberScope.invalid || form.sourceMissing}
      submitOnEnter={false}
      onCancel={p.onClose}
      onConfirm={form.handleSave}
      body={
        <NumberInputScope scope={form.numberScope}>
          {geofence ? (
            <div className={styles.form}>
              <GeofencePage value={form.geofence} onChange={form.setGeofence} center={center} onDone={() => setStep('form')} backLabel={title} />
            </div>
          ) : (
            <div className={styles.form}>
              <PinSourcePicker
                id={`${id}-source`}
                label={t('mapPins.waypointSourceLabel')}
                placeholder={t('mapPins.chooseSource')}
                hint={t('mapPins.waypointSourceHint')}
                hiddenNote={t('mapPins.hiddenByFilter')}
                choice={{ options: [{ id: p.sourceId, name: p.sourceName }], value: p.sourceId }}
              />
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('localMarkers.latitude')}</span>
                  <NumberInput className={styles.input} step={0.000001} min={-90} max={90}
                    value={form.lat === '' ? null : Number(form.lat)} onChange={(v) => form.setLat(String(v))} showReason />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('localMarkers.longitude')}</span>
                  <NumberInput className={styles.input} step={0.000001} min={-180} max={180}
                    value={form.lon === '' ? null : Number(form.lon)} onChange={(v) => form.setLon(String(v))} showReason />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('workspace.waypoint.name')}</span>
                  <input className={styles.input} type="text" maxLength={29} value={form.name}
                    onChange={(e) => form.setName(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('workspace.waypoint.description')}</span>
                  <textarea className={styles.input} rows={1} maxLength={99} value={form.description}
                    onChange={(e) => form.setDescription(e.target.value)} />
                </label>
              </div>
              <fieldset className={styles.icons}>
                <legend className={styles.label}>{t('localMarkers.icon')}</legend>
                {DEFAULT_EMOJIS.map((e) => (
                  <button key={e} type="button" className={styles.iconPick} aria-pressed={form.emoji === e} onClick={() => form.setEmoji(e)}>
                    {e}
                  </button>
                ))}
                <input className={`${styles.input} ${styles.custom}`} type="text" value={form.emoji}
                  onChange={(e) => form.setEmoji(e.target.value.slice(0, 4))} aria-label={t('workspace.waypoint.custom_emoji')} />
              </fieldset>
              <div className={styles.row}>
                <label className={styles.check}>
                  <input type="checkbox" checked={form.hasExpiry} onChange={(e) => form.setHasExpiry(e.target.checked)} />
                  {t('workspace.waypoint.expires')}
                </label>
                {form.hasExpiry && (
                  <label className={styles.field}>
                    <span className={styles.label}>{t('workspace.waypoint.expire_at')}</span>
                    <input className={styles.input} type="datetime-local" value={form.expireLocal}
                      onChange={(e) => form.setExpireLocal(e.target.value)} />
                  </label>
                )}
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={form.lockToSelf} onChange={(e) => form.setLockToSelf(e.target.checked)} disabled={p.selfNodeNum == null} />
                {t('workspace.waypoint.lock', {
                  node: p.selfNodeNum != null ? `!${p.selfNodeNum.toString(16).padStart(8, '0')}` : t('common.unknown'),
                })}
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={form.virtual} onChange={(e) => form.setVirtual(e.target.checked)} />
                {t('workspace.waypoint.virtual')}
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t('node_details.channel')}</span>
                <select className={styles.input} value={form.channel} onChange={(e) => form.setChannel(Number(e.target.value))}
                  disabled={form.virtual || form.deviceChannels.length === 0} aria-label={t('workspace.waypoint.channel_aria')}>
                  {form.channelOptions.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {channelName(form.channelOptions, ch.id)}
                      {ch.id === 0 ? ` (${t('channels.primary')})` : ''}
                    </option>
                  ))}
                </select>
                <span className={styles.hint}>
                  {t(form.virtual ? 'workspace.waypoint.channel_hint_virtual' : 'workspace.waypoint.channel_hint')}
                </span>
              </label>
              <HopLimitOverrideSelect
                id={`${id}-hops`}
                value={form.hopLimit}
                onChange={form.setHopLimit}
                disabled={form.virtual}
                description={t('waypoints.hop_limit.description')}
                warning={form.virtual ? undefined : t('waypoints.hop_limit.warning')}
              />
              <label className={styles.field}>
                <span className={styles.label}>{t('workspace.waypoint.rebroadcast')}</span>
                <NumberInput className={styles.input} allowEmpty integer min={10} step={1}
                  value={form.rebroadcast.trim() === '' ? null : Number(form.rebroadcast)}
                  onChange={(v) => form.setRebroadcast(v === null ? '' : String(v))} />
                <span className={styles.hint}>{t('workspace.waypoint.rebroadcast_hint')}</span>
                {form.rebroadcast.trim().length > 0 && (
                  <span className={styles.warning} role="note">
                    <UiIcon name="alert" size={14} /> {t('workspace.waypoint.android_warning')}
                  </span>
                )}
              </label>
              {isPhone ? (
                <GeofenceRow value={form.geofence} onOpen={() => setStep('geofence')} />
              ) : (
                <GeofencePage value={form.geofence} onChange={form.setGeofence} center={center} />
              )}
              {form.error && <p className={styles.error} role="alert">{form.error}</p>}
              <SendsLine>{sends}</SendsLine>
            </div>
          )}
        </NumberInputScope>
      }
    />
  );
}

export interface DeleteWaypointSheetProps {
  waypoint: Waypoint | null;
  sourceName: string;
  channels: WaypointChannelOption[];
  onClose(): void;
  onDelete(waypoint: Waypoint): Promise<unknown>;
}

/** Delete waypoint (15-08, 15-23): today's words and source, a Sends line, no typed word. */
export function DeleteWaypointSheet({ waypoint, sourceName, channels, onClose, onDelete }: DeleteWaypointSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!waypoint) return null;
  const label = waypoint.name || `Waypoint ${waypoint.waypointId}`;
  const sends = waypoint.isVirtual
    ? t('workspace.node_dialogs.override_sends')
    : t('workspace.waypoint.delete_sends', { channel: channelName(channels, waypoint.channel ?? 0) }) +
      (waypoint.hopLimit != null ? t('workspace.waypoint.sends_hops', { hops: waypoint.hopLimit }) : '');
  return (
    <ConfirmSheet
      open
      danger
      title={
        <span className={styles.dangerTitle}>
          <UiIcon name="alert" size={20} />
          {t('workspace.waypoint.delete_title', { label })}
        </span>
      }
      body={
        <div className={styles.confirmBody}>
          {!waypoint.isVirtual && (
            <>
              <p>{t('workspace.waypoint.delete_body', { source: sourceName })}</p>
              <ul className={styles.effects}><li>{t('workspace.waypoint.delete_effect')}</li></ul>
            </>
          )}
          <SendsLine>{sends}</SendsLine>
        </div>
      }
      confirmLabel={t('common.delete')}
      busy={busy}
      submitOnEnter={false}
      onCancel={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          await onDelete(waypoint);
          onClose();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** The waypoint popup's actions on the Workspace map: a waypoint locked to another node shows today's reason, with Edit and Delete off. */
export function WaypointPopupFooter({ locked, onEdit, onDelete }: { locked: boolean; onEdit(): void; onDelete(): void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.popup}>
      {locked && (
        <p className={styles.locked}>
          <UiIcon name="encrypted" size={14} /> {t('mapPins.lockedToOther')}
        </p>
      )}
      <div className={styles.popupButtons}>
        <button type="button" className={styles.popupButton} disabled={locked} onClick={onEdit}>
          <UiIcon name="edit" size={14} /> {t('common.edit')}
        </button>
        <button type="button" className={`${styles.popupButton} ${styles.popupDanger}`} disabled={locked} onClick={onDelete}>
          <UiIcon name="delete" size={14} /> {t('workspace.waypoint.delete')}
        </button>
      </div>
    </div>
  );
}
