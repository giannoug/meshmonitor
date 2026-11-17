/**
 * Server › Channel database (boards 13-08 desktop, 13-17 phone): admins
 * only, as today. Today's ChannelDatabaseSection state and actions, through
 * `useChannelDatabase` (Rule X), so every request, check and toast is today's:
 *
 * - The keys, both protocols (`?protocol=all`), tried top to bottom; drag a
 *   row's handle (or focus it and use the arrow keys) to reorder, saved at
 *   once as today. Each row: today's masked preview (`pskPreview`) and type,
 *   decrypted count and last decrypted time; the Enabled switch; Edit; ⋯ with
 *   Decrypt (retroactive, an enabled Meshtastic key) and Delete (today's
 *   "Delete Channel?"; s13n5).
 * - Add / Edit: today's form (protocol on a new key, name, key with
 *   Generate, description, Enabled, and for Meshtastic name enforcement and
 *   AEAD). The key field is plain text, as today's; a PSK only ever travels
 *   in a request body and is never logged.
 * - Import (a file, previewed first), Import from URL (decode, pick, add N),
 *   Import from MeshCore device (one source, one copy) and Export: today's.
 * - Running now: today's retroactive decryption progress, which today's hook
 *   re-reads each second only while a run is pending or running.
 *
 * Mesh impact: none. These keys only decrypt what MeshMonitor hears.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import AeadBadge from '../../components/channels/AeadBadge';
import { ROLE_DISABLED, ROLE_PRIMARY, ROLE_SECONDARY, useChannelDatabase } from '../../components/configuration/useChannelDatabase';
import apiService, { type ChannelDatabaseEntry } from '../../services/api';
import { getPskBase64ByteLength, normalizeChannelUrlPskToBase64 } from '../../utils/channelUrl';
import { logger } from '../../utils/logger';
import ConfirmSheet from '../patterns/ConfirmSheet';
import RowMenu from '../patterns/RowMenu';
import Sheet from '../patterns/Sheet';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingRow from '../settings/kit/SettingRow';
import SettingSegmented from '../settings/kit/SettingSegmented';
import SettingToggle from '../settings/kit/SettingToggle';
import { useIsPhone } from '../shell/useIsPhone';
import Field from './Field';
import ServerFrame from './ServerFrame';
import RowSwitch from './RowSwitch';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import styles from './Server.module.css';

type Db = ReturnType<typeof useChannelDatabase>;

/** Today's key line on a card. */
function pskLine(c: ChannelDatabaseEntry): string {
  if (c.pskLength === 0) return 'PSK: (none) (None)';
  const kind = c.pskLength === 1 ? 'Shorthand (AES-128)' : c.pskLength === 16 ? 'AES-128' : c.pskLength === 32 ? 'AES-256' : 'Unknown';
  return `PSK: ${c.pskPreview} (${kind})`;
}

export default function ChannelDatabasePage() {
  const { t } = useTranslation();
  return (
    <ServerFrame
      categoryId="channel-database"
      title={t('workspace.server.nav.channel_database')}
      scope={t('workspace.server.scope_admins')}
      icon="key"
      gate="admin"
      needsSettings={false}
    >
      <ChannelDatabaseBody />
    </ServerFrame>
  );
}

function ChannelDatabaseBody() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  // The frame opens only for admins.
  const db = useChannelDatabase(true);
  const [importingMeshCore, setImportingMeshCore] = useState(false);
  const editing = db.showEditModal && db.editingChannel;
  const running = db.decryptionProgress && (db.decryptionProgress.status === 'running' || db.decryptionProgress.status === 'pending');

  const list = (
    <>
      <p className={styles.banner}>
        <UiIcon name="alert" size={18} />
        <span>{t('workspace.server.channel_db_banner')}</span>
      </p>
      <p className={styles.lead}>{t('channel_database.description')}</p>
      <div className={styles.toolbar}>
        <button type="button" className={`${pages.button} ${pages.primary}`} onClick={db.handleAddChannel}>
          <UiIcon name="plus" size={16} />
          {t('channel_database.add_channel')}
        </button>
        <button type="button" className={pages.button} onClick={() => db.setShowImportModal(true)}>
          <UiIcon name="upload" size={16} />
          {t('common.import')}
        </button>
        <button type="button" className={pages.button} title={t('channel_database.import_from_url_title')} onClick={() => db.setShowUrlImportModal(true)}>
          <UiIcon name="link" size={16} />
          {t('channel_database.import_from_url')}
        </button>
        <button type="button" className={pages.button} title={t('channel_database.meshcore_import_title', "Copy a MeshCore device's channels into the channel database")} onClick={() => setImportingMeshCore(true)}>
          <UiIcon name="download" size={16} />
          {t('channel_database.meshcore_import', 'Import from MeshCore device')}
        </button>
        <button type="button" className={pages.button} title={t('channel_database.export_title')} disabled={db.channels.length === 0} onClick={db.handleExportChannels}>
          <UiIcon name="download" size={16} />
          {t('common.export')}
        </button>
      </div>
      <SettingGroup title={t('workspace.server.channel_db_keys')}>
        {db.channels.length > 1 && <p className={styles.cardPara}>{t('channel_database.sort_order_note')}</p>}
        {db.loading ? (
          <p className={styles.cardPara}>{t('common.loading')}...</p>
        ) : db.channels.length === 0 ? (
          <p className={styles.cardPara}>{t('channel_database.no_channels')}</p>
        ) : (
          <DndContext sensors={db.sensors} collisionDetection={closestCenter} onDragEnd={db.handleDragEnd}>
            <SortableContext items={db.channels.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {db.channels.map((c) => (
                <KeyRow key={c.id} channel={c} db={db} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </SettingGroup>
      {running && db.decryptionProgress && (
        <SettingGroup title={t('workspace.server.running_now')}>
          <div className={styles.progress}>
            <p className={styles.progressHead}>
              <strong>{t('channel_database.retroactive_decryption')}</strong>
              <span>{db.decryptionProgress.channelName}</span>
            </p>
            <p className={pages.infoHelp}>
              {t('channel_database.progress')}: {db.decryptionProgress.processed}/{db.decryptionProgress.total} ({db.decryptionProgress.decrypted} {t('channel_database.decrypted')})
            </p>
            <progress
              className={styles.bar}
              max={db.decryptionProgress.total || 1}
              value={db.decryptionProgress.total > 0 ? db.decryptionProgress.processed : 0}
              aria-label={t('channel_database.retroactive_decryption')}
            />
            <p className={pages.infoHelp}>{t('workspace.settings.savebar.sends_nothing')}</p>
          </div>
        </SettingGroup>
      )}
    </>
  );

  const form = editing && <KeyForm db={db} />;

  return (
    <>
      {isPhone ? (
        form || list
      ) : (
        <div className={prefs.columns}>
          <div className={prefs.column}>{list}</div>
          <div className={prefs.column}>{form}</div>
        </div>
      )}
      <ConfirmSheet
        open={db.showDeleteConfirm !== null}
        title={t('channel_database.confirm_delete')}
        body={<p className={pages.para}>{t('channel_database.confirm_delete_message')}</p>}
        confirmLabel={db.isSaving ? t('common.deleting') : t('common.delete')}
        danger
        busy={db.isSaving}
        submitOnEnter={false}
        onConfirm={async () => {
          if (db.showDeleteConfirm !== null) await db.handleDeleteChannel(db.showDeleteConfirm);
        }}
        onCancel={() => db.setShowDeleteConfirm(null)}
      />
      <ImportFileSheet db={db} />
      <ImportUrlSheet db={db} />
      <MeshCoreImportSheet open={importingMeshCore} onClose={() => setImportingMeshCore(false)} onImported={() => void db.fetchChannels()} />
    </>
  );
}

function KeyRow({ channel: c, db }: { channel: ChannelDatabaseEntry; db: Db }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const meshcore = c.protocol === 'meshcore';
  const decrypting = db.decryptionProgress?.status === 'running';
  return (
    <div
      ref={setNodeRef}
      className={styles.keyRow}
      data-phone={isPhone || undefined}
      data-off={!c.isEnabled || undefined}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="channel-db-row"
    >
      <button type="button" className={styles.handle} title={t('channel_database.drag_to_reorder')} aria-label={`${t('channel_database.drag_to_reorder')}: ${c.name}`} {...attributes} {...listeners}>
        <UiIcon name="dragHandle" size={18} />
      </button>
      <div className={styles.keyText}>
        <span className={styles.keyName}>
          {c.name}
          <span className={pages.chip} data-tone={meshcore ? 'on' : 'accent'}>
            {meshcore ? t('channel_database.protocol_meshcore', 'MeshCore') : t('channel_database.protocol_meshtastic', 'Meshtastic')}
          </span>
          {!meshcore && <AeadBadge useAead={c.useAead} />}
          <span className={styles.state} data-on={c.isEnabled || undefined}>
            {c.isEnabled ? t('channel_database.enabled') : t('channel_database.disabled')}
          </span>
        </span>
        {c.description && <span className={pages.infoHelp}>{c.description}</span>}
        <span className={pages.infoHelp}>
          {pskLine(c)} · {c.decryptedPacketCount} {t('channel_database.decrypted')} · {t('channel_database.last_decrypted')}: {db.formatTimestamp(c.lastDecryptedAt)}
        </span>
      </div>
      <RowSwitch label={`${t('channel_database.enabled')}: ${c.name}`} checked={c.isEnabled} onChange={() => void db.handleToggleEnabled(c)} />
      <button type="button" className={pages.iconButton} aria-label={`${t('common.edit')} ${c.name}`} title={t('common.edit')} onClick={() => db.handleEditChannel(c)}>
        <UiIcon name="edit" size={18} />
      </button>
      <RowMenu
        label={t('workspace.server.key_actions', { name: c.name })}
        items={[
          // Retroactive decrypt re-reads the Meshtastic packet log only.
          ...(c.isEnabled && !meshcore
            ? [{ key: 'decrypt', label: t('channel_database.decrypt'), icon: 'refresh' as const, disabled: decrypting, onSelect: () => void db.handleTriggerDecryption(c.id) }]
            : []),
          { key: 'delete', label: t('common.delete'), icon: 'delete', danger: true, onSelect: () => db.setShowDeleteConfirm(c.id) },
        ]}
      />
    </div>
  );
}


function KeyForm({ db }: { db: Db }) {
  const { t } = useTranslation();
  const ch = db.editingChannel!;
  const meshcore = ch.protocol === 'meshcore';
  const set = (patch: Partial<typeof ch>) => db.setEditingChannel({ ...ch, ...patch });
  return (
    <SettingGroup title={ch.id ? `${t('channel_database.edit_channel')} · ${ch.name}` : t('channel_database.add_channel')}>
      {!ch.id && (
        <SettingRow id="channel-database.protocol" label={t('channel_database.protocol', 'Protocol')} help={t('channel_database.protocol_description')} stacked>
          <SettingSegmented
            value={ch.protocol}
            options={[
              { value: 'meshtastic', label: t('channel_database.protocol_meshtastic', 'Meshtastic') },
              { value: 'meshcore', label: t('channel_database.protocol_meshcore', 'MeshCore') },
            ]}
            onChange={(v) => set({ protocol: v === 'meshcore' ? 'meshcore' : 'meshtastic' })}
          />
        </SettingRow>
      )}
      <Field label={t('channel_database.channel_name')} help={t('channel_database.channel_name_description')}>
        <input type="text" className={pages.keyInput} aria-label={t('channel_database.channel_name')} value={ch.name} placeholder={t('channel_database.channel_name_placeholder')} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field
        label={meshcore ? t('channel_database.meshcore_secret', 'Channel secret') : t('channel_database.psk')}
        help={meshcore ? t('channel_database.meshcore_secret_description') : t('channel_database.psk_description')}
      >
        <div className={styles.fieldLine}>
          <input
            type="text"
            className={pages.keyInput}
            aria-label={meshcore ? t('channel_database.meshcore_secret', 'Channel secret') : t('channel_database.psk')}
            value={ch.psk}
            autoComplete="off"
            spellCheck={false}
            placeholder={meshcore ? t('channel_database.meshcore_secret_placeholder') : t('channel_database.psk_placeholder')}
            onChange={(e) => set({ psk: e.target.value })}
          />
          <button type="button" className={pages.button} title={t('channel_database.generate_key_title')} onClick={db.handleGeneratePSK}>
            <UiIcon name="refresh" size={16} />
            {t('channel_database.generate')}
          </button>
        </div>
      </Field>
      <Field label={t('channel_database.channel_description')} help={t('channel_database.channel_description_hint')}>
        <textarea className={styles.textarea} rows={3} aria-label={t('channel_database.channel_description')} value={ch.description} placeholder={t('channel_database.channel_description_placeholder')} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <SettingRow id="channel-database.isEnabled" label={t('channel_database.is_enabled')} help={t('channel_database.is_enabled_description')}>
        <SettingToggle checked={ch.isEnabled} onChange={(v) => set({ isEnabled: v })} />
      </SettingRow>
      {/* Name validation and AES-CCM are Meshtastic only, as today. */}
      {!meshcore && (
        <>
          <SettingRow id="channel-database.enforceNameValidation" label={t('channel_database.enforce_name_validation')} help={t('channel_database.enforce_name_validation_description')}>
            <SettingToggle checked={ch.enforceNameValidation} onChange={(v) => set({ enforceNameValidation: v })} />
          </SettingRow>
          <SettingRow id="channel-database.useAead" label={t('channel_database.use_aead')} help={t('channel_database.use_aead_description')}>
            <SettingToggle checked={ch.useAead} onChange={(v) => set({ useAead: v })} />
          </SettingRow>
        </>
      )}
      <div className={styles.formActions}>
        <button type="button" className={pages.button} disabled={db.isSaving} onClick={() => db.setShowEditModal(false)}>
          {t('common.cancel')}
        </button>
        <button type="button" className={`${pages.button} ${pages.primary}`} disabled={db.isSaving} onClick={() => void db.handleSaveChannel()}>
          {db.isSaving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </SettingGroup>
  );
}

function ImportFileSheet({ db }: { db: Db }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const close = () => !db.isSaving && db.setShowImportModal(false);
  return (
    <Sheet
      open={db.showImportModal}
      onClose={close}
      dismissible={!db.isSaving}
      title={t('channel_database.import_channels')}
      footer={
        <div className={styles.sheetActions} data-phone={isPhone || undefined}>
          <button type="button" className={pages.button} disabled={db.isSaving} onClick={close}>{t('common.cancel')}</button>
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={db.isSaving || !db.importFileContent} onClick={() => void db.handleImportChannels()}>
            {db.isSaving ? t('common.importing') : t('common.import')}
          </button>
        </div>
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        <label className={styles.field}>
          <span className={pages.infoLabel}>{t('channel_database.select_file')}</span>
          <span className={pages.infoHelp}>{t('channel_database.select_file_description')}</span>
          <input ref={db.fileInputRef} type="file" accept=".json" onChange={db.handleFileSelect} />
        </label>
        {db.importFileContent && (
          <>
            <span className={pages.infoLabel}>{t('channel_database.preview')}:</span>
            <pre className={styles.preview}>{db.importFileContent}</pre>
          </>
        )}
      </div>
    </Sheet>
  );
}

function ImportUrlSheet({ db }: { db: Db }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const blocked = db.isSaving || db.isDecodingUrl;
  const close = () => {
    if (blocked) return;
    db.setShowUrlImportModal(false);
    db.resetUrlImportState();
  };
  return (
    <Sheet
      open={db.showUrlImportModal}
      onClose={close}
      dismissible={!blocked}
      title={t('channel_database.import_from_url')}
      footer={
        <div className={styles.sheetActions} data-phone={isPhone || undefined}>
          <button type="button" className={pages.button} disabled={blocked} onClick={close}>{t('common.cancel')}</button>
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={db.isSaving || db.urlSelectedIndexes.size === 0} onClick={() => void db.handleImportFromUrl()}>
            {db.isSaving ? t('common.importing') : t('channel_database.url_add_selected', { count: db.urlSelectedIndexes.size })}
          </button>
        </div>
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        <p className={pages.para}>{t('channel_database.import_from_url_description')}</p>
        <label className={styles.field}>
          <span className={pages.infoLabel}>{t('channel_database.url_label')}</span>
          <textarea className={styles.textarea} rows={3} aria-label={t('channel_database.url_label')} value={db.urlImportInput} placeholder="https://meshtastic.org/e/#..." disabled={blocked} onChange={(e) => db.setUrlImportInput(e.target.value)} />
        </label>
        <button type="button" className={pages.button} disabled={blocked || !db.urlImportInput.trim()} onClick={() => void db.handleDecodeUrl()}>
          {db.isDecodingUrl ? t('common.loading') : t('channel_database.decode_url')}
        </button>
        {db.urlImportError && <p className={pages.error} role="alert">{db.urlImportError}</p>}
        {db.urlDecodedChannels.length > 0 && (
          <>
            <span className={pages.infoLabel}>{t('channel_database.url_decoded_channels', { count: db.urlDecodedChannels.length })}</span>
            {db.urlDecodedChannels.map((ch, idx) => {
              const psk = normalizeChannelUrlPskToBase64(ch.psk);
              const importable = psk !== null && ch.role !== ROLE_DISABLED;
              // Meshtastic leaves `role` off the wire when it is PRIMARY.
              const role = ch.role ?? ROLE_PRIMARY;
              const roleLabel =
                role === ROLE_PRIMARY ? t('channel_database.role_primary') : role === ROLE_SECONDARY ? t('channel_database.role_secondary') : role === ROLE_DISABLED ? t('channel_database.role_disabled') : t('channel_database.role_unknown');
              return (
                <div key={idx} className={styles.decoded} data-off={!importable || undefined}>
                  <input
                    type="checkbox"
                    checked={db.urlSelectedIndexes.has(idx)}
                    disabled={!importable || db.isSaving}
                    aria-label={t('channel_database.url_include_channel', { name: ch.name || `#${idx + 1}` })}
                    onChange={() => db.toggleUrlChannelSelected(idx)}
                  />
                  <div className={styles.decodedText}>
                    <input
                      type="text"
                      className={pages.keyInput}
                      value={db.urlEditedNames[idx] ?? ch.name ?? ''}
                      placeholder={t('channel_database.imported_channel_default_name', { index: idx + 1 })}
                      disabled={!importable || db.isSaving}
                      onChange={(e) => db.setUrlEditedNames((prev) => ({ ...prev, [idx]: e.target.value }))}
                    />
                    <span className={pages.infoHelp}>
                      {roleLabel} · {psk ? t('channel_database.url_psk_summary', { bytes: getPskBase64ByteLength(psk) }) : t('channel_database.url_psk_no_crypto')}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Sheet>
  );
}

interface ImportResult {
  imported: Array<{ id: number; name: string }>;
  skipped: Array<{ name: string; reason: 'duplicate' | 'no_secret' }>;
}

/**
 * Today's "Import from MeshCore device" (MeshCoreChannelImport), redrawn: the
 * MeshCore device sources, read when it opens, and one
 * `POST /api/channel-database/import-meshcore` per Import press.
 */
function MeshCoreImportSheet({ open, onClose, onImported }: { open: boolean; onClose(): void; onImported(): void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isPhone = useIsPhone();
  const [sources, setSources] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadFailed(false);
    void (async () => {
      try {
        const all = await apiService.get<Array<{ id: string; name: string; type: string }>>('/api/sources');
        if (cancelled) return;
        // Only device sources hold channels; an MQTT ingest source has none.
        const devices = (Array.isArray(all) ? all : []).filter((s) => s.type === 'meshcore');
        setSources(devices);
        setSourceId((prev) => prev || devices[0]?.id || '');
      } catch (error) {
        logger.error('Error loading sources for MeshCore channel import:', error);
        if (!cancelled) {
          setSources([]);
          setLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const close = () => {
    if (busy) return;
    setResult(null);
    onClose();
  };

  const run = async () => {
    if (!sourceId) return;
    setBusy(true);
    try {
      const response = await apiService.importMeshcoreChannels(sourceId);
      setResult(response.data);
      if (response.data.imported.length > 0) onImported();
    } catch (error) {
      logger.error('Error importing MeshCore channels:', error);
      showToast(error instanceof Error ? error.message : t('channel_database.meshcore_import_failed', 'Import failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const duplicates = result?.skipped.filter((s) => s.reason === 'duplicate').length ?? 0;
  const noSecret = result?.skipped.filter((s) => s.reason === 'no_secret').length ?? 0;
  return (
    <Sheet
      open={open}
      onClose={close}
      dismissible={!busy}
      title={t('channel_database.meshcore_import', 'Import from MeshCore device')}
      footer={
        <div className={styles.sheetActions} data-phone={isPhone || undefined}>
          <button type="button" className={pages.button} disabled={busy} onClick={close}>{t('common.close', 'Close')}</button>
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={busy || !sourceId} onClick={() => void run()}>
            {busy ? t('common.loading', 'Loading...') : t('common.import', 'Import')}
          </button>
        </div>
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        <p className={pages.para}>{t('channel_database.meshcore_import_note')}</p>
        {sources.length === 0 ? (
          <p className={pages.para}>
            {loadFailed
              ? t('channel_database.meshcore_import_sources_failed', 'Could not load the source list. Close this and try again.')
              : t('channel_database.meshcore_import_no_sources', 'No MeshCore device source is configured.')}
          </p>
        ) : (
          <label className={styles.field}>
            <span className={pages.infoLabel}>{t('channel_database.meshcore_import_source', 'MeshCore source')}</span>
            <select
              className={pages.keyInput}
              value={sourceId}
              disabled={busy}
              onChange={(e) => {
                setSourceId(e.target.value);
                setResult(null);
              }}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
        {result && (
          <ul className={styles.resultList} data-testid="meshcore-import-result">
            <li>{t('channel_database.meshcore_import_added', '{{count}} added', { count: result.imported.length })}</li>
            <li>{t('channel_database.meshcore_import_duplicates', '{{count}} already stored (same key)', { count: duplicates })}</li>
            {noSecret > 0 && <li>{t('channel_database.meshcore_import_no_secret', '{{count}} skipped (no key)', { count: noSecret })}</li>}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
