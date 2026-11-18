/**
 * Settings › Maintenance (boards 8-10, 8-27): today's Radio contact list,
 * Node database, Backups and Danger zone, on today's requests:
 *
 * - Radio contact list (Companion): useMeshCoreContactSync (moved out of
 *   MeshCoreContactSyncSection, Rule X). Auto-add, max hops and replace-oldest
 *   each write one setting to the radio when changed; Push to radio one push;
 *   Remove non-favourite contacts asks with what and how many, then one request.
 * - Node database: Purge non-favourite nodes reads the count, asks with it,
 *   then one request; MeshMonitor's database only.
 * - Backups (Companion): useBackupManagement `protocol: 'meshcore'` (Phase 5).
 * - Danger zone (connected, configuration:write): Reboot Device asks plainly;
 *   Shut down, Restore Private Key and Factory Reset ask for the device name
 *   (the first 8 key characters when it has none); Backup Private Key shows
 *   the key once (OneTimeReveal) and warns that anyone with it can
 *   impersonate the device. Each sends `confirm: true` once, from the sheet's
 *   button only. Factory Reset needs a Companion on firmware v7 or later.
 *
 * Every one of these works over the radio's connection or on MeshMonitor's
 * database and sends nothing on the mesh. Opening the page reads the contact
 * list state (Companion) and, for a local repeater, its settings, as today.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { NumberInput } from '../../../components/common/NumberInput';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { FactoryResetWipeList } from '../../../components/shared/config/FactoryResetWipeList';
import { BackupRestoreSummary } from '../../../components/configuration/BackupRestoreConfirmDialog';
import { formatBackupTimestamp, useBackupManagement } from '../../../components/configuration/useBackupManagement';
import { COMPANION_CMD_FIRMWARE_MIN } from '../../../components/MeshCore/MeshCoreMultiAcksSection';
import { companionCapabilities, type DeviceManagementCapabilities } from '../../../components/MeshCore/deviceManagementCapabilities';
import { MAX_HOPS_CHOICES, TYPE_ORDER, useMeshCoreContactSync, type AddMode } from '../../../components/MeshCore/hooks/useMeshCoreContactSync';
import type { RepeaterSettingsSnapshot } from '../../../components/MeshCore/hooks/useMeshCore';
import { appBasename } from '../../../init';
import apiService, { ApiError } from '../../../services/api';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import OneTimeReveal from '../../patterns/OneTimeReveal';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import { useSettingsHeader } from '../../settings/settingsDock';
import { useIsPhone } from '../../shell/useIsPhone';
import { McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

type Danger = 'reboot' | 'powerOff' | 'restore' | 'factoryReset';

export default function MaintenanceCategory({ sourceId }: CategoryProps) {
  const d = useMcDevice();
  const isPhone = useIsPhone();
  useSettingsHeader({ scope: d.deviceName });
  const notCompanionOnly = ![2, 3].includes(d.local?.advType ?? 1);
  const showBackups = d.canReadConfig && !d.isRepeater && notCompanionOnly;
  const showDanger = d.connected && d.canWriteConfig && (notCompanionOnly || d.isRepeater);
  return (
    <McPage>
      {d.isCompanion && <ContactList sourceId={sourceId} />}
      <div className={styles.twoUp} data-phone={isPhone || undefined}>
        <NodePurge sourceId={sourceId} />
        {showBackups && <Backups sourceId={sourceId} />}
      </div>
      {showDanger && <DeviceDanger />}
    </McPage>
  );
}

function ContactList({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const c = useMeshCoreContactSync({ baseUrl: appBasename, sourceId, connected: d.connected, canEditConfig: d.canWriteConfig });
  const nodesOff = !d.canWriteNodes || !d.connected;
  return (
    <section className={styles.section} aria-labelledby="mc-contacts-title">
      <h2 className={styles.heading} id="mc-contacts-title">{t('meshcore.contact_sync.title')}</h2>
      <div className={styles.card}>
        <div className={styles.block}>
          <span className={styles.rowLabel}>{t('meshcore.contact_sync.auto_add_label')}</span>
          {c.mode === null ? (
            <span className={styles.inline}>
              <span>{c.autoAdd === null ? t('meshcore.contact_sync.unknown', 'Unknown') : t(c.autoAdd ? 'meshcore.contact_sync.on' : 'meshcore.contact_sync.off')}</span>
              {d.canWriteConfig && c.autoAdd !== null && (
                <button type="button" className={styles.button} disabled={!d.connected || c.savingAutoAdd} onClick={() => void c.handleToggleAutoAdd(!c.autoAdd)}>
                  {c.savingAutoAdd ? t('common.saving', 'Saving…') : t(c.autoAdd ? 'meshcore.contact_sync.turn_off' : 'meshcore.contact_sync.turn_on')}
                </button>
              )}
            </span>
          ) : (
            <>
              <span className={styles.segments} role="radiogroup" aria-label={t('meshcore.contact_sync.auto_add_label')}>
                {(['all', 'types', 'none'] as AddMode[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={c.mode === m} className={styles.segment} disabled={c.configLocked} onClick={() => void c.handleMode(m)}>
                    {t(`meshcore.contact_sync.mode_${m}`)}
                  </button>
                ))}
              </span>
              <span className={styles.checks}>
                {TYPE_ORDER.map((k) => (
                  <label key={k} className={styles.check}>
                    <input type="checkbox" checked={c.config!.types[k]} disabled={c.configLocked || c.mode !== 'types'} onChange={(e) => void c.handleType(k, e.target.checked)} />
                    {c.typeLabels[k]}
                  </label>
                ))}
              </span>
            </>
          )}
          <span className={styles.muted}>{t(c.mode === null ? 'meshcore.contact_sync.auto_add_hint' : 'meshcore.contact_sync.types_hint')}</span>
        </div>
        {c.mode !== null && c.mode !== 'none' && (
          <label className={styles.cardRow}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t('meshcore.contact_sync.max_hops_label')}</span>
              <span className={styles.muted}>{t('meshcore.contact_sync.max_hops_hint')}</span>
            </span>
            <select className={styles.select} value={c.config!.maxHops} disabled={c.configLocked} onChange={(e) => void c.handleMaxHops(Number(e.target.value))}>
              {(c.hopChoices ?? MAX_HOPS_CHOICES).map((v) => <option key={v} value={v}>{c.hopLabel(v)}</option>)}
            </select>
          </label>
        )}
        {c.mode !== null && (
          <label className={styles.cardRow}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t('meshcore.contact_sync.overwrite_label')}</span>
              <span className={styles.muted}>{t('meshcore.contact_sync.overwrite_hint')}</span>
            </span>
            <input type="checkbox" role="switch" className={styles.switch} checked={c.config!.overwriteOldest} disabled={c.configLocked} onChange={(e) => void c.handleOverwrite(e.target.checked)} />
          </label>
        )}
        {c.config && !c.config.supported && <p className={styles.muted}>{t('meshcore.contact_sync.unsupported', 'This firmware does not support auto-add options.')}</p>}
        {c.status?.deviceContactsKnown === false && <p className={styles.muted}>{t('meshcore.contact_sync.device_list_unknown')}</p>}
        {c.missing > 0 && (
          <p className={styles.warn} role="status">
            <UiIcon name="alert" size={16} />
            <span>
              {t('meshcore.contact_sync.missing_favorites', { count: c.missing })}
              {c.autoAdd === false && <> {t('meshcore.contact_sync.auto_add_off_explain')}</>}
            </span>
          </p>
        )}
        {d.canWriteNodes && (
          <div className={styles.cardRow}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t('workspace.meshcore.settings.push_title')}</span>
              <span className={styles.muted}>{t('meshcore.contact_sync.push_hint')}</span>
              <SendsLine>{t('workspace.meshcore.settings.sends_push')}</SendsLine>
            </span>
            <button type="button" className={styles.button} disabled={nodesOff || c.pushing} onClick={() => void c.handlePush()}>
              {c.pushing ? t('meshcore.contact_sync.pushing') : t('meshcore.contact_sync.push_button')}
            </button>
          </div>
        )}
        {d.canWriteNodes && (
          <div className={styles.cardRow}>
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{t('meshcore.contact_sync.remove_button')}</span>
              <span className={styles.muted}>{t('meshcore.contact_sync.remove_hint')}</span>
              <SendsLine>{t('workspace.meshcore.settings.sends_remove')}</SendsLine>
            </span>
            <button type="button" className={styles.button} disabled={nodesOff || c.removing || c.removable === 0} onClick={() => c.setConfirmRemove(true)}>
              {t('workspace.meshcore.settings.remove_ellipsis')}
            </button>
          </div>
        )}
        {c.error && <p className={styles.error} role="alert">{c.error}</p>}
        {c.removeResult && (
          <p className={styles.muted} role="status">
            {t('meshcore.contact_sync.remove_result', { removed: c.removeResult.removed, kept: c.removeResult.kept, failed: c.removeResult.failed })}
          </p>
        )}
        {c.pushResult && (
          <ul className={styles.result} role="status">
            <li>{t('meshcore.contact_sync.result_added', { count: c.pushResult.added.length })}</li>
            <li>{t('meshcore.contact_sync.result_already', { count: c.pushResult.alreadyOnDevice })}</li>
            {c.pushResult.notAddedNoRoom > 0 && <li>{t('meshcore.contact_sync.result_no_room', { count: c.pushResult.notAddedNoRoom })}</li>}
            {c.skippedBy('unknown_type') > 0 && <li>{t('meshcore.contact_sync.result_unknown_type', { count: c.skippedBy('unknown_type') })}</li>}
            {c.skippedBy('ignored') > 0 && <li>{t('meshcore.contact_sync.result_ignored', { count: c.skippedBy('ignored') })}</li>}
            {c.skippedBy('failed') > 0 && <li>{t('meshcore.contact_sync.result_failed', { count: c.skippedBy('failed') })}</li>}
            <li>
              {c.pushResult.capacityKnown
                ? t('meshcore.contact_sync.result_slots', { before: c.pushResult.freeSlotsBefore, after: c.pushResult.freeSlotsAfter, max: c.pushResult.maxContacts })
                : t('meshcore.contact_sync.result_capacity_unknown')}
            </li>
            {c.pushResult.error && <li className={styles.error}>{c.pushResult.error}</li>}
          </ul>
        )}
        {c.pushResult && c.pushResult.notAddedNoRoom > 0 && c.pushResult.freeSlotsAfter === 0 && <p className={styles.muted}>{t('meshcore.contact_sync.full_hint')}</p>}
      </div>
      <ConfirmSheet
        open={c.confirmRemove}
        title={t('meshcore.contact_sync.remove_title')}
        body={
          <>
            <p className={styles.para}>{t('meshcore.contact_sync.remove_confirm', { removable: c.removable, kept: c.kept })}</p>
            <p className={styles.muted}>{t('meshcore.contact_sync.remove_confirm_note')}</p>
            <SendsLine>{t('workspace.meshcore.settings.sends_remove')}</SendsLine>
          </>
        }
        confirmLabel={c.removing ? t('meshcore.contact_sync.removing') : t('meshcore.contact_sync.remove_confirm_button')}
        danger
        busy={c.removing}
        submitOnEnter={false}
        onConfirm={() => c.handleRemove()}
        onCancel={() => c.setConfirmRemove(false)}
      />
    </section>
  );
}

/** Today's Purge non-favourite nodes (#6041): MeshMonitor's database only. */
function NodePurge({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const prefix = `/api/sources/${encodeURIComponent(sourceId)}/meshcore`;
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<'count' | 'purge' | null>(null);
  const failed = (e: unknown) => (e instanceof ApiError && e.message ? e.message : t('meshcore.node_purge.failed', 'Failed to purge nodes'));
  const open = async () => {
    setBusy('count');
    try {
      const res = await apiService.get<{ data: { count: number } }>(`${prefix}/nodes/purge-non-favourites/preview`);
      if (res.data.count <= 0) showToast(t('meshcore.node_purge.none', 'No non-favourite nodes to delete.'), 'info');
      else setCount(res.data.count);
    } catch (e) {
      showToast(failed(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const purge = async () => {
    setBusy('purge');
    try {
      const res = await apiService.post<{ data: { deleted: number } }>(`${prefix}/nodes/purge-non-favourites`);
      showToast(t('meshcore.node_purge.done', 'Deleted {{count}} non-favourite nodes.', { count: res.data.deleted }), 'success');
      setCount(null);
    } catch (e) {
      showToast(failed(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className={styles.section} aria-labelledby="mc-nodedb-title">
      <h2 className={styles.heading} id="mc-nodedb-title">{t('meshcore.node_purge.title', 'Node database')}</h2>
      <div className={styles.card}>
        <span className={styles.rowLabel}>{t('meshcore.node_purge.button', 'Purge non-favourite nodes')}</span>
        <span className={styles.muted}>{t('meshcore.node_purge.description', 'Remove stored nodes from MeshMonitor for this source. The radio and its contact list are not touched.')}</span>
        <SendsLine>{t('workspace.meshcore.settings.sends_purge')}</SendsLine>
        {!d.canWriteNodes && <span className={styles.muted}>{t('meshcore.node_purge.needs_nodes_write', 'This needs the Nodes write permission on this source.')}</span>}
        <span>
          <button type="button" className={styles.button} disabled={!d.canWriteNodes || busy !== null} onClick={() => void open()}>
            {busy === 'count' ? t('meshcore.node_purge.checking', 'Checking…') : t('workspace.meshcore.settings.purge_ellipsis')}
          </button>
        </span>
      </div>
      <ConfirmSheet
        open={count !== null}
        title={t('meshcore.node_purge.dialog_title', 'Purge non-favourite nodes?')}
        body={
          <>
            <p className={styles.para}>
              {t('meshcore.node_purge.dialog_message', 'This permanently deletes {{count}} non-favourite nodes from MeshMonitor for this source. Favourites are kept, and the radio is not changed.', { count: count ?? 0 })}
            </p>
            <SendsLine>{t('workspace.meshcore.settings.sends_purge')}</SendsLine>
          </>
        }
        confirmLabel={busy === 'purge' ? t('meshcore.node_purge.purging', 'Purging…') : t('meshcore.node_purge.confirm', 'Delete {{count}} nodes', { count: count ?? 0 })}
        danger
        busy={busy === 'purge'}
        submitOnEnter={false}
        onConfirm={() => purge()}
        onCancel={() => setCount(null)}
      />
    </section>
  );
}

/** Today's device backups for a Companion (#6285): list, download and schedule always; create and restore need the radio. */
function Backups({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const b = useBackupManagement({ protocol: 'meshcore', sourceId });
  const [legacyAck, setLegacyAck] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const { loadBackups } = b;
  useEffect(() => {
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #6365 read once per source; loadBackups is recreated every render
  }, [sourceId]);
  const canWrite = d.canWriteConfig;
  const latest = b.backupList[0];
  const pending = b.pendingRestore;
  return (
    <section className={styles.section} aria-labelledby="mc-backups-title">
      <h2 className={styles.heading} id="mc-backups-title">{t('workspace.meshcore.settings.backups')}</h2>
      <div className={styles.card}>
        <span className={styles.cardRow}>
          <span className={styles.rowText}>
            <span className={styles.rowLabel}>
              {latest ? t('workspace.meshcore.settings.last_backup', { when: formatBackupTimestamp(latest.timestamp) }) : t('workspace.meshcore.settings.no_backup')}
            </span>
            <span className={styles.muted}>{t('workspace.meshcore.settings.stored', { count: b.backupList.length })}</span>
          </span>
          <label className={styles.check}>
            <input type="checkbox" role="switch" className={styles.switch} checked={b.autoBackupEnabled} disabled={!canWrite} onChange={(e) => b.setAutoBackupEnabled(e.target.checked)} />
            {t('workspace.meshcore.settings.daily')}
          </label>
        </span>
        {b.autoBackupEnabled && (
          <NumberInputScope scope={b.numberScope}>
            <span className={styles.inline}>
              <label className={styles.field}>
                <span>{t('backup_management.backup_time').replace(/:\s*$/, '')}</span>
                <input type="time" className={styles.input} value={b.backupTime} disabled={!canWrite} onChange={(e) => b.setBackupTime(e.target.value)} />
              </label>
              <label className={styles.field}>
                <span>{t('backup_management.max_backups').replace(/:\s*$/, '')}</span>
                <NumberInput integer min={1} max={365} className={styles.input} value={b.maxBackups} disabled={!canWrite} onChange={b.setMaxBackups} />
              </label>
            </span>
          </NumberInputScope>
        )}
        <span className={styles.buttons}>
          <button
            type="button"
            className={styles.button}
            disabled={!d.connected || !canWrite}
            title={!d.connected ? t('backup_management.offline_hint') : undefined}
            onClick={async () => {
              await b.handleManualBackup();
              void loadBackups();
            }}
          >
            {t('workspace.meshcore.settings.create_backup')}
          </button>
          {latest && (
            <button type="button" className={styles.plain} disabled={!canWrite} onClick={() => void b.handleDownloadBackup(latest.filename)}>
              {t('backup_management.download')}
            </button>
          )}
        </span>
        {b.backupList.length > 0 && (
          <ul className={styles.backups} aria-label={t('backup_management.modal_title')}>
            {b.backupList.map((f) => (
              <li key={f.filename} className={styles.backup}>
                <span className={styles.muted}>{`${formatBackupTimestamp(f.timestamp)} · ${t(f.type === 'automatic' ? 'backup_management.type_auto' : 'backup_management.type_manual')}`}</span>
                <button type="button" className={styles.plain} disabled={b.restoringFilename !== null || !d.connected || !canWrite} onClick={() => void b.handleRestoreBackup(f.filename)}>
                  {b.restoringFilename === f.filename ? t('backup_management.restoring') : t('backup_management.restore')}
                </button>
                <button type="button" className={styles.plain} disabled={b.restoringFilename !== null || !canWrite} onClick={() => setToDelete(f.filename)}>
                  {t('backup_management.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <SendsLine>{t('workspace.meshcore.settings.sends_backup')}</SendsLine>
      </div>
      <ConfirmSheet
        open={pending !== null}
        title={t('backup_management.restore_dialog_title')}
        body={
          pending && (
            <>
              <p className={styles.para}>{t('backup_management.confirm_restore_meshcore', { filename: pending.filename })}</p>
              <BackupRestoreSummary protocol="meshcore" summary={pending.summary} legacyAck={legacyAck} onLegacyAck={setLegacyAck} />
              <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
            </>
          )
        }
        confirmLabel={t('backup_management.restore')}
        confirmDisabled={!!pending?.summary.legacy && !legacyAck}
        submitOnEnter={false}
        onConfirm={() => {
          setLegacyAck(false);
          void b.confirmRestore();
        }}
        onCancel={() => {
          setLegacyAck(false);
          b.cancelRestore();
        }}
      />
      <ConfirmSheet
        open={toDelete !== null}
        title={t('backup_management.confirm_delete', { filename: toDelete ?? '' })}
        confirmLabel={t('backup_management.delete')}
        danger
        onConfirm={() => {
          const f = toDelete!;
          setToDelete(null);
          void b.deleteBackup(f);
        }}
        onCancel={() => setToDelete(null)}
      />
    </section>
  );
}

/**
 * The danger zone: today's MeshCoreDeviceManagement actions, guards and words,
 * each confirmed in a ConfirmSheet (one at a time) whose button alone sends.
 */
function DeviceDanger() {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { actions, local, isAdmin, isCompanion, isRepeater } = d;
  const [open, setOpen] = useState<Danger | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RepeaterSettingsSnapshot | null>(null);

  // A local repeater's capabilities come with its settings, read over its serial CLI as today's page does.
  const readRepeater = isRepeater && d.connected && d.canReadConfig;
  const { getRepeaterSettings } = actions;
  useEffect(() => {
    if (!readRepeater) return;
    let cancelled = false;
    void Promise.resolve(getRepeaterSettings?.())
      .then((s) => !cancelled && setSnapshot(s ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [readRepeater, getRepeaterSettings]);

  const caps: DeviceManagementCapabilities = isRepeater
    ? {
        reboot: snapshot?.capabilities.reboot ?? true,
        powerOff: snapshot?.capabilities.powerOff ?? false,
        keyExport: snapshot?.capabilities.keyExport ?? false,
        keyImport: snapshot?.capabilities.keyImport ?? false,
        factoryReset: false,
        reasons: snapshot?.capabilities.reasons,
      }
    : companionCapabilities(local?.firmwareVer);
  // Today's typed word: the device name, or the first 8 key characters when it has none.
  const word = (local?.name ?? '').trim() || (local?.publicKey ?? '').slice(0, 8);
  const shown = local?.name || word;
  const firmwareTooOld = typeof local?.firmwareVer === 'number' && local.firmwareVer < COMPANION_CMD_FIRMWARE_MIN;
  const resetBlocked = !isCompanion
    ? t('meshcore.factory_reset.blocked_not_companion', 'Factory reset works on a Companion only.')
    : firmwareTooOld
      ? t('meshcore.factory_reset.blocked_firmware', 'Needs Companion firmware version {{min}} or later.', { min: COMPANION_CMD_FIRMWARE_MIN })
      : null;
  const overNetwork = d.status?.config?.connectionType === 'tcp' || !!d.status?.config?.tcpHost;
  const showPowerOff = caps.powerOff && isAdmin;
  const showImport = caps.keyImport && isAdmin;
  const showReset = caps.factoryReset && isAdmin;
  const keyValid = /^[0-9a-fA-F]{128}$/.test(keyDraft.trim());
  const sends = <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>;

  const close = () => {
    setOpen(null);
    setKeyDraft('');
    setKeyError(null);
  };
  // Today: Shut down and Factory Reset close whatever the answer; Reboot and Restore close on success.
  const run = async (action: () => Promise<boolean>, opts: { always?: boolean; onFail?: () => void } = {}) => {
    setBusy(true);
    try {
      const ok = await action();
      if (ok || opts.always) close();
      else opts.onFail?.();
    } finally {
      setBusy(false);
    }
  };
  const backupKey = async () => {
    setExporting(true);
    setExportedKey(null);
    try {
      const hex = await actions.exportPrivateKey();
      if (hex) setExportedKey(hex);
    } finally {
      setExporting(false);
    }
  };
  const btn = (danger: Danger | 'backup', label: string, disabled: boolean, title?: string | null) => (
    <button
      type="button"
      className={danger === 'factoryReset' ? styles.dangerSolid : styles.danger}
      disabled={disabled}
      title={title ?? undefined}
      onClick={() => (danger === 'backup' ? void backupKey() : setOpen(danger))}
    >
      {label}
    </button>
  );

  return (
    <>
      <DangerZone
        title={
          <span className={styles.inline}>
            <UiIcon name="alert" size={16} /> {t('config.danger_zone')}
          </span>
        }
      >
        {(caps.reboot || showPowerOff) && (
          <div className={styles.dangerRow}>
            <span className={styles.dangerText}>
              <span className={styles.rowLabel}>{t('workspace.meshcore.settings.restart_title')}</span>
              {showPowerOff && word === '' && <span className={styles.muted}>{caps.reasons?.powerOff}</span>}
            </span>
            <span className={styles.buttons}>
              {caps.reboot && btn('reboot', t('meshcore.config.reboot_button'), busy, caps.reasons?.reboot)}
              {showPowerOff && btn('powerOff', t('workspace.meshcore.settings.shut_down_ellipsis'), busy || word === '', caps.reasons?.powerOff)}
            </span>
          </div>
        )}
        {caps.keyExport && (
          <div className={styles.dangerRow}>
            <span className={styles.dangerText}>
              <span className={styles.rowLabel}>{t('workspace.meshcore.settings.backup_key_title')}</span>
            </span>
            {btn('backup', exporting ? t('meshcore.config.exporting_key') : t('meshcore.config.export_key_button'), exporting, caps.reasons?.keyExport)}
          </div>
        )}
        {showImport && (
          <div className={styles.dangerRow}>
            <span className={styles.dangerText}>
              <span className={styles.rowLabel}>{t('workspace.meshcore.settings.restore_key_title')}</span>
            </span>
            {btn('restore', t('workspace.meshcore.settings.restore_key_ellipsis'), busy || word === '', caps.reasons?.keyImport)}
          </div>
        )}
        {showReset && (
          <div className={styles.dangerRow}>
            <span className={styles.dangerText}>
              <span className={styles.rowLabel}>{t('workspace.meshcore.settings.reset_title')}</span>
              {resetBlocked && <span className={styles.muted}>{resetBlocked}</span>}
            </span>
            {btn('factoryReset', t('workspace.meshcore.settings.factory_reset_ellipsis'), busy || !!resetBlocked || word === '', resetBlocked)}
          </div>
        )}
        {sends}
      </DangerZone>

      {exportedKey && (
        <OneTimeReveal
          secrets={[exportedKey]}
          title={t('meshcore.config.export_key_button')}
          intro={t('meshcore.config.export_key_warning')}
          label={t('meshcore.config.import_key_input', 'Private key (hex)')}
          copyLabel={t('meshcore.config.copy_key')}
          // The key is dropped from memory when the card closes.
          onDone={() => setExportedKey(null)}
        />
      )}

      <ConfirmSheet
        open={open === 'reboot'}
        title={t('meshcore.config.reboot_dialog_title')}
        body={
          <>
            <p className={styles.para}>{t('meshcore.config.reboot_dialog_message', { name: local?.name ?? t('meshcore.config.this_device') })}</p>
            {sends}
          </>
        }
        confirmLabel={t('meshcore.config.reboot_button')}
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => run(() => actions.rebootDevice({ confirm: true }))}
        onCancel={close}
      />
      <ConfirmSheet
        open={open === 'powerOff'}
        title={t('meshcore.config.power_off_dialog_title', { name: shown })}
        body={
          <>
            <p className={styles.para}>{t('meshcore.config.power_off_dialog_body', { name: shown })}</p>
            {sends}
          </>
        }
        confirmWord={word}
        confirmLabel={t('device_actions.shutdown.confirm_label', 'Shut down')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => run(() => actions.powerOffDevice({ confirm: true }), { always: true })}
        onCancel={close}
      />
      <ConfirmSheet
        open={open === 'restore'}
        title={t('meshcore.config.import_key_dialog_title')}
        body={
          <>
            <p className={styles.para}>{t('meshcore.config.import_key_dialog_body')}</p>
            {!isCompanion && <p className={styles.para}>{t('meshcore.config.import_key_repeater_note')}</p>}
            <label className={styles.field}>
              <span>{t('meshcore.config.import_key_input', 'Private key (hex)')}</span>
              <PasswordField
                className={`${styles.input} ${styles.mono}`}
                autoComplete="off"
                spellCheck={false}
                value={keyDraft}
                disabled={busy}
                placeholder={t('workspace.meshcore.settings.key_placeholder')}
                onChange={(e) => {
                  setKeyDraft(e.target.value);
                  setKeyError(null);
                }}
              />
            </label>
            {keyDraft.trim() !== '' && !keyValid && <p className={styles.error}>{t('meshcore.config.import_key_invalid')}</p>}
            {keyError && <p className={styles.error} role="alert">{keyError}</p>}
            {sends}
          </>
        }
        confirmWord={word}
        confirmDisabled={!keyValid}
        confirmLabel={t('meshcore.config.import_key_confirm_button')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => run(() => actions.importPrivateKey(keyDraft.trim(), { confirm: true }), { onFail: () => setKeyError(t('meshcore.config.import_key_failed')) })}
        onCancel={close}
      />
      <ConfirmSheet
        open={open === 'factoryReset'}
        title={t('meshcore.factory_reset.dialog_title')}
        body={
          <>
            <FactoryResetWipeList
              items={['settings', 'channels', 'contacts', 'network', 'identity']}
              labels={{
                settings: t('meshcore.factory_reset.wipes_settings'),
                channels: t('meshcore.factory_reset.wipes_channels'),
                identity: t('meshcore.factory_reset.wipes_identity'),
              }}
            />
            <p className={styles.muted}>
              {t('meshcore.factory_reset.identity_note')} {t('meshcore.factory_reset.backup_first')}{' '}
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  close();
                  void backupKey();
                }}
              >
                {t('meshcore.config.export_key_button')}
              </button>
            </p>
            {overNetwork && <p className={styles.warn}>{t('meshcore.factory_reset.network_warning')}</p>}
            {sends}
          </>
        }
        confirmWord={word}
        confirmLabel={t('meshcore.factory_reset.confirm_label', 'Factory Reset')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => run(() => actions.factoryReset({ confirm: true }), { always: true })}
        onCancel={close}
      />
    </>
  );
}
