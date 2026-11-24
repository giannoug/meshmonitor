/**
 * Clean telemetry outliers (boards 17-07 / 17-14, Task 9.2): today's outlier
 * purge (TelemetryOutlierDialog's logic, `useTelemetryOutlierCleanup`, Rule X)
 * drawn as a Workspace sheet. Admins only, as today; the caller gates it.
 *
 * - Sweep (Settings › Data's danger zone): pick a source and a metric. Node
 *   (a telemetry chart's ⋯ "Clean outliers…"): one node and one metric, no
 *   Source picker.
 * - A dry run first (Preview, today's preview request: it deletes nothing),
 *   then today's plain confirm in a ConfirmSheet ("Permanently delete N
 *   readings? This cannot be undone.", no typed word), one sheet at a time
 *   (D9c). Cancel there goes back to the preview, as today.
 * - Delete is one request per press: a second press while it runs is ignored.
 *   It deletes rows in MeshMonitor's database and sends nothing on the mesh.
 *
 * Takes TelemetryOutlierDialog's props, so a host swaps one for the other.
 */
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { NumberInputScope } from '../../components/common/NumberInputScope';
import type { TelemetryOutlierDialogProps } from '../../components/TelemetryOutlierDialog/TelemetryOutlierDialog';
import { formatOutlierValue, useTelemetryOutlierCleanup } from '../../components/TelemetryOutlierDialog/useTelemetryOutlierCleanup';
import { OUTLIER_K_MAX, OUTLIER_K_MIN, OUTLIER_MIN_SAMPLES, type OutlierPreview } from '../../utils/telemetryOutliers';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './OutlierCleanupPage.module.css';

export default function OutlierCleanupPage({
  isOpen,
  onClose,
  sourceId: initialSourceId,
  telemetryType: fixedType,
  nodeId,
  nodeLabel,
  sources = [],
  getTypeLabel = (type: string) => type,
  onPurged,
}: TelemetryOutlierDialogProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const id = useId();
  const o = useTelemetryOutlierCleanup({ isOpen, sourceId: initialSourceId, telemetryType: fixedType, nodeId, getTypeLabel, onPurged });
  const deleting = useRef(false);
  const phone = isPhone || undefined;

  const purge = async () => {
    if (deleting.current) return;
    deleting.current = true;
    try {
      await o.runPurge();
    } finally {
      deleting.current = false;
    }
  };

  const title = (
    <span className={styles.title}>
      <UiIcon name="alert" size={20} />
      {o.title}
    </span>
  );
  const canDelete = o.step === 'preview' && !!o.preview && o.preview.affectedCount > 0;
  const sendsNothing = <SendsLine>{t('workspace.outliers.sends_nothing')}</SendsLine>;

  const footer =
    o.step === 'done' ? (
      <div className={styles.actions} data-phone={phone}>
        <button type="button" className={styles.button} onClick={onClose}>
          {t('telemetry_outliers.close')}
        </button>
      </div>
    ) : (
      <div className={styles.foot} data-phone={phone}>
        {canDelete && sendsNothing}
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>
            {t('telemetry_outliers.cancel')}
          </button>
          {canDelete && (
            <button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => o.setStep('confirm')}>
              {t('telemetry_outliers.delete_button', { count: o.preview!.affectedCount })}
            </button>
          )}
        </div>
      </div>
    );

  return (
    <>
      <Sheet open={isOpen && o.step !== 'confirm'} onClose={onClose} title={title} footer={footer}>
        <NumberInputScope scope={o.numberScope}>
          <div className={styles.body} data-phone={phone}>
            {o.step === 'done' ? (
              <p className={styles.success} role="status">
                {t('telemetry_outliers.done', { count: o.deletedCount })}
              </p>
            ) : (
              <>
                <p className={styles.help}>
                  {o.isNodeMode
                    ? t('telemetry_outliers.intro_node', { node: nodeLabel ?? nodeId, type: getTypeLabel(o.telemetryType) })
                    : t('telemetry_outliers.intro_sweep')}
                </p>

                {!o.isNodeMode && (
                  <div className={styles.pair}>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('telemetry_outliers.source_label')}</span>
                      <select className={styles.input} value={o.sourceId} onChange={(e) => o.edit(o.setSourceId)(e.target.value)}>
                        <option value="">{t('telemetry_outliers.select_source')}</option>
                        {sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>{t('telemetry_outliers.metric_label')}</span>
                      <select
                        className={styles.input}
                        value={o.telemetryType}
                        disabled={!o.sourceId || o.types === null || o.types.length === 0}
                        onChange={(e) => o.edit(o.setTelemetryType)(e.target.value)}
                      >
                        <option value="">
                          {o.sourceId && o.types === null
                            ? t('telemetry_outliers.metric_loading')
                            : o.types && o.types.length === 0
                              ? t('telemetry_outliers.metric_none')
                              : t('telemetry_outliers.metric_placeholder')}
                        </option>
                        {(o.types ?? []).map((type) => (
                          <option key={type} value={type}>
                            {getTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className={styles.autoRow}>
                  <label className={styles.check}>
                    <input type="checkbox" checked={o.auto} onChange={(e) => o.edit(o.setAuto)(e.target.checked)} />
                    {t('telemetry_outliers.auto_label')}
                  </label>
                  <span className={styles.kField}>
                    <label className={styles.label} htmlFor={`${id}-k`}>
                      {t('telemetry_outliers.k_label', { min: OUTLIER_K_MIN, max: OUTLIER_K_MAX })}
                    </label>
                    <NumberInput
                      id={`${id}-k`}
                      className={`${styles.input} ${styles.kInput}`}
                      allowEmpty
                      min={OUTLIER_K_MIN}
                      max={OUTLIER_K_MAX}
                      step={0.5}
                      value={o.k.trim() === '' ? null : Number(o.k)}
                      disabled={!o.auto}
                      showReason
                      onChange={(v) => o.edit(o.setK)(v === null ? '' : String(v))}
                    />
                  </span>
                </div>
                <p className={styles.hint}>{t('telemetry_outliers.auto_help', { min: OUTLIER_MIN_SAMPLES })}</p>

                <div className={styles.pair}>
                  <span className={styles.field}>
                    <label className={styles.label} htmlFor={`${id}-min`}>
                      {t('telemetry_outliers.min_label')}
                    </label>
                    <NumberInput
                      id={`${id}-min`}
                      className={styles.input}
                      allowEmpty
                      step="any"
                      placeholder={t('workspace.outliers.no_limit')}
                      value={o.min.trim() === '' ? null : Number(o.min)}
                      onChange={(v) => o.edit(o.setMin)(v === null ? '' : String(v))}
                    />
                  </span>
                  <span className={styles.field}>
                    <label className={styles.label} htmlFor={`${id}-max`}>
                      {t('telemetry_outliers.max_label')}
                    </label>
                    <NumberInput
                      id={`${id}-max`}
                      className={styles.input}
                      allowEmpty
                      step="any"
                      placeholder={t('workspace.outliers.no_limit')}
                      value={o.max.trim() === '' ? null : Number(o.max)}
                      onChange={(v) => o.edit(o.setMax)(v === null ? '' : String(v))}
                    />
                  </span>
                </div>
                <p className={styles.hint}>{t('telemetry_outliers.bounds_help')}</p>

                {o.validationMessage && <p className={styles.error}>{o.validationMessage}</p>}
                {o.error && (
                  <p className={styles.error} role="alert">
                    {o.error}
                  </p>
                )}

                <div className={styles.previewRow}>
                  <button type="button" className={styles.button} onClick={() => void o.runPreview()} disabled={!o.canPreview}>
                    <UiIcon name="visibility" size={16} />
                    {o.busy ? t('telemetry_outliers.previewing') : t('telemetry_outliers.preview_button')}
                  </button>
                </div>

                {o.preview && o.step !== 'configure' && (
                  <PreviewCard preview={o.preview} isNodeMode={o.isNodeMode} auto={o.auto} reasonLabel={o.reasonLabel} />
                )}
              </>
            )}
          </div>
        </NumberInputScope>
      </Sheet>

      <ConfirmSheet
        open={isOpen && o.step === 'confirm' && !!o.preview}
        title={title}
        body={
          o.preview && (
            <div className={styles.confirmBody}>
              <p className={styles.summary}>{summaryText(t, o.preview, o.isNodeMode)}</p>
              <p className={styles.confirmText}>{t('telemetry_outliers.confirm_text', { count: o.preview.affectedCount })}</p>
              {sendsNothing}
            </div>
          )
        }
        confirmLabel={o.busy ? t('telemetry_outliers.deleting') : t('telemetry_outliers.confirm_button')}
        cancelLabel={t('telemetry_outliers.cancel')}
        danger
        busy={o.busy}
        confirmDisabled={o.numberScope.invalid}
        submitOnEnter={false}
        onConfirm={purge}
        onCancel={() => o.setStep('preview')}
      />
    </>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

/** Today's summary; the counts carry the viewer's digit grouping ("4,812"). */
function summaryText(t: T, preview: OutlierPreview, isNodeMode: boolean): string {
  const n = (v: number) => v.toLocaleString();
  return isNodeMode
    ? t('telemetry_outliers.summary_node', { count: n(preview.affectedCount), total: n(preview.rowsScanned) })
    : t('telemetry_outliers.summary_sweep', {
        count: n(preview.affectedCount),
        total: n(preview.rowsScanned),
        nodes: n(preview.nodesAffected),
        scanned: n(preview.nodesScanned),
      });
}

/** Today's preview: the summary, the removed range, the skipped notes and the first flagged points. */
function PreviewCard({
  preview,
  isNodeMode,
  auto,
  reasonLabel,
}: {
  preview: OutlierPreview;
  isNodeMode: boolean;
  auto: boolean;
  reasonLabel(reason: string): string;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.preview} aria-live="polite" data-testid="outlier-preview">
      <p className={styles.summary}>{summaryText(t, preview, isNodeMode)}</p>
      {preview.affectedCount > 0 && (
        <p className={styles.hint}>
          {t('telemetry_outliers.removed_range', {
            min: formatOutlierValue(preview.removedMin),
            max: formatOutlierValue(preview.removedMax),
          })}
        </p>
      )}
      {isNodeMode && preview.median !== null && (
        <p className={styles.hint}>{t('telemetry_outliers.median', { value: formatOutlierValue(preview.median) })}</p>
      )}
      {isNodeMode && preview.scaleKind === 'too_few' && (
        <p className={styles.warn}>{t('telemetry_outliers.skipped_too_few', { min: OUTLIER_MIN_SAMPLES })}</p>
      )}
      {isNodeMode && preview.scaleKind === 'flat' && <p className={styles.warn}>{t('telemetry_outliers.skipped_flat')}</p>}
      {!isNodeMode && auto && (preview.nodesTooFew > 0 || preview.nodesFlat > 0) && (
        <p className={styles.warn}>
          {t('telemetry_outliers.sweep_skipped', { tooFew: preview.nodesTooFew, flat: preview.nodesFlat })}
        </p>
      )}
      {preview.affectedCount === 0 ? (
        <p className={styles.hint}>{t('telemetry_outliers.none_found')}</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('telemetry_outliers.col_time')}</th>
                {!isNodeMode && <th>{t('telemetry_outliers.col_node')}</th>}
                <th>{t('telemetry_outliers.col_value')}</th>
                <th>{t('telemetry_outliers.col_reason')}</th>
              </tr>
            </thead>
            <tbody>
              {preview.points.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.timestamp).toLocaleString()}</td>
                  {!isNodeMode && <td>{p.nodeId}</td>}
                  <td className={styles.value}>{formatOutlierValue(p.value)}</td>
                  <td>{reasonLabel(p.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.pointsTruncated && (
            <p className={styles.hint}>
              {t('telemetry_outliers.truncated', { shown: preview.points.length, count: preview.affectedCount })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
