/**
 * Settings › Channels (boards 8-09, 8-26): the radio's channel slots, on
 * today's requests (MeshCoreChannelsConfigSection's): the list is today's
 * `/api/channels/all` (shared with the sidebar), a save is one
 * `PUT /api/channels/:idx`, a delete or Reset to Public one
 * `DELETE /api/channels/:idx`, each once per press. They write the radio over
 * its connection and send nothing on the mesh.
 *
 * - A table of slots (Slot, Name with its kind tag, Region / Scope, Share,
 *   Edit, Delete) and the free slots; on the phone, rows with Share, a row
 *   opens its editor.
 * - Add channel / Edit: Hashtag (the key comes from the name, re-derived on
 *   save as today, #3607), Secret (32 hex chars, Generate) or Import from URL
 *   (today's decode and import requests). Slot 0 is Public and has no editor.
 * - Share: today's server-built `meshcore://` URL, its QR and Copy URL, docked
 *   beside the table (desktop) or in a sheet (phone).
 * - Reorder slots on device: today's reorder panel.
 * - Danger zone: Reset slot 0 to Public, confirmed with what it removes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { QrCodeCanvas } from '../../../components/common/QrCodeCanvas';
import { MeshCoreChannelReorderPanel } from '../../../components/MeshCore/MeshCoreChannelReorderPanel';
import { base64ToHex, generateChannelKey, hexToBase64, isValidChannelKey } from '../../../components/shared/config/channelKey';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import LeaveGuard from '../../settings/LeaveGuard';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { appBasename } from '../../../init';
import apiService from '../../../services/api';
import { deriveHashtagSecretHex, formatMeshCoreChannelName, isHashtagChannelName } from '../../../utils/meshcoreHelpers';
import { meshcoreChannelKind } from '../../../utils/meshcoreChannelKind';
import { MESHCORE_DEFAULT_MAX_CHANNELS, lowestFreeMeshcoreSlot, maskMeshcoreSecret } from '../../../utils/meshcoreChannelUrl';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import type { CategoryProps } from '../../settings/categories';
import { useReadOnly } from '../../settings/kit/useFieldRegistry';
import { useSettingsHeader } from '../../settings/settingsDock';
import { useIsPhone } from '../../shell/useIsPhone';
import { channelsQuery, mcKeys } from '../useMeshCoreLists';
import type { McChannelRow } from '../meshcoreLabels';
import { DeviceNotes, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

const SECRET_BYTES = 16;
const MAX_NAME_BYTES = 31;
const PUBLIC_SLOT = 0;

type Mode = 'hashtag' | 'secret' | 'url';
interface Editing {
  idx: number;
  isNew: boolean;
  mode: Mode;
  name: string;
  secretHex: string;
  scope: string;
}

/** "9f3a…c210" (board 8-09): enough to tell two keys apart, never the whole secret. */
const shortKey = (hex: string) => `${hex.slice(0, 4)}…${hex.slice(-4)}`;

/** Slot 0 already reads as the stock Public channel, so a reset would only cost a device write. */
const isStockPublic = (row: McChannelRow) => ['', 'public'].includes(row.name.trim().toLowerCase());

export default function ChannelsCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const d = useMcDevice();
  const off = useReadOnly(readOnly) || !d.connected || !d.canWriteConfig;
  const queryClient = useQueryClient();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const list = useQuery(channelsQuery(sourceId, d.connected));
  const rows = (list.data ?? []).filter((c) => !c.virtual);
  const max = d.local?.maxChannels ?? MESHCORE_DEFAULT_MAX_CHANNELS;
  const nextFree = lowestFreeMeshcoreSlot(rows.map((c) => c.id), max);
  const reload = useCallback(() => void queryClient.invalidateQueries({ queryKey: mcKeys.channels(sourceId) }), [queryClient, sourceId]);
  useSettingsHeader({ scope: t('workspace.meshcore.settings.channels_scope', { used: rows.length, total: max }) });

  const [editing, setEditing] = useState<Editing | null>(null);
  // The editor as it opened: a draft that differs is guarded on leaving (LeaveGuard).
  const [start, setStart] = useState<Editing | null>(null);
  const { pathname } = useLocation();
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [shareIdx, setShareIdx] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<McChannelRow | null>(null);
  const [savedRegions, setSavedRegions] = useState<string[]>([]);

  // Today's scope suggestions (the saved-regions catalogue): a local read.
  useEffect(() => {
    let cancelled = false;
    void apiService
      .get<{ success?: boolean; regions?: Array<{ name: string }> }>(`/api/sources/${encodeURIComponent(sourceId)}/meshcore/saved-regions`)
      .then((b) => !cancelled && setSavedRegions((b?.regions ?? []).map((r) => String(r.name)).filter(Boolean)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  // A hashtag name derives its key as typed (today's live derive).
  const hashName = editing?.mode === 'hashtag' ? editing.name.trim() : '';
  useEffect(() => {
    if (!isHashtagChannelName(hashName)) return;
    let cancelled = false;
    void deriveHashtagSecretHex(hashName).then((hex) => !cancelled && setEditing((e) => (e ? { ...e, secretHex: hex } : e))).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hashName]);

  const startAdd = () => {
    if (nextFree === null) return showToast(t('meshcore.channels.no_free_slot', 'No free channel slot. Delete a channel first.'), 'error');
    setReordering(false);
    const e: Editing = { idx: nextFree, isNew: true, mode: 'hashtag', name: '#', secretHex: generateChannelKey(SECRET_BYTES, 'hex'), scope: '' };
    setEditing(e);
    setStart(e);
  };
  const startEdit = (row: McChannelRow) => {
    const e: Editing = {
      idx: row.id,
      isNew: false,
      mode: isHashtagChannelName(row.name) ? 'hashtag' : 'secret',
      name: row.name,
      secretHex: base64ToHex(row.psk),
      scope: row.scope ?? '',
    };
    setEditing(e);
    setStart(e);
  };
  // The fields the draft changed, by today's labels (the leave guard lists them).
  const fieldLabels: Array<[keyof Editing, string]> = [
    ['name', t('meshcore.channels.name_label')],
    ['secretHex', t('meshcore.channels.secret_label')],
    ['scope', t('meshcore.channels.scope_label')],
  ];
  const changedFields = editing && start ? fieldLabels.filter(([k]) => editing[k] !== start[k]).map(([, label]) => label) : [];
  const dirty = !!editing && (editing.isNew || changedFields.length > 0);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (new TextEncoder().encode(name).length > MAX_NAME_BYTES) {
      return showToast(t('meshcore.channels.name_too_long', 'Channel name must be {{max}} bytes or less', { max: MAX_NAME_BYTES }), 'error');
    }
    // A hashtag key is re-derived at save time, so a quick save never stores the placeholder (#3607).
    let secretHex = editing.secretHex;
    if (isHashtagChannelName(name)) {
      try {
        secretHex = await deriveHashtagSecretHex(name);
      } catch {
        return showToast(t('meshcore.channels.invalid_secret', 'Secret must be exactly 32 hex characters (16 bytes)'), 'error');
      }
    }
    if (!isValidChannelKey(secretHex, 'hex', [SECRET_BYTES])) {
      return showToast(t('meshcore.channels.invalid_secret', 'Secret must be exactly 32 hex characters (16 bytes)'), 'error');
    }
    setSaving(true);
    try {
      const res = await csrfFetch(`${appBasename}/api/channels/${editing.idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, psk: hexToBase64(secretHex), scope: editing.scope.trim().replace(/^#/, ''), sourceId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        showToast(t('meshcore.channels.save_failed', 'Failed to save channel: {{msg}}', { msg: body?.error || `HTTP ${res.status}` }), 'error');
        return;
      }
      showToast(t('meshcore.channels.saved', 'Channel {{idx}} saved', { idx: editing.idx }), 'success');
      setEditing(null);
      reload();
    } catch {
      showToast(t('meshcore.channels.save_failed_generic', 'Failed to save channel'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (idx: number) => {
    if (editing?.idx === idx) setEditing(null);
    try {
      const res = await csrfFetch(`${appBasename}/api/channels/${idx}?sourceId=${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        showToast(t('meshcore.channels.delete_failed', 'Failed to delete channel: {{msg}}', { msg: body?.error || `HTTP ${res.status}` }), 'error');
        return;
      }
      showToast(
        idx === PUBLIC_SLOT
          ? t('meshcore.channels.reset_public_done', 'Slot 0 reset to the Public channel')
          : t('meshcore.channels.deleted', 'Channel {{idx}} deleted', { idx }),
        'success',
      );
      reload();
    } catch {
      showToast(t('meshcore.channels.delete_failed_generic', 'Failed to delete channel'), 'error');
    }
  };

  const title = (row: McChannelRow) => formatMeshCoreChannelName(row.name, t('meshcore.channels.unnamed', 'Channel {{idx}}', { idx: row.id }));
  const publicRow = rows.find((c) => c.id === PUBLIC_SLOT);
  const freeFrom = rows.length ? Math.max(...rows.map((c) => c.id)) + 1 : 0;
  const shareRow = rows.find((c) => c.id === shareIdx) ?? null;
  const sendsNothing = t('workspace.meshcore.settings.sends_channel');

  const table = (
    <div className={styles.card}>
      {!isPhone && (
        <div className={styles.tableHead} aria-hidden="true">
          <span>{t('workspace.meshcore.settings.slot')}</span>
          <span>{t('meshcore.channels.name_label')}</span>
          <span>{t('workspace.meshcore.settings.region_scope')}</span>
          <span />
        </div>
      )}
      <ul className={styles.slots} aria-label={t('meshcore.channels.title')}>
        {rows.map((row) => (
          <SlotRow
            key={row.id}
            row={row}
            title={title(row)}
            active={shareIdx === row.id}
            off={off}
            onShare={() => setShareIdx(row.id)}
            onEdit={() => startEdit(row)}
            onDelete={() => setToDelete(row)}
          />
        ))}
        {freeFrom < max && (
          <li className={styles.free} data-phone={isPhone || undefined}>
            {isPhone
              ? t('workspace.meshcore.settings.slots_free', { range: freeFrom === max - 1 ? String(freeFrom) : `${freeFrom}–${max - 1}` })
              : (
                <>
                  <span className={styles.slotNum}>{freeFrom === max - 1 ? freeFrom : `${freeFrom}–${max - 1}`}</span>
                  <span>{t('workspace.meshcore.settings.free')}</span>
                </>
              )}
          </li>
        )}
      </ul>
      {list.isPending && <p className={styles.muted}>{t('meshcore.channels.loading_list', 'Loading channels…')}</p>}
      {!list.isPending && rows.length === 0 && <p className={styles.muted}>{t('meshcore.channels.empty', 'No channels reported by the device yet.')}</p>}
    </div>
  );

  return (
    <McPage>
      <DeviceNotes />
      <div className={styles.toolbar} data-phone={isPhone || undefined}>
        {!isPhone && (
          <button type="button" className={styles.primary} disabled={off || nextFree === null || !!editing?.isNew} onClick={startAdd}>
            <UiIcon name="plus" size={16} /> {t('meshcore.channels.add')}
          </button>
        )}
        <button
          type="button"
          className={styles.button}
          disabled={off || !rows.some((c) => c.id >= 1)}
          aria-pressed={reordering}
          onClick={() => {
            setEditing(null);
            setReordering(true);
          }}
        >
          <UiIcon name="sortAscending" size={16} /> {t('meshcore.channels.reorder.button')}
        </button>
      </div>

      <div className={styles.split} data-phone={isPhone || undefined}>
        <div className={styles.main}>
          {reordering ? (
            <div className={styles.card}>
              <MeshCoreChannelReorderPanel
                baseUrl={appBasename}
                sourceId={sourceId}
                channels={rows.filter((c) => c.id >= 1).map((c) => ({ id: c.id, name: c.name }))}
                onFinished={reload}
                onClose={() => setReordering(false)}
              />
            </div>
          ) : (
            table
          )}
          {editing ? (
            <ChannelEditor
              editing={editing}
              setEditing={setEditing}
              saving={saving}
              off={off}
              savedRegions={savedRegions}
              onSave={() => void save()}
              onCancel={() => setEditing(null)}
              onDelete={!editing.isNew && isPhone ? () => setToDelete(rows.find((c) => c.id === editing.idx) ?? null) : undefined}
              onImported={() => {
                setEditing(null);
                reload();
              }}
              sourceId={sourceId}
            />
          ) : (
            isPhone && (
              <button type="button" className={styles.primary} disabled={off || nextFree === null} onClick={startAdd}>
                <UiIcon name="plus" size={16} /> {t('meshcore.channels.add')}
              </button>
            )
          )}
          {/* Today offers Reset to Public only while slot 0 holds something else. */}
          {publicRow && !isStockPublic(publicRow) && (
            <DangerZone
              title={
                <span className={styles.inline}>
                  <UiIcon name="alert" size={16} /> {t('config.danger_zone')}
                </span>
              }
            >
              <div className={styles.dangerRow}>
                <div className={styles.dangerText}>
                  <span className={styles.rowLabel}>{t('workspace.meshcore.settings.reset_public_title')}</span>
                  <span className={styles.muted}>
                    {t(isPhone ? 'workspace.meshcore.settings.reset_public_help_short' : 'workspace.meshcore.settings.reset_public_help')}
                  </span>
                    <SendsLine>{sendsNothing}</SendsLine>
                </div>
                <button
                  type="button"
                  className={styles.danger}
                  disabled={off || !publicRow || isStockPublic(publicRow)}
                  onClick={() => publicRow && setToDelete(publicRow)}
                >
                  {t('meshcore.channels.reset_public')}
                </button>
              </div>
            </DangerZone>
          )}
        </div>
        {shareRow && !isPhone && (
          <aside className={styles.side}>
            <SharePanel row={shareRow} title={title(shareRow)} sourceId={sourceId} onClose={() => setShareIdx(null)} />
          </aside>
        )}
      </div>
      {isPhone && (
        <Sheet open={!!shareRow} onClose={() => setShareIdx(null)} title={shareRow ? t('workspace.meshcore.settings.share_title', { name: title(shareRow) }) : ''}>
          {shareRow && <SharePanel row={shareRow} title={title(shareRow)} sourceId={sourceId} onClose={() => setShareIdx(null)} inSheet />}
        </Sheet>
      )}

      <ConfirmSheet
        open={toDelete !== null}
        title={
          toDelete?.id === PUBLIC_SLOT
            ? t('meshcore.channels.reset_public_title')
            : t('meshcore.channels.delete_title', { idx: toDelete?.id ?? '' })
        }
        body={
          toDelete && (
            <>
              <p className={styles.para}>
                {toDelete.id === PUBLIC_SLOT ? t('meshcore.channels.confirm_reset_public') : t('meshcore.channels.delete_message')}
              </p>
              <p className={styles.preview}>{title(toDelete)}</p>
              <SendsLine>{sendsNothing}</SendsLine>
            </>
          )
        }
        confirmLabel={toDelete?.id === PUBLIC_SLOT ? t('meshcore.channels.reset_public') : t('common.delete')}
        danger
        submitOnEnter={false}
        onConfirm={() => {
          const idx = toDelete!.id;
          setToDelete(null);
          void remove(idx);
        }}
        onCancel={() => setToDelete(null)}
      />
      <LeaveGuard
        base={`/source/${encodeURIComponent(sourceId)}/settings`}
        pending={
          dirty && editing
            ? {
                scope: pathname,
                title: t(editing.isNew ? 'workspace.meshcore.settings.add_slot' : 'workspace.meshcore.settings.edit_slot', { idx: editing.idx }),
                changes: editing.isNew ? [] : changedFields,
                note: editing.isNew ? t('workspace.settings.channels.new_not_saved') : undefined,
                discard: () => setEditing(null),
              }
            : null
        }
      />
    </McPage>
  );
}

function KindTag({ row }: { row: McChannelRow }) {
  const { t } = useTranslation();
  const kind = meshcoreChannelKind(row);
  const label = kind === 'public' ? t('workspace.meshcore.settings.kind_public') : kind === 'hashtag' ? t('workspace.meshcore.settings.kind_hashtag') : t('workspace.meshcore.settings.kind_secret');
  return <span className={styles.tag} data-kind={kind}>{label}</span>;
}

function SlotRow({ row, title, active, off, onShare, onEdit, onDelete }: {
  row: McChannelRow;
  title: string;
  active: boolean;
  off: boolean;
  onShare(): void;
  onEdit(): void;
  onDelete(): void;
}) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const kind = meshcoreChannelKind(row);
  const isPublicSlot = row.id === PUBLIC_SLOT;
  const hex = base64ToHex(row.psk);
  const sub = isPublicSlot
    ? t('meshcore.channels.public_slot_hint')
    : kind === 'hashtag'
      ? t('workspace.meshcore.settings.key_from_name')
      : hex
        ? shortKey(hex)
        : '';
  const scope = row.scope ?? t('workspace.meshcore.settings.inherit_default');
  const share = row.psk && !isPublicSlot && (
    <button type="button" className={styles.button} data-active={active || undefined} disabled={off} onClick={onShare}>
      <UiIcon name="link" size={16} /> {t('meshcore.channels.share')}
    </button>
  );
  const name = (
    <span className={styles.nameCell}>
      <span className={styles.nameLine}>
        <span className={styles.rowLabel}>{title}</span>
        <KindTag row={row} />
      </span>
      {isPhone ? (
        <span className={styles.muted}>{t('workspace.meshcore.settings.scope_line', { scope })}</span>
      ) : (
        <span className={kind === 'private' && !isPublicSlot ? styles.mono : styles.muted}>{sub}</span>
      )}
    </span>
  );
  if (isPhone) {
    return (
      <li className={styles.slot} data-phone="">
        <span className={styles.slotNum}>{row.id}</span>
        {isPublicSlot ? name : (
          <button type="button" className={styles.rowButton} disabled={off} onClick={onEdit}>{name}</button>
        )}
        {share}
      </li>
    );
  }
  return (
    <li className={styles.slot} data-active={active || undefined}>
      <span className={styles.slotNum}>{row.id}</span>
      {name}
      <span className={styles.muted}>{scope}</span>
      <span className={styles.slotActions}>
        {share}
        {!isPublicSlot && (
          <>
            <button type="button" className={styles.icon} aria-label={`${t('common.edit')} ${title}`} disabled={off} onClick={onEdit}>
              <UiIcon name="edit" size={18} />
            </button>
            <button type="button" className={styles.icon} aria-label={`${t('common.delete')} ${title}`} disabled={off} onClick={onDelete}>
              <UiIcon name="delete" size={18} />
            </button>
          </>
        )}
      </span>
    </li>
  );
}

function ChannelEditor({ editing, setEditing, saving, off, savedRegions, onSave, onCancel, onDelete, onImported, sourceId }: {
  editing: Editing;
  setEditing(fn: (e: Editing | null) => Editing | null): void;
  saving: boolean;
  off: boolean;
  savedRegions: string[];
  onSave(): void;
  onCancel(): void;
  onDelete?: () => void;
  onImported(): void;
  sourceId: string;
}) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const patch = (p: Partial<Editing>) => setEditing((e) => (e ? { ...e, ...p } : e));
  const hashtag = editing.mode === 'hashtag';
  const keyOk = hashtag ? isHashtagChannelName(editing.name.trim()) && editing.name.trim().length > 1 : isValidChannelKey(editing.secretHex, 'hex', [SECRET_BYTES]);
  const nameOk = editing.name.trim() !== '' && (hashtag || !editing.name.trim().startsWith('#'));
  const setMode = (mode: Mode) =>
    patch({
      mode,
      name: mode === 'hashtag' && !editing.name.startsWith('#') ? `#${editing.name}` : mode === 'secret' ? editing.name.replace(/^#+/, '') : editing.name,
      secretHex: mode === 'secret' ? generateChannelKey(SECRET_BYTES, 'hex') : editing.secretHex,
    });
  const id = `mc-ch-${editing.idx}`;
  const modes: Array<{ value: Mode; label: string }> = [
    { value: 'hashtag', label: t('workspace.meshcore.settings.kind_hashtag') },
    { value: 'secret', label: t('workspace.meshcore.settings.kind_secret') },
    ...(editing.isNew ? [{ value: 'url' as const, label: t('meshcore.channels.import_url') }] : []),
  ];
  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <div className={styles.editorHead} data-phone={isPhone || undefined}>
        <h2 className={styles.cardTitle} id={`${id}-title`}>
          {t(editing.isNew ? 'workspace.meshcore.settings.add_slot' : 'workspace.meshcore.settings.edit_slot', { idx: editing.idx })}
        </h2>
        <span className={styles.segments} role="radiogroup" aria-label={t('workspace.meshcore.settings.channel_kind')}>
          {modes.map((m) => (
            <button key={m.value} type="button" role="radio" aria-checked={editing.mode === m.value} className={styles.segment} disabled={saving} onClick={() => setMode(m.value)}>
              {m.label}
            </button>
          ))}
        </span>
      </div>
      {editing.mode === 'url' ? (
        <ImportFromUrl sourceId={sourceId} off={off} onImported={onImported} onCancel={onCancel} />
      ) : (
        <>
          <div className={styles.fields} data-phone={isPhone || undefined}>
            <label className={styles.field}>
              <span>{t('meshcore.channels.name_label')}</span>
              <input
                id={`${id}-name`}
                className={styles.input}
                value={editing.name}
                maxLength={MAX_NAME_BYTES}
                placeholder={hashtag ? '#coast' : ''}
                disabled={saving || off}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            {editing.mode === 'secret' && (
              <label className={styles.field}>
                <span>{t('meshcore.channels.secret_label')}</span>
                <span className={styles.keyRow}>
                  {/* Masked by default, as today's ChannelKeyField; Show reveals it. */}
                  <PasswordField
                    className={`${styles.input} ${styles.mono}`}
                    value={editing.secretHex}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={saving || off}
                    onChange={(e) => patch({ secretHex: e.target.value.trim() })}
                  />
                  <button type="button" className={styles.button} disabled={saving || off} onClick={() => patch({ secretHex: generateChannelKey(SECRET_BYTES, 'hex') })}>
                    {t('workspace.meshcore.settings.generate')}
                  </button>
                </span>
              </label>
            )}
            <label className={styles.field}>
              <span>{t('meshcore.channels.scope_label')}</span>
              <input
                className={styles.input}
                list={`${id}-regions`}
                value={editing.scope}
                maxLength={63}
                spellCheck={false}
                autoComplete="off"
                placeholder={t('workspace.meshcore.settings.scope_placeholder')}
                disabled={saving || off}
                onChange={(e) => patch({ scope: e.target.value })}
              />
              {savedRegions.length > 0 && (
                <datalist id={`${id}-regions`}>
                  {savedRegions.map((r) => <option key={r} value={r} />)}
                </datalist>
              )}
            </label>
          </div>
          <p className={styles.muted}>
            {hashtag
              ? t('meshcore.channels.hashtag_derived', { name: editing.name.trim().replace(/^#+/, '') })
              : t('workspace.meshcore.settings.secret_help')}
          </p>
          {editing.mode === 'secret' && editing.secretHex && !keyOk && <p className={styles.error}>{t('meshcore.channels.invalid_secret', 'Secret must be exactly 32 hex characters (16 bytes)')}</p>}
          <SendsLine>{t('workspace.meshcore.settings.sends_channel')}</SendsLine>
          <div className={styles.buttons}>
            <button type="button" className={styles.primary} disabled={saving || off || !keyOk || !nameOk} onClick={onSave}>
              {saving ? t('common.saving', 'Saving…') : t('meshcore.channels.save_to_device')}
            </button>
            <button type="button" className={styles.plain} disabled={saving} onClick={onCancel}>{t('common.cancel')}</button>
            {onDelete && (
              <button type="button" className={styles.danger} disabled={saving || off} onClick={onDelete}>{t('common.delete')}</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Today's Import from URL: decode (no write), then one import request that writes the channel to a free slot. */
function ImportFromUrl({ sourceId, off, onImported, onCancel }: { sourceId: string; off: boolean; onImported(): void; onCancel(): void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [url, setUrl] = useState('');
  const [decoded, setDecoded] = useState<{ channels?: Array<{ name: string; secretHex: string; regionScope: string | null }>; target?: { kind: string; slot?: number; maxChannels?: number } } | null>(null);
  const [busy, setBusy] = useState<'decode' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decode = async () => {
    setBusy('decode');
    setError(null);
    try {
      const r = await apiService.decodeChannelUrl(url, sourceId);
      if (r?.protocol !== 'meshcore') throw new Error(t('import_config.error_decode_failed'));
      setDecoded(r);
    } catch (e) {
      setDecoded(null);
      setError((e instanceof Error && e.message) || t('import_config.error_decode_failed'));
    } finally {
      setBusy(null);
    }
  };
  const doImport = async () => {
    setBusy('import');
    setError(null);
    try {
      const r = await apiService.importConfig(url, undefined, sourceId);
      showToast(t('import_config.meshcore_status_complete', { slot: r.slot ?? '' }), 'success');
      onImported();
    } catch (e) {
      setError((e instanceof Error && e.message) || t('import_config.error_import_failed'));
    } finally {
      setBusy(null);
    }
  };
  const ch = decoded?.channels?.[0];
  const target = decoded?.target;
  return (
    <>
      <label className={styles.field}>
        <span>{t('import_config.meshcore_url_label')}</span>
        <input
          className={`${styles.input} ${styles.mono}`}
          value={url}
          placeholder={t('import_config.meshcore_url_placeholder')}
          spellCheck={false}
          autoComplete="off"
          disabled={busy !== null || off}
          onChange={(e) => {
            setUrl(e.target.value);
            setDecoded(null);
          }}
        />
      </label>
      {ch && (
        <dl className={styles.facts}>
          <dt>{t('import_config.meshcore_name')}</dt>
          <dd>{ch.name}</dd>
          <dt>{t('import_config.meshcore_secret')}</dt>
          <dd className={styles.mono}>{maskMeshcoreSecret(ch.secretHex)}</dd>
          <dt>{t('import_config.meshcore_scope')}</dt>
          <dd>{ch.regionScope ?? t('import_config.meshcore_scope_none')}</dd>
          <dd className={styles.wide}>
            {target?.kind === 'new'
              ? t('import_config.meshcore_target_new', { slot: target.slot })
              : target?.kind === 'existing'
                ? t('import_config.meshcore_target_existing', { slot: target.slot })
                : target?.kind === 'full'
                  ? t('import_config.meshcore_target_full', { last: (target.maxChannels ?? MESHCORE_DEFAULT_MAX_CHANNELS) - 1 })
                  : t('import_config.meshcore_target_unknown')}
          </dd>
        </dl>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SendsLine>{t('workspace.meshcore.settings.sends_channel')}</SendsLine>
      <div className={styles.buttons}>
        {ch ? (
          <button type="button" className={styles.primary} disabled={busy !== null || off || target?.kind === 'existing' || target?.kind === 'full'} onClick={() => void doImport()}>
            {busy === 'import' ? t('import_config.meshcore_status_sending') : t('import_config.meshcore_import_button')}
          </button>
        ) : (
          <button type="button" className={styles.primary} disabled={busy !== null || off || !url.trim()} onClick={() => void decode()}>
            {busy === 'decode' ? t('import_config.decoding') : t('workspace.meshcore.settings.decode')}
          </button>
        )}
        <button type="button" className={styles.plain} disabled={busy !== null} onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </>
  );
}

/** Share: today's server-built URL (one request per channel opened), its QR, Copy URL. The URL holds the secret. */
function SharePanel({ row, title, sourceId, onClose, inSheet }: { row: McChannelRow; title: string; sourceId: string; onClose(): void; inSheet?: boolean }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUrl('');
    setCopied(false);
    setError(null);
    apiService
      .encodeChannelUrl([row.id], false, undefined, sourceId)
      .then((u) => !cancelled && setUrl(u))
      .catch((e: unknown) => !cancelled && setError((e instanceof Error && e.message) || t('errors.generic')));
    return () => {
      cancelled = true;
    };
  }, [row.id, sourceId, t]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* the URL stays on screen to copy by hand */
    }
  };
  return (
    <div className={styles.share}>
      {!inSheet && (
        <div className={styles.shareHead}>
          <h2 className={styles.cardTitle}>{t('workspace.meshcore.settings.share_title', { name: title })}</h2>
          <button type="button" className={styles.icon} aria-label={t('common.close')} onClick={onClose}>
            <UiIcon name="close" size={18} />
          </button>
        </div>
      )}
      <p className={styles.muted}>{t('workspace.meshcore.settings.share_sub')}</p>
      {url && <QrCodeCanvas value={url} size={200} className={styles.qr} ariaLabel={t('export_config.qr_code')} onError={() => {}} />}
      {url && <p className={styles.url}>{url}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.muted}>{t('export_config.meshcore_description')}</p>
      <button type="button" className={styles.button} disabled={!url} onClick={() => void copy()}>
        {copied ? t('export_config.copied') : t('workspace.meshcore.settings.copy_url')}
      </button>
    </div>
  );
}
