/**
 * The outlier purge flow's state and calls (#5333), moved out of
 * TelemetryOutlierDialog unchanged (Rule X) so the Workspace's outlier sheet
 * (#6365) runs the same logic: configure → preview (dry run) → confirm →
 * delete, with the preview's cutoffId + fingerprint sent back.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import apiService, { ApiError, type TelemetryOutlierRequest } from '../../services/api';
import {
  OUTLIER_K_DEFAULT,
  OUTLIER_K_MAX,
  OUTLIER_K_MIN,
  validateOutlierCriteria,
  type OutlierPreview,
} from '../../utils/telemetryOutliers';

export interface TelemetryOutlierCleanupOptions {
  isOpen: boolean;
  /** Fixed source (node mode) or the initial selection (sweep mode). */
  sourceId?: string | null;
  /** Fixed metric (node mode). */
  telemetryType?: string;
  /** Present ⇒ node mode: only this node's series is analysed. */
  nodeId?: string;
  /** Human label for a telemetry type. */
  getTypeLabel?: (type: string) => string;
  /** Called after a successful delete with the number of rows removed. */
  onPurged?: (deletedCount: number) => void;
}

export type OutlierStep = 'configure' | 'preview' | 'confirm' | 'done';

export function formatOutlierValue(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '–';
  return String(Number(v.toPrecision(6)));
}

export function useTelemetryOutlierCleanup({
  isOpen,
  sourceId: initialSourceId,
  telemetryType: fixedType,
  nodeId,
  getTypeLabel = (type: string) => type,
  onPurged,
}: TelemetryOutlierCleanupOptions) {
  const { t } = useTranslation();
  const isNodeMode = Boolean(nodeId);

  const [sourceId, setSourceId] = useState<string>(initialSourceId ?? '');
  const [telemetryType, setTelemetryType] = useState<string>(fixedType ?? '');
  const [types, setTypes] = useState<string[] | null>(null);
  const [auto, setAuto] = useState(true);
  const [k, setK] = useState(String(OUTLIER_K_DEFAULT));
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const numberScope = useNumberInputScope();
  const [step, setStep] = useState<OutlierStep>('configure');
  const [preview, setPreview] = useState<OutlierPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setSourceId(initialSourceId ?? '');
    setTelemetryType(fixedType ?? '');
    setAuto(true);
    setK(String(OUTLIER_K_DEFAULT));
    setMin('');
    setMax('');
    setStep('configure');
    setPreview(null);
    setError(null);
    setBusy(false);
  }, [isOpen, initialSourceId, fixedType]);

  // Sweep mode: load the chosen source's metrics.
  useEffect(() => {
    if (!isOpen || isNodeMode || !sourceId) {
      setTypes(null);
      return;
    }
    let cancelled = false;
    setTypes(null);
    apiService
      .getTelemetryOutlierTypes(sourceId)
      .then(list => {
        if (cancelled) return;
        setTypes(list);
        setTelemetryType(prev => (list.includes(prev) ? prev : ''));
      })
      .catch(err => {
        if (!cancelled) {
          setTypes([]);
          setError(t('telemetry_outliers.error', { message: err instanceof Error ? err.message : String(err) }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isNodeMode, sourceId, t]);

  const validation = useMemo(
    () => validateOutlierCriteria({ auto, k: k.trim() === '' ? undefined : Number(k), min, max }),
    [auto, k, min, max],
  );

  const validationMessage = validation.ok
    ? null
    : validation.code === 'INVALID_K'
      ? t('telemetry_outliers.invalid_k', { min: OUTLIER_K_MIN, max: OUTLIER_K_MAX })
      : validation.code === 'NO_CRITERIA'
        ? t('telemetry_outliers.no_criteria')
        : t('telemetry_outliers.invalid_bounds');

  const canPreview =
    validation.ok && !numberScope.invalid && Boolean(sourceId) && Boolean(telemetryType) && !busy;

  const buildRequest = (): TelemetryOutlierRequest | null => {
    // #5649: a field holding invalid text was never applied to the criteria, so
    // neither preview nor purge may run on what the form still remembers.
    if (!validation.ok || numberScope.invalid) return null;
    return {
      sourceId,
      telemetryType,
      ...(nodeId ? { nodeId } : {}),
      ...validation.criteria,
    };
  };

  /** Any edit after a preview invalidates it. */
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    if (step !== 'configure') {
      setStep('configure');
      setPreview(null);
    }
    setError(null);
  };

  const runPreview = async () => {
    const req = buildRequest();
    if (!req) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiService.previewTelemetryOutliers(req);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(t('telemetry_outliers.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const runPurge = async () => {
    const req = buildRequest();
    if (!req || !preview || preview.cutoffId === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiService.purgeTelemetryOutliers({
        ...req,
        cutoffId: preview.cutoffId,
        fingerprint: preview.fingerprint,
      });
      setDeletedCount(result.deletedCount);
      setStep('done');
      onPurged?.(result.deletedCount);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t('telemetry_outliers.stale'));
        setStep('configure');
        setPreview(null);
      } else {
        setError(t('telemetry_outliers.error', { message: err instanceof Error ? err.message : String(err) }));
        setStep('preview');
      }
    } finally {
      setBusy(false);
    }
  };

  const title = isNodeMode
    ? t('telemetry_outliers.title_node', { type: getTypeLabel(telemetryType) })
    : t('telemetry_outliers.title_sweep');

  const reasonLabel = (reason: string) => t(`telemetry_outliers.reason_${reason}`);


  return {
    isNodeMode,
    sourceId,
    setSourceId,
    telemetryType,
    setTelemetryType,
    types,
    auto,
    setAuto,
    k,
    setK,
    min,
    setMin,
    max,
    setMax,
    numberScope,
    step,
    setStep,
    preview,
    busy,
    error,
    deletedCount,
    validationMessage,
    canPreview,
    edit,
    runPreview,
    runPurge,
    title,
    reasonLabel,
  };
}
