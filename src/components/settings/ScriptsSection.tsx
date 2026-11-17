import React, { useRef } from 'react';
import { UiIcon } from '../icons';
import ScriptDependenciesPanel from '../auto-responder/ScriptDependenciesPanel';
import { describeRef, formatBytes, formatDate, getLanguageIcon, useScriptsInventory, VALID_EXTENSIONS, type StatusFilter } from './useScriptsInventory';
import styles from './ScriptsSection.module.css';

/**
 * Scripts inventory (issue #4942).
 *
 * A global-settings section that lists every script in /data/scripts/, shows
 * which Auto Responders / Timers / Geofences use each one (or flags it as
 * unused), and lets an admin import or delete scripts. This is the read-only
 * inventory half of the proposed extension manager; remote gallery install and
 * Docker add-on management are intentionally out of scope.
 */

interface ScriptsSectionProps {
  baseUrl: string;
  /** When false, import/delete controls are hidden (read-only view). */
  canWrite?: boolean;
}

const ScriptsSection: React.FC<ScriptsSectionProps> = ({ baseUrl, canWrite = true }) => {
  const {
    scripts, loading, isImporting, isDeleting, confirmDelete, setConfirmDelete, search, setSearch,
    updates, isChecking, checkedAt, busyScript, sourceDraft, setSourceDraft, statusFilter, setStatusFilter,
    handleCheckUpdates, handleUpdate, handleRollback, handleSaveSource, updateCount, handleFileSelected,
    handleDelete, usedCount, filtered,
  } = useScriptsInventory(baseUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  return (
    <div id="settings-scripts" className="settings-section">
      <h3><UiIcon name="list" size={18} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Scripts</h3>
      <p className={styles.description}>
        Scripts in <code>/data/scripts/</code> available to Auto Responders, Timers, and Geofences.
        {scripts.length > 0 && ` ${scripts.length} installed, ${usedCount} in use.`}
        {checkedAt !== null && (updateCount > 0
          ? ` ${updateCount} update${updateCount === 1 ? '' : 's'} available.`
          : ' All checked scripts are up to date.')}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept={VALID_EXTENSIONS.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <div className={styles.toolbar}>
        {canWrite && (
          <button className={styles.importBtn} onClick={handleImportClick} disabled={isImporting}>
            {isImporting ? 'Importing…' : <><UiIcon name="import" size={15} /> Import Script</>}
          </button>
        )}

        <input
          className={styles.searchInput}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search scripts…"
        />

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All</option>
          <option value="used">In use</option>
          <option value="unused">Unused</option>
        </select>

        <button
          className={styles.importBtn}
          onClick={() => void handleCheckUpdates()}
          disabled={isChecking || scripts.length === 0}
          title="Ask each script's source repository which version it publishes"
        >
          {isChecking ? 'Checking…' : <><UiIcon name="refresh" size={15} /> Check for updates</>}
        </button>

        <a
          className={styles.galleryLink}
          href="https://meshmonitor.org/user-scripts.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          Script Gallery
        </a>
      </div>

      {loading ? (
        <div className={styles.emptyState}>Loading…</div>
      ) : scripts.length === 0 ? (
        <div className={styles.emptyState}>No scripts found in /data/scripts/</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>No scripts match the current filter.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map(script => {
            const inUse = script.usedBy.length > 0;
            const isConfirming = confirmDelete === script.filename;
            const update = updates[script.filename];
            return (
              <div key={script.path} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.scriptName}>
                    <span className={styles.scriptTitle}>
                      {script.emoji
                        ? <span>{script.emoji}</span>
                        : <UiIcon name={getLanguageIcon(script.language)} size={15} />}
                      {script.name || script.filename}
                    </span>
                    <div className={styles.scriptMeta}>
                      <code>{script.filename}</code>
                      {' · '}{script.language}
                      {script.version ? ` · v${script.version}` : ''}
                      {script.author ? ` · ${script.author}` : ''}
                      {' · '}{formatBytes(script.sizeBytes)}
                      {' · '}updated {formatDate(script.lastModified)}
                    </div>
                  </span>

                  <span className={`${styles.badge} ${inUse ? styles.badgeInUse : styles.badgeUnused}`}>
                    {inUse ? 'In use' : 'Unused'}
                  </span>

                  {update?.updateAvailable && (
                    <span className={`${styles.badge} ${styles.badgeUpdate}`}>
                      v{update.latestVersion} available
                    </span>
                  )}

                  {canWrite && !isConfirming && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmDelete(script.filename)}
                      disabled={isDeleting === script.filename}
                    >
                      <UiIcon name="delete" size={13} /> Delete
                    </button>
                  )}
                </div>

                {update && (
                  <div className={styles.updateRow}>
                    <span className={styles.updateText}>
                      {update.source ? (
                        <>
                          Source:{' '}
                          <a href={update.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer">{update.source}</a>
                          {update.sourceOrigin === 'gallery' ? ' (from the gallery listing)' : ''}
                          {update.sourceOrigin === 'manual' ? ' (set here)' : ''}
                          {update.latestVersion ? ` · publishes v${update.latestVersion}` : ''}
                        </>
                      ) : (
                        'No update source. Add the script\'s GitHub path to check it.'
                      )}
                      {update.error ? ` · ${update.error}` : ''}
                    </span>

                    {canWrite && update.updateAvailable && (
                      <button
                        className={styles.updateBtn}
                        onClick={() => void handleUpdate(script.filename)}
                        disabled={busyScript === script.filename}
                      >
                        {busyScript === script.filename ? 'Working…' : <><UiIcon name="download" size={13} /> Update</>}
                      </button>
                    )}

                    {canWrite && update.hasBackup && (
                      <button
                        className={styles.rollbackBtn}
                        onClick={() => void handleRollback(script.filename)}
                        disabled={busyScript === script.filename}
                        title={update.backupVersion ? `Restore v${update.backupVersion}` : 'Restore the previous file'}
                      >
                        <UiIcon name="back" size={13} /> Roll back
                      </button>
                    )}

                    {canWrite && !update.source && (
                      <>
                        <input
                          className={styles.sourceInput}
                          type="text"
                          value={sourceDraft[script.filename] ?? ''}
                          onChange={e => setSourceDraft(prev => ({ ...prev, [script.filename]: e.target.value }))}
                          placeholder="owner/repo/path/to/script.py"
                        />
                        <button
                          className={styles.updateBtn}
                          onClick={() => void handleSaveSource(script.filename)}
                          disabled={busyScript === script.filename || !(sourceDraft[script.filename] ?? '').trim()}
                        >
                          Save source
                        </button>
                      </>
                    )}
                  </div>
                )}

                {inUse && (
                  <ul className={styles.usageList}>
                    {script.usedBy.map((ref, i) => (
                      <li key={`${ref.sourceId}-${ref.type}-${ref.triggerId ?? i}`}>{describeRef(ref)}</li>
                    ))}
                  </ul>
                )}

                {isConfirming && (
                  <div className={styles.confirmBox}>
                    <div className={styles.confirmText}>
                      {inUse ? (
                        <>Delete <strong>{script.filename}</strong>? It is used by {script.usedBy.length}{' '}
                        automation{script.usedBy.length === 1 ? '' : 's'} listed above, which will break until reconfigured.</>
                      ) : (
                        <>Delete <strong>{script.filename}</strong>? This cannot be undone.</>
                      )}
                    </div>
                    <div className={styles.confirmActions}>
                      <button
                        className={styles.confirmDeleteBtn}
                        onClick={() => handleDelete(script.filename)}
                        disabled={isDeleting === script.filename}
                      >
                        {isDeleting === script.filename ? 'Deleting…' : inUse ? 'Delete Anyway' : 'Delete'}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setConfirmDelete(null)}
                        disabled={isDeleting === script.filename}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ScriptDependenciesPanel />
    </div>
  );
};

export default ScriptsSection;
