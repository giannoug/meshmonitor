/**
 * One channel (boards 12-02 desktop, 12-15 phone), `/settings/channels/<slot>`:
 * today's channel card editor on the row kit, with today's checks (11-character
 * name, key lengths 0 / 1 / 16 / 32 bytes, never two primaries, AEAD from
 * firmware 2.8.1 with a key, asking first).
 *
 * A channel saves on its own, as today: one set_channel write for this slot
 * (useChannelActions), from the page's dock ("1 change in Channels", Discard,
 * Review, Save to device), never through the radio queue (Ruling 5.5). The dock
 * claims the frame's, so the radio bar yields; leaving with edits asks first
 * (the leave guard lists the slot, 17-02). A free slot opens as a new channel.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import {
  MAX_NAME_LENGTH,
  PSK_ALLOWED_BYTES,
  PSK_GENERATE_BYTES,
  ROLE_LABEL_KEYS,
  draftsEqual,
  isConfigured,
  openDraft,
  roleOptions,
  useChannelActions,
  useChannelBySlot,
  type ChannelDraft,
} from '../../../components/configuration/channelSlots';
import { channelKeyByteLength, generateChannelKey, isValidChannelKey } from '../../../components/shared/config/channelKey';
import { useSettings } from '../../../contexts/SettingsContext';
import { useSource } from '../../../contexts/SourceContext';
import type { Channel } from '../../../types/device';
import { formatPrecisionAccuracy } from '../../../utils/distance';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import SettingGroup from '../kit/SettingGroup';
import SettingNumber from '../kit/SettingNumber';
import SettingRow from '../kit/SettingRow';
import SettingSelect from '../kit/SettingSelect';
import SettingText from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../kit/useFieldRegistry';
import ImportJsonSheet from './ImportJsonSheet';
import { useRemoteTarget } from '../remote/useRemoteTarget';
import { useClaimDock, usePendingEdit, useSettingsHeader } from '../settingsDock';
import { useRadioSaveQueue } from '../useRadioSaveQueue';
import styles from './SettingsPages.module.css';
import bar from '../RadioSaveBar.module.css';

export interface ChannelEditPageProps {
  base: string;
  sourceId: string;
  slot: number;
  channels: Channel[];
  /** The node's firmware supports AEAD channels (2.8.1+, #5248): today's gate. */
  aeadSupported: boolean;
  onChannelsUpdated(): void;
  /** A remote node's writes (Task 5.9) in place of this radio's. */
  remote?: { actions: ReturnType<typeof useChannelActions>; sends: string };
}

/** Each draft value and today's label for it, in the editor's order. */
const FIELDS: Array<[keyof ChannelDraft, string]> = [
  ['name', 'channels_config.channel_name'],
  ['psk', 'channels_config.psk'],
  ['role', 'channels_config.channel_role'],
  ['positionPrecision', 'channels_config.position_precision'],
  ['uplinkEnabled', 'channels_config.uplink_enabled'],
  ['downlinkEnabled', 'channels_config.downlink_enabled'],
  ['useAead', 'channels_config.aead_label'],
];
// Today's editor generates 32 bytes; a 1-byte key is an index into the public default key, never a secret (Ruling 5.5 I1).
const KEY_SIZES = [16, 32];

export default function ChannelEditPage({ base, sourceId, slot, channels, aeadSupported, onChannelsUpdated, remote }: ChannelEditPageProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  const { sourceName } = useSource();
  const { distanceUnit } = useSettings();
  const numbersInvalid = useRadioSaveQueue()?.invalid ?? false;
  const remoteNode = useRemoteTarget()?.node;
  const local = useChannelActions(sourceId);
  const actions = remote?.actions ?? local;
  const sends = remote?.sends ?? t('workspace.settings.savebar.sends_nothing');
  const bySlot = useChannelBySlot(channels);
  const channel = bySlot.get(slot);
  const [edit, setEdit] = useState(() => openDraft(slot, !isConfigured(channel), channel));
  const [keySize, setKeySize] = useState(() => {
    const len = channelKeyByteLength(edit.draft.psk, 'base64');
    return len && KEY_SIZES.includes(len) ? len : PSK_GENERATE_BYTES;
  });
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<'review' | 'aead' | 'delete' | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [importing, setImporting] = useState(false);
  const { draft, original, isNew } = edit;

  const changed = FIELDS.filter(([k]) => draft[k] !== original[k]);
  const dirty = isNew || !draftsEqual(draft, original);
  const name = original.name || t('channels_config.unnamed');
  const title = isNew ? t('channels_config.new_channel') : `${t('channels_config.slot', { slot })} · ${name}`;
  const update = (patch: Partial<ChannelDraft>) => setEdit((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  const discard = () => setEdit((prev) => ({ ...prev, draft: prev.original }));

  useSettingsHeader({
    title,
    phoneTitle: isNew ? title : name,
    back: { to: base, label: t('channels.title') },
    scope: t('workspace.settings.channels.edit_scope', { slot, device: remoteNode?.longName ?? sourceName }),
  });
  useClaimDock(dirty && !readOnly);
  usePendingEdit(
    dirty && !readOnly
      ? { scope: `${base}/${slot}`, title, changes: isNew ? [] : changed.map(([, label]) => t(label)), note: isNew ? t('workspace.settings.channels.new_not_saved') : undefined, discard }
      : null,
  );

  const keyValid = isValidChannelKey(draft.psk, 'base64', PSK_ALLOWED_BYTES);
  const hasKey = draft.psk !== '';
  const aeadOff = !draft.useAead && !(aeadSupported && hasKey);
  const aeadReason = !aeadSupported ? t('channels_config.aead_needs_firmware') : !hasKey ? t('channels_config.aead_needs_key') : null;
  const allowed = roleOptions(channels, edit);
  const was = (key: keyof ChannelDraft) => (!isNew && draft[key] !== original[key] ? format(key, original[key]) : undefined);
  function format(key: keyof ChannelDraft, value: unknown): string {
    if (key === 'psk') return value ? '••••••••' : '—';
    if (key === 'role') return t(ROLE_LABEL_KEYS[value as number]);
    if (typeof value === 'boolean') return t(value ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off');
    return String(value);
  }

  const save = async () => {
    if (!keyValid || saving) return;
    setSheet(null);
    setSaving(true);
    const ok = await actions.save(edit);
    setSaving(false);
    if (ok) {
      onChannelsUpdated();
      void navigate(base);
    }
  };
  const remove = async () => {
    setSheet(null);
    if (await actions.remove(slot)) {
      onChannelsUpdated();
      void navigate(base);
    }
  };

  const keyRow = (
    <SettingRow
      id="channel.psk"
      label={t('channels_config.psk')}
      help={
        <>
          {t('channels_config.psk_description')}
          {!keyValid && <span className={styles.error} role="alert">{t('channels_config.psk_invalid')}</span>}
        </>
      }
      was={was('psk')}
    >
      <KeyField value={draft.psk} shown={showKey} onShow={() => setShowKey((v) => !v)} onChange={(psk) => update({ psk })} onGenerate={() => update({ psk: generateChannelKey(keySize, 'base64') })} />
    </SettingRow>
  );

  // A remote slot's JSON and delete are this radio's only (Admin Commands disables a remote slot through its role).
  const json = !isNew && !remote && (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{t('workspace.settings.channels.json')}</span>
      <span className={styles.inline}>
        <button type="button" className={styles.button} disabled={readOnly} onClick={() => void actions.exportJson(slot)}>
          <UiIcon name="download" size={16} /> {t('common.export')}
        </button>
        <button type="button" className={styles.button} disabled={readOnly} onClick={() => setImporting(true)}>
          <UiIcon name="upload" size={16} /> {t('common.import')}
        </button>
      </span>
    </div>
  );

  return (
    <>
      <SettingGroup title={t('workspace.settings.channels.channel')}>
        <SettingRow id="channel.name" label={t('channels_config.channel_name')} help={t('channels_config.channel_name_description')} was={was('name')}>
          <SettingText value={draft.name} onChange={(v) => update({ name: v })} maxLength={MAX_NAME_LENGTH} placeholder={t('channels_config.channel_name_placeholder')} />
        </SettingRow>
        {keyRow}
        <SettingRow id="channel.keySize" label={t('workspace.settings.channels.key_size')} help={t('workspace.settings.channels.key_size_help')}>
          <SettingSelect
            value={String(keySize)}
            onChange={(v) => setKeySize(Number(v))}
            options={KEY_SIZES.map((n) => ({ value: String(n), label: t('workspace.settings.channels.bytes', { count: n }) }))}
          />
        </SettingRow>
        <SettingRow id="channel.role" label={t('channels_config.channel_role')} help={t('channels_config.channel_role_description')} was={was('role')}>
          <SettingSelect
            value={String(draft.role)}
            onChange={(v) => update({ role: Number(v) })}
            options={[1, 2, 0].map((r) => ({ value: String(r), label: t(ROLE_LABEL_KEYS[r]), disabled: !allowed.includes(r) }))}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.channels.position_mqtt')}>
        <SettingRow
          id="channel.positionPrecision"
          label={t('channels_config.position_precision')}
          help={
            <>
              {t('channels_config.position_precision_description')}
              <span className={styles.block}>{t('channels_config.estimated_accuracy', { accuracy: formatPrecisionAccuracy(draft.positionPrecision, distanceUnit) })}</span>
            </>
          }
          was={was('positionPrecision')}
        >
          <SettingNumber value={draft.positionPrecision} min={0} max={32} onChange={(v) => update({ positionPrecision: v })} />
        </SettingRow>
        <SettingRow id="channel.uplink" label={t('channels_config.uplink_enabled')} help={t('channels_config.uplink_description')} was={was('uplinkEnabled')}>
          <SettingToggle checked={draft.uplinkEnabled} onChange={(v) => update({ uplinkEnabled: v })} />
        </SettingRow>
        <SettingRow id="channel.downlink" label={t('channels_config.downlink_enabled')} help={t('channels_config.downlink_description')} was={was('downlinkEnabled')}>
          <SettingToggle checked={draft.downlinkEnabled} onChange={(v) => update({ downlinkEnabled: v })} />
        </SettingRow>
        <SettingRow
          id="channel.aead"
          label={t('channels_config.aead_label')}
          help={
            <>
              <strong>{t('channels_config.aead_warning_title')}</strong> {t('channels_config.aead_warning_body')}
              {aeadOff && aeadReason && <span className={styles.block}>{aeadReason}</span>}
              <span className={styles.block}>{t('workspace.settings.channels.aead_asks')}</span>
            </>
          }
          was={was('useAead')}
        >
          <SettingToggle checked={draft.useAead} readOnly={aeadOff || readOnly} onChange={(on) => (on ? setSheet('aead') : update({ useAead: false }))} />
        </SettingRow>
        {json}
      </SettingGroup>

      {!isNew && !remote && slot > 0 && (
        <DangerZone title={t('config.danger_zone')}>
          <div className={styles.infoRow}>
            <span className={styles.infoText}>
              <span className={styles.infoLabel}>{t('channels_config.delete_confirm')}</span>
              <span className={styles.infoHelp}>{t('workspace.settings.channels.delete_help', { slot })}</span>
              <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
            </span>
            <button type="button" className={`${styles.button} ${styles.dangerButton}`} disabled={readOnly} onClick={() => setSheet('delete')}>
              {t('channels_config.delete_confirm')}
            </button>
          </div>
        </DangerZone>
      )}

      {dirty && !readOnly && (
        <>
          {isPhone && <div className={bar.spacer} aria-hidden="true" />}
          <section className={bar.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.channels.dock_label')}>
            <div className={bar.row}>
              <UiIcon name="refresh" size={22} className={bar.icon} />
              <div className={bar.text}>
                <span className={bar.title}>
                  {isNew
                    ? t('channels_config.new_channel')
                    : t(isPhone ? 'workspace.settings.savebar.changes_short' : 'workspace.settings.savebar.changes_in', { count: changed.length, names: t('channels.title') })}
                </span>
                <span className={bar.sub}>{remote ? remote.sends : t('workspace.settings.channels.dock_sub')}</span>
              </div>
              {!isPhone && (
                <>
                  <button type="button" className={bar.plain} onClick={isNew ? () => void navigate(base) : discard} disabled={saving}>
                    {t('workspace.settings.savebar.discard')}
                  </button>
                  <button type="button" className={bar.secondary} onClick={() => setSheet('review')} disabled={isNew}>
                    {t('workspace.settings.savebar.review')}
                  </button>
                </>
              )}
              {!isPhone && <SaveButton saving={saving} disabled={!keyValid || numbersInvalid} onSave={save} />}
            </div>
            {isPhone && (
              <div className={bar.buttons}>
                <button type="button" className={bar.secondary} onClick={() => setSheet('review')} disabled={isNew}>
                  {t('workspace.settings.savebar.review')}
                </button>
                <SaveButton saving={saving} disabled={!keyValid || numbersInvalid} onSave={save} />
              </div>
            )}
            <SendsLine>{sends}</SendsLine>
            {numbersInvalid && <p className={bar.error}>{t('savebar.fix_invalid_fields')}</p>}
          </section>
        </>
      )}

      <Sheet
        open={sheet === 'review'}
        onClose={() => setSheet(null)}
        title={t('workspace.settings.review.title')}
        footer={
          <div className={bar.buttons}>
            <button type="button" className={bar.secondary} onClick={() => setSheet(null)}>{t('config_item_card.keep_editing')}</button>
            <SaveButton saving={saving} disabled={!keyValid || numbersInvalid} onSave={save} />
          </div>
        }
      >
        <section className={bar.card} aria-label={title}>
          <header className={bar.cardHead}>
            <h3 className={bar.cardTitle}>{title}</h3>
            <button type="button" className={bar.plain} onClick={() => { discard(); setSheet(null); }}>{t('workspace.settings.savebar.discard')}</button>
          </header>
          <ul className={bar.changes}>
            {changed.map(([k, label]) => (
              <li key={k} className={bar.change}>
                <span className={bar.field}>{t(label)}</span>
                <del className={bar.from}>{format(k, original[k])}</del>
                <UiIcon name="forward" size={18} className={bar.arrow} />
                <span className={bar.to}>{format(k, draft[k])}</span>
              </li>
            ))}
          </ul>
        </section>
      </Sheet>
      <ImportJsonSheet
        slot={importing ? slot : null}
        sourceId={sourceId}
        onClose={() => setImporting(false)}
        onImported={() => {
          onChannelsUpdated();
          void navigate(base);
        }}
      />
      <ConfirmSheet
        open={sheet === 'aead'}
        title={t('channels_config.aead_confirm_title')}
        body={<><strong>{t('channels_config.aead_warning_title')}</strong> {t('channels_config.aead_warning_body')}</>}
        confirmLabel={t('channels_config.aead_confirm')}
        onConfirm={() => {
          update({ useAead: true });
          setSheet(null);
        }}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        open={sheet === 'delete'}
        title={t('channels_config.delete_title', { slot })}
        body={
          <>
            <p className={styles.para}>{t('channels_config.delete_message')}</p>
            <p className={styles.para}><strong>{name}</strong></p>
            <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
          </>
        }
        confirmLabel={t('channels_config.delete_confirm')}
        danger
        submitOnEnter={false}
        onConfirm={() => void remove()}
        onCancel={() => setSheet(null)}
      />
    </>
  );
}

function SaveButton({ saving, disabled, onSave }: { saving: boolean; disabled: boolean; onSave(): Promise<void> }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={bar.save} onClick={() => void onSave()} disabled={saving || disabled} aria-busy={saving || undefined}>
      <UiIcon name="save" size={16} /> {saving ? t('common.saving') : t('channels_config.save_to_device')}
    </button>
  );
}

/** The key: masked until Show, with Copy and Generate (a new random key of the chosen size), as today's ChannelKeyField. */
function KeyField({ value, shown, onShow, onChange, onGenerate }: { value: string; shown: boolean; onShow(): void; onChange(v: string): void; onGenerate(): void }) {
  const { t } = useTranslation();
  const row = useSettingRow();
  const readOnly = useReadOnly();
  return (
    <span className={styles.inline}>
      <input
        id={row?.inputId}
        aria-describedby={row?.helpId}
        type={shown ? 'text' : 'password'}
        className={styles.keyInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('channels_config.psk_placeholder')}
        aria-invalid={!isValidChannelKey(value, 'base64', PSK_ALLOWED_BYTES) || undefined}
        disabled={readOnly}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="button" className={styles.button} onClick={onShow} aria-pressed={shown}>
        <UiIcon name={shown ? 'visibilityOff' : 'visibility'} size={16} /> {t(shown ? 'channel_key.hide' : 'channel_key.show')}
      </button>
      <button type="button" className={styles.button} onClick={() => void navigator.clipboard?.writeText(value)} disabled={!value}>
        <UiIcon name="copy" size={16} /> {t('channel_key.copy')}
      </button>
      <button type="button" className={styles.button} onClick={onGenerate} disabled={readOnly}>
        <UiIcon name="refresh" size={16} /> {t('channel_key.generate')}
      </button>
    </span>
  );
}
