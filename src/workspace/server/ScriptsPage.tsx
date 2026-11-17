/**
 * Server › Scripts (boards 13-09 desktop, 13-25 phone): admins only, as
 * today's section. The cards draw ScriptsSection's states (s13n6) through its
 * own hook (`useScriptsInventory`, Rule X), so every request, body and toast
 * is today's:
 *
 * - The inventory is read once on open and after each change; Check for
 *   updates is the only thing that asks GitHub, and only when pressed.
 * - Update shows only when a newer version is published, Roll back only when
 *   a backup exists, the GitHub path with Save source only when the script has
 *   no update source (s13n6).
 * - Delete asks first with today's words, naming the automations a script in
 *   use breaks (Delete Anyway); Enter does not confirm.
 * - Script dependencies sit below the cards (`useScriptDependencies`).
 *
 * Mesh impact: none on this page. A script runs only when an automation calls
 * it; the automation shows its own Sends line.
 */
import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import {
  describeRef,
  formatBytes,
  formatDate,
  getLanguageIcon,
  useScriptsInventory,
  VALID_EXTENSIONS,
  type InventoryScript,
  type ScriptUpdateStatus,
  type StatusFilter,
} from '../../components/settings/useScriptsInventory';
import { useScriptDependencies, type KindStatus } from '../../components/auto-responder/useScriptDependencies';
import { appBasename } from '../../init';
import ConfirmSheet from '../patterns/ConfirmSheet';
import StateView from '../patterns/StateView';
import SettingGroup from '../settings/kit/SettingGroup';
import SettingSegmented from '../settings/kit/SettingSegmented';
import { useIsPhone } from '../shell/useIsPhone';
import ServerFrame from './ServerFrame';
import pages from '../settings/categories/SettingsPages.module.css';
import styles from './Server.module.css';

type Inventory = ReturnType<typeof useScriptsInventory>;

export default function ScriptsPage() {
  const { t } = useTranslation();
  return (
    <ServerFrame categoryId="scripts" title={t('workspace.server.nav.scripts')} scope={t('workspace.server.scope_admins')} icon="code" gate="admin" needsSettings={false}>
      <Scripts />
    </ServerFrame>
  );
}

function Scripts() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const inv = useScriptsInventory(appBasename);
  const file = useRef<HTMLInputElement>(null);
  const deleting = inv.scripts.find((s) => s.filename === inv.confirmDelete) ?? null;
  const count = [
    t('workspace.server.scripts_count', { count: inv.scripts.length }),
    inv.checkedAt !== null &&
      (inv.updateCount > 0 ? t('workspace.server.scripts_updates', { count: inv.updateCount }) : t('workspace.server.scripts_up_to_date')),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <p className={styles.lead}>{t('workspace.server.scripts_desc')}</p>
      <input ref={file} type="file" accept={VALID_EXTENSIONS.join(',')} hidden onChange={(e: ChangeEvent<HTMLInputElement>) => void inv.handleFileSelected(e)} />
      <div className={styles.scriptToolbar} data-phone={isPhone || undefined}>
        <span className={styles.toolbarButtons}>
          <button type="button" className={pages.button} disabled={inv.isImporting} onClick={() => file.current?.click()}>
            <UiIcon name="upload" size={16} />
            {inv.isImporting ? t('workspace.server.script_importing') : t('workspace.server.script_import')}
          </button>
          <button
            type="button"
            className={pages.button}
            title={t('workspace.server.script_check_hint')}
            disabled={inv.isChecking || inv.scripts.length === 0}
            onClick={() => void inv.handleCheckUpdates()}
          >
            <UiIcon name="refresh" size={16} />
            {inv.isChecking ? t('workspace.server.script_checking') : t('workspace.server.script_check')}
          </button>
        </span>
        <input
          type="search"
          className={styles.search}
          aria-label={t('workspace.server.scripts_search')}
          placeholder={t('workspace.server.scripts_search')}
          value={inv.search}
          onChange={(e) => inv.setSearch(e.target.value)}
        />
        <SettingSegmented
          label={t('workspace.server.scripts_show')}
          value={inv.statusFilter}
          onChange={(v) => inv.setStatusFilter(v as StatusFilter)}
          options={[
            { value: 'all', label: t('workspace.server.scripts_all') },
            { value: 'used', label: t('workspace.server.scripts_in_use') },
            { value: 'unused', label: t('workspace.server.scripts_unused') },
          ]}
        />
        {inv.scripts.length > 0 && <span className={styles.scriptCount}>{count}</span>}
      </div>

      {inv.loading ? (
        <StateView kind="loading" />
      ) : inv.scripts.length === 0 ? (
        <p className={styles.lead}>{t('workspace.server.scripts_none')}</p>
      ) : inv.filtered.length === 0 ? (
        <p className={styles.lead}>{t('workspace.server.scripts_no_match')}</p>
      ) : (
        <div className={styles.scriptGrid} data-phone={isPhone || undefined}>
          {inv.filtered.map((s) => (
            <ScriptCard key={s.path} script={s} update={inv.updates[s.filename]} inv={inv} />
          ))}
        </div>
      )}

      <p className={styles.pageNote}>
        <UiIcon name="info" size={16} />
        <span>
          {t('workspace.server.scripts_note')}{' '}
          <a className={pages.link} href="https://meshmonitor.org/user-scripts.html" target="_blank" rel="noopener noreferrer">
            {t('workspace.server.script_gallery')}
          </a>
        </span>
      </p>

      <Dependencies />

      <ConfirmSheet
        open={deleting !== null}
        title={t('workspace.server.script_delete_title')}
        body={
          deleting && (
            <>
              {deleting.usedBy.length > 0 && (
                <ul className={styles.usageList}>
                  {deleting.usedBy.map((ref, i) => (
                    <li key={`${ref.sourceId}-${ref.type}-${ref.triggerId ?? i}`}>{describeRef(ref)}</li>
                  ))}
                </ul>
              )}
              <p className={pages.para}>
                {deleting.usedBy.length > 0
                  ? t('workspace.server.script_delete_used', { name: deleting.filename, count: deleting.usedBy.length })
                  : t('workspace.server.script_delete_unused', { name: deleting.filename })}
              </p>
            </>
          )
        }
        confirmLabel={deleting && deleting.usedBy.length > 0 ? t('workspace.server.script_delete_anyway') : t('workspace.server.script_delete_confirm')}
        danger
        busy={inv.isDeleting !== null}
        submitOnEnter={false}
        onConfirm={() => (deleting ? inv.handleDelete(deleting.filename) : undefined)}
        onCancel={() => inv.setConfirmDelete(null)}
      />
    </>
  );
}

function ScriptCard({ script: s, update, inv }: { script: InventoryScript; update?: ScriptUpdateStatus; inv: Inventory }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const title = s.name || s.filename;
  const busy = inv.busyScript === s.filename;
  const inUse = s.usedBy.length > 0;
  const meta = [s.language, s.version && `v${s.version}`, s.author, formatBytes(s.sizeBytes), t('workspace.server.script_updated', { date: formatDate(s.lastModified) })]
    .filter(Boolean)
    .join(' · ');
  const draft = inv.sourceDraft[s.filename] ?? '';
  const remove = (
    <button
      type="button"
      className={`${pages.iconButton} ${pages.dangerButton}`}
      aria-label={t('workspace.server.script_delete', { name: s.filename })}
      disabled={inv.isDeleting === s.filename}
      onClick={() => inv.setConfirmDelete(s.filename)}
    >
      <UiIcon name="delete" size={18} />
    </button>
  );

  return (
    <article className={styles.scriptCard} aria-label={title} data-phone={isPhone || undefined}>
      <div className={styles.scriptHead}>
        <span className={styles.scriptIcon}>
          <UiIcon name={getLanguageIcon(s.language)} size={20} />
        </span>
        <div className={styles.scriptName}>
          <h3 className={styles.scriptTitle}>{title}</h3>
          <div className={styles.scriptFile}>{s.filename}</div>
          <p className={styles.scriptMeta}>{meta}</p>
        </div>
        <span className={styles.badges}>
          <span className={styles.badge} data-tone={inUse ? 'on' : undefined}>
            {inUse ? t('workspace.server.scripts_in_use') : t('workspace.server.scripts_unused')}
          </span>
          {update?.updateAvailable && (
            <span className={styles.badge} data-tone="update">
              {t('workspace.server.script_available', { version: update.latestVersion })}
            </span>
          )}
        </span>
      </div>

      {update && (
        <p className={styles.scriptLine}>
          {update.source ? (
            <>
              {t('workspace.server.script_source')}{' '}
              <a href={update.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                {update.source}
              </a>
              {update.sourceOrigin === 'gallery' && ` ${t('workspace.server.script_source_gallery')}`}
              {update.sourceOrigin === 'manual' && ` ${t('workspace.server.script_source_manual')}`}
              {update.latestVersion && ` · ${t('workspace.server.script_publishes', { version: update.latestVersion })}`}
            </>
          ) : (
            t('workspace.server.script_no_source')
          )}
          {update.error ? ` · ${update.error}` : ''}
        </p>
      )}

      <div className={styles.scriptActions}>
        {update?.updateAvailable && (
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={busy} onClick={() => void inv.handleUpdate(s.filename)}>
            <UiIcon name="download" size={16} />
            {busy ? t('workspace.server.script_working') : t('workspace.server.script_update')}
          </button>
        )}
        {update?.hasBackup && (
          <>
            <button
              type="button"
              className={pages.button}
              disabled={busy}
              title={update.backupVersion ? t('workspace.server.script_rollback_title', { version: update.backupVersion }) : undefined}
              onClick={() => void inv.handleRollback(s.filename)}
            >
              <UiIcon name="back" size={16} />
              {t('workspace.server.script_rollback')}
            </button>
            {update.backupVersion && <span className={styles.scriptMeta}>{t('workspace.server.script_rollback_to', { version: update.backupVersion })}</span>}
          </>
        )}
        {update && update.source && !update.updateAvailable && !update.hasBackup && (
          <span className={styles.scriptMeta}>
            {t('workspace.server.script_up_to_date')} · {t('workspace.server.script_no_backup')}
          </span>
        )}
        {update && !update.source && (
          <>
            <input
              type="text"
              className={styles.sourceInput}
              aria-label={t('workspace.server.script_source_label', { name: s.filename })}
              placeholder={t('workspace.server.script_source_placeholder')}
              value={draft}
              onChange={(e) => inv.setSourceDraft((prev) => ({ ...prev, [s.filename]: e.target.value }))}
            />
            <button type="button" className={pages.button} disabled={busy || !draft.trim()} onClick={() => void inv.handleSaveSource(s.filename)}>
              {t('workspace.server.script_save_source')}
            </button>
          </>
        )}
        {remove}
      </div>

      {inUse && <p className={styles.scriptMeta}>{t('workspace.server.script_used_by', { list: s.usedBy.map(describeRef).join(', ') })}</p>}
    </article>
  );
}

/** Today's ScriptDependenciesPanel, redrawn: what each manifest declares, Install / Update (settings:write), the log. */
function Dependencies() {
  const { t } = useTranslation();
  const deps = useScriptDependencies();
  if (!deps.status) return null;
  const nothingDeclared = !deps.status.python.manifestPresent && !deps.status.node.manifestPresent;
  const kind = (title: string, manifest: string, k: KindStatus) => (
    <div className={pages.infoRow}>
      <span className={pages.infoText}>
        <span className={pages.infoLabel}>{title}</span>
        <span className={pages.infoHelp}>
          {k.manifestPresent ? t('workspace.server.deps_found', { manifest, count: k.packages.length }) : t('workspace.server.deps_missing', { manifest })}
        </span>
        {k.packages.length > 0 && <span className={pages.infoHelp}>{k.packages.join(', ')}</span>}
      </span>
    </div>
  );
  return (
    <SettingGroup title={t('scripts.deps.title', 'Script Dependencies')}>
      <p className={styles.cardPara}>
        {t('scripts.deps.description', 'Install Python/Node packages your scripts need. Add a requirements.txt (Python) or package.json (Node) to the scripts directory, then install. Packages are installed next to your scripts and persist across restarts.')}
      </p>
      {kind('Python', 'requirements.txt', deps.status.python)}
      {kind('Node', 'package.json', deps.status.node)}
      {nothingDeclared && <p className={styles.cardPara}>{t('scripts.deps.none', 'No dependency manifest found in the scripts directory yet.')}</p>}
      <p className={styles.cardPara}>
        <span className={pages.warn}>
          <UiIcon name="alert" size={14} />
          {t('scripts.deps.warning', 'Installing downloads and runs third-party code, and requires internet access. On the slim Docker image, packages without a prebuilt musl wheel will fail unless SCRIPT_DEPS_ALLOW_SOURCE_BUILD=true.')}
        </span>
      </p>
      {deps.canInstall && (
        <div className={styles.cardActions}>
          <button type="button" className={`${pages.button} ${pages.primary}`} disabled={deps.installing || nothingDeclared} onClick={() => void deps.install()}>
            <UiIcon name="download" size={16} />
            {deps.installing ? t('scripts.deps.installing', 'Installing…') : t('scripts.deps.install', 'Install / Update dependencies')}
          </button>
        </div>
      )}
      {deps.error && (
        <p className={styles.cardPara} role="alert">
          <span className={pages.error}>{deps.error}</span>
        </p>
      )}
      {deps.log && <pre className={styles.log}>{deps.log}</pre>}
    </SettingGroup>
  );
}
