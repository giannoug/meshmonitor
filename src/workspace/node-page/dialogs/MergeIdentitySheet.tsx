/**
 * Merge node history (boards 15-06, 15-19; s15n2): NodeIdentityMergeDialog's
 * flow (useNodeIdentityMerge) as a sheet. It opens on today's dry run (the
 * per-table plan from the code that performs the merge), shows the
 * unverified-pairing warning and Before you confirm, and a merge too large to
 * undo keeps Merge history off until today's check box is ticked. The phone
 * table drops the Column column, as board 15-19 does. Takes the
 * dialog's props, so the renumbering notice can open it (`mergeDialog`).
 * Admins only, as today (the caller's gate); it sends nothing on the mesh.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import type { NodeIdentityMergeDialogProps } from '../../../components/NodeIdentityMergeDialog';
import { isMergeDropAction, mergeActionLabel, useNodeIdentityMerge } from '../../../hooks/useNodeIdentityMerge';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import { useIsPhone } from '../../shell/useIsPhone';
import SendsLine from '../../patterns/SendsLine';
import styles from './MergeIdentitySheet.module.css';

export default function MergeIdentitySheet({ sourceId, fromNodeNum, toNodeNum, fromLabel, toLabel, onClose, onMerged }: NodeIdentityMergeDialogProps) {
  const { t } = useTranslation();
  // The phone board (15-19) drops the Column column so the table fits.
  const showColumn = !useIsPhone();
  const merge = useNodeIdentityMerge({ sourceId, fromNodeNum, toNodeNum, onClose, onMerged });
  const { preview } = merge;
  const warning = (title: string, body: string) => (
    <div className={styles.warning}>
      <UiIcon name="alert" size={16} className={styles.warningIcon} />
      <p><strong>{title}</strong> {body}</p>
    </div>
  );

  return (
    <ConfirmSheet
      submitOnEnter={false}
      open
      title={
        <span className={styles.title}>
          <UiIcon name="alert" size={20} className={styles.titleIcon} />
          {t('nodes.merge_title', 'Merge node history')}
        </span>
      }
      confirmLabel={merge.merging ? t('nodes.merge_running', 'Merging…') : t('nodes.merge_confirm', 'Merge history')}
      danger
      busy={merge.merging}
      confirmDisabled={!merge.canMerge}
      onCancel={onClose}
      onConfirm={merge.handleMerge}
      body={
        <div className={styles.merge}>
          <div className={styles.direction}>
            <div className={styles.chip}>
              <span className={styles.role}>{t('nodes.merge_from', 'Retire')}</span>
              <span className={styles.chipName}>{fromLabel}</span>
              <span className={styles.mono}>{preview?.fromNodeId ?? ''}</span>
            </div>
            <div className={styles.chip}>
              <span className={styles.role}>{t('nodes.merge_to', 'Keep')}</span>
              <span className={styles.chipName}>{toLabel}</span>
              <span className={styles.mono}>{preview?.toNodeId ?? ''}</span>
            </div>
          </div>
          <p>{t('nodes.merge_explanation')}</p>
          {merge.error && <p className={styles.error} role="alert">{merge.error}</p>}
          {merge.loading && <p className={styles.muted}>{t('nodes.merge_loading', 'Counting affected rows…')}</p>}
          {preview && (
            <>
              {preview.detectionBasis === 'manual' &&
                warning(t('nodes.merge_unverified_title'), t('nodes.merge_unverified_body'))}
              <p className={styles.totals}>
                <span><strong>{t('nodes.merge_total_rekeyed', 'Rows moved:')}</strong> {preview.totalRowsRekeyed.toLocaleString()}</span>
                <span><strong>{t('nodes.merge_total_dropped', 'Rows removed:')}</strong> {preview.totalRowsDropped.toLocaleString()}</span>
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('nodes.merge_col_table', 'Table')}</th>
                      {showColumn && <th>{t('nodes.merge_col_column', 'Column')}</th>}
                      <th>{t('nodes.merge_col_action', 'Action')}</th>
                      <th className={styles.numeric}>{t('nodes.merge_col_rows', 'Rows')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((entry, index) => (
                      <tr key={`${entry.table}-${entry.column}-${index}`}>
                        <td className={styles.mono}>{entry.table}</td>
                        {showColumn && <td className={styles.mono}>{entry.column}</td>}
                        <td data-drop={isMergeDropAction(entry.action) || undefined}>
                          {mergeActionLabel(entry.action, t)}
                          {entry.note && <div className={styles.muted}>{entry.note}</div>}
                        </td>
                        <td className={styles.numeric}>{entry.rows.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.warnings.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.heading}>{t('nodes.merge_warnings_title', 'Before you confirm')}</h3>
                  <ul className={styles.list}>
                    {preview.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </section>
              )}
              <details className={styles.details}>
                <summary>{t('nodes.merge_not_rekeyed_summary', { count: preview.notRekeyed.length })}</summary>
                <ul className={styles.list}>
                  {preview.notRekeyed.map((entry) => (
                    <li key={entry.table}><span className={styles.mono}>{entry.table}</span> — {entry.reason}</li>
                  ))}
                </ul>
              </details>
              {merge.needsAcknowledgement ? (
                <>
                  {warning(t('nodes.merge_no_undo_title'), t('nodes.merge_no_undo_body'))}
                  <label className={styles.check}>
                    <input type="checkbox" checked={merge.acknowledged} onChange={(e) => merge.setAcknowledged(e.target.checked)} />
                    {t('nodes.merge_no_undo_ack')}
                  </label>
                </>
              ) : (
                <p>{t('nodes.merge_undo_available')}</p>
              )}
            </>
          )}
          <SendsLine>{t('workspace.node_dialogs.merge_sends')}</SendsLine>
        </div>
      }
    />
  );
}
