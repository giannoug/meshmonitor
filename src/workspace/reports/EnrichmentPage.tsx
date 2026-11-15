/**
 * Overview › Reports › NodeInfo Enrichment (boards 6-07, 6-14; notes s6n0,
 * s6n1, s6n3). Today's analysis and actions (`useNodeInfoEnrichment`): the
 * three tiles, Refresh, "Also push to device NodeDB", Fix All and each row's
 * Fix — today's `POST /api/nodes/enrichment/apply`, sent on one click with no
 * confirm, as today — and a row's copy preview (CopyNodeInfoSheet, a confirm
 * sheet). Desktop draws today's table; the phone one ≥52 px row per target.
 *
 * Airtime (s6n1): with push on, Fix and Fix All send 1 NodeInfo request per
 * copied row from the target device on that node's channel; the Sends line
 * says so next to Fix All while push is on. Off, Fix writes MeshMonitor's
 * database only. No client gate: the server answers 403 without
 * `nodes:write` on the target, and the toast shows it, as today.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { nodeInfoFieldLabel } from '../../utils/nodeInfoFields';
import { useNodeInfoEnrichment, type EnrichmentRow } from '../../components/Analysis/useNodeInfoEnrichment';
import CopyNodeInfoSheet from '../node-page/dialogs/CopyNodeInfoSheet';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import parts from './reportParts.module.css';
import styles from './EnrichmentPage.module.css';

export default function EnrichmentPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const u = useNodeInfoEnrichment();
  const { rows, applyMutation, inFlightRowKey } = u;
  const summary = u.data?.summary;
  const pending = applyMutation.isPending;

  const fixLabel = (row: EnrichmentRow) =>
    pending && inFlightRowKey === row.rowKey ? t('analysis.enrichment.fixing', 'Fixing…') : t('analysis.enrichment.fix', 'Fix');
  const fixButton = (row: EnrichmentRow) => (
    <button
      type="button"
      className={parts.ghost}
      onClick={(e) => {
        e.stopPropagation(); // don't also open the row's preview
        u.handleFixRow(row);
      }}
      disabled={pending}
    >
      {fixLabel(row)}
    </button>
  );
  const fields = (row: EnrichmentRow) => (
    <span className={styles.pills}>
      {row.fillableFields.map((f) => (
        <span key={f} className={styles.pill}>{nodeInfoFieldLabel(f)}</span>
      ))}
    </span>
  );

  return (
    <ReportFrame
      back="reports"
      title={t('analysis.enrichment.title', 'NodeInfo Enrichment')}
      subtitle={t('workspace.reports.coverage_live')}
      actions={
        <button type="button" className={parts.ghost} onClick={u.refresh} disabled={u.isFetching}>
          <UiIcon name="refresh" size={16} />
          {t('analysis.enrichment.refresh', 'Refresh')}
        </button>
      }
    >
      {u.isLoading && <p className={parts.banner}>{t('analysis.enrichment.loading', 'Analyzing NodeInfo across sources…')}</p>}
      {u.error && <p className={parts.error} role="alert">{(u.error as Error).message}</p>}
      {!u.isLoading && !u.error && rows.length === 0 && (
        <div className={parts.banner}>
          <p className={styles.bannerLine}>{t('analysis.enrichment.empty', 'No nodes need enrichment.')}</p>
          <p className={styles.bannerLine}>
            {t(
              'analysis.enrichment.empty_hint',
              "Enrichment compares NodeInfo across the sources you can read. If you're signed out or only have access to one source, sign in to see more.",
            )}
          </p>
        </div>
      )}

      {!u.isLoading && !u.error && rows.length > 0 && (
        <>
          {!isPhone && (
            <div className={parts.tiles}>
              {[
                [t('analysis.enrichment.stat_nodes', 'Nodes'), summary?.nodeCount],
                [t('analysis.enrichment.stat_targets', 'Targets'), summary?.targetCount],
                [t('analysis.enrichment.stat_fields', 'Fillable fields'), summary?.fieldCount],
              ].map(([label, value]) => (
                <div key={String(label)} className={parts.tile}>
                  <div className={parts.tileLabel}>{label}</div>
                  <div className={parts.tileValue}>{value ?? 0}</div>
                </div>
              ))}
            </div>
          )}

          <section className={styles.push} data-testid="enrichment-push">
            <div className={styles.pushText}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={u.pushToNodeDb}
                  onChange={(e) => u.setPushToNodeDb(e.target.checked)}
                  disabled={pending}
                />
                {t('analysis.enrichment.push_to_device', 'Also push to device NodeDB')}
              </label>
              <p className={styles.help}>
                {t(
                  'analysis.enrichment.push_to_device_help',
                  'Sends the copied fields to the target device over the mesh, in addition to updating the local database.',
                )}
              </p>
              {u.pushToNodeDb && (
                <SendsLine>
                  {t('workspace.reports.enrichment_sends')} · {t('workspace.reports.enrichment_sends_all', { count: rows.length })}
                </SendsLine>
              )}
              {isPhone && (
                <p className={styles.help}>
                  {t('analysis.enrichment.stat_targets', 'Targets')} {summary?.targetCount ?? 0} ·{' '}
                  {t('analysis.enrichment.stat_fields', 'Fillable fields')} {summary?.fieldCount ?? 0}
                </p>
              )}
            </div>
            <button type="button" className={`${parts.primary} ${styles.fixAll}`} onClick={u.handleFixAll} disabled={pending}>
              <UiIcon name="sparkles" size={16} />
              {pending && inFlightRowKey === null
                ? t('analysis.enrichment.fixing_all', 'Fixing…')
                : t('analysis.enrichment.fix_all', 'Fix All')}
            </button>
          </section>

          {isPhone ? (
            <ul className={parts.list}>
              {rows.map((row) => (
                <li key={row.rowKey} className={parts.item}>
                  <button type="button" className={parts.rowButton} onClick={() => u.setPreviewRow(row)}>
                    <span className={parts.rowTitle}>{row.displayName}</span>
                    <span className={parts.rowMeta}>
                      {row.targetSourceName}
                      <UiIcon name="back" size={14} />
                      {t('analysis.enrichment.col_donor', 'Donor source')} {row.donorSourceName}
                    </span>
                    {fields(row)}
                  </button>
                  {fixButton(row)}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('analysis.enrichment.col_node', 'Node')}</th>
                    <th>{t('analysis.enrichment.col_target', 'Target source')}</th>
                    <th>{t('analysis.enrichment.col_fields', 'Fillable fields')}</th>
                    <th>{t('analysis.enrichment.col_donor', 'Donor source')}</th>
                    <th>{t('analysis.enrichment.col_action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowKey} onClick={() => u.setPreviewRow(row)} title={t('analysis.enrichment.row_preview', 'Click to preview the copy')}>
                      <td>
                        <div className={styles.name}>{row.displayName}</div>
                        <div className={styles.meta}>{row.nodeId}</div>
                      </td>
                      <td>{row.targetSourceName}</td>
                      <td>{fields(row)}</td>
                      <td>{row.donorSourceName}</td>
                      <td>{fixButton(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isPhone && <p className={styles.hint}>{t('analysis.enrichment.row_preview', 'Click to preview the copy')}</p>}
        </>
      )}

      {u.previewRow && (
        <CopyNodeInfoSheet
          open
          sourceId={u.previewRow.targetSourceId}
          nodeNum={u.previewRow.nodeNum}
          initialDonorSourceId={u.previewRow.donorSourceId}
          preselectFields={u.previewRow.fillableFields}
          onCopied={u.refresh}
          onClose={() => u.setPreviewRow(null)}
        />
      )}
    </ReportFrame>
  );
}
