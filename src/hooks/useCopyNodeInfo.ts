/**
 * Copy NodeInfo from another source (CopyNodeInfoModal's logic, shared with
 * the Workspace's CopyNodeInfoSheet): the donor candidates, the per-field diff
 * and selection, Push to NodeDB, and today's copy request.
 *
 * Push to NodeDB is the only part that transmits: the server sends 1 NodeInfo
 * request on the node's channel (nodeInfoCopyService.pushNodeInfoToDevice).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSource } from '../contexts/SourceContext';
import api from '../services/api';
import { NODE_INFO_DISPLAY_FIELDS as DISPLAY_FIELDS } from '../utils/nodeInfoFields';
import { useCsrfFetch } from './useCsrfFetch';

export interface CopyCandidate {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  node: {
    nodeNum: number;
    nodeId: string;
    longName: string | null;
    shortName: string | null;
    hwModel: number | null;
    role: number | null;
    macaddr: string | null;
    publicKey: string | null;
    hasPKC: boolean | null;
    firmwareVersion: string | null;
    updatedAt: number;
    lastHeard: number | null;
  };
  fieldsFilled: number;
  totalFields: number;
}

/** The target's current NodeInfo values. */
export interface CopyNodeInfoCurrent {
  longName?: string | null;
  shortName?: string | null;
  hwModel?: number | null;
  role?: number | null;
  macaddr?: string | null;
  publicKey?: string | null;
  hasPKC?: boolean | null;
  firmwareVersion?: string | null;
}

export interface UseCopyNodeInfoOptions {
  isOpen: boolean;
  nodeNum: number | null;
  /** Omitted: the `target` snapshot the copy-candidates endpoint returns. */
  currentNode?: CopyNodeInfoCurrent | null;
  /** Copy-destination source. Defaults to the active SourceContext source. */
  targetSourceId?: string | null;
  /** Donor to preselect when present in the candidates. */
  initialDonorSourceId?: string | null;
  /** Restrict the *default* field selection to these keys. */
  preselectFields?: string[] | null;
  onCopied: () => void;
}

export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'publicKey' && typeof value === 'string') {
    return value.length > 16 ? `${value.substring(0, 16)}...` : value;
  }
  if (key === 'hasPKC') return value ? 'Yes' : 'No';
  return String(value);
}

export function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts < 1e12 ? ts * 1000 : ts);
  return d.toLocaleString();
}

const field = (o: object | null | undefined, key: string): unknown => (o ? (o as Record<string, unknown>)[key] : null);

export function useCopyNodeInfo({
  isOpen,
  nodeNum,
  currentNode,
  targetSourceId,
  initialDonorSourceId,
  preselectFields,
  onCopied,
}: UseCopyNodeInfoOptions) {
  const { t } = useTranslation();
  const { sourceId: contextSourceId } = useSource();
  const csrfFetch = useCsrfFetch();
  const sourceId = targetSourceId ?? contextSourceId;

  const [candidates, setCandidates] = useState<CopyCandidate[]>([]);
  const [fetchedTarget, setFetchedTarget] = useState<CopyCandidate['node'] | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [pushToNodeDb, setPushToNodeDb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || nodeNum === null || !sourceId) {
      setCandidates([]);
      setFetchedTarget(null);
      setSelectedSourceId(null);
      setPushToNodeDb(false);
      setError(null);
      setSuccessMessage(null);
      return;
    }

    setLoading(true);
    setError(null);

    api.get<{ data?: { candidates?: CopyCandidate[]; target?: CopyCandidate['node'] | null } }>(
      `/api/nodes/${nodeNum}/copy-candidates?sourceId=${encodeURIComponent(sourceId)}`,
    )
      .then(data => {
        const list: CopyCandidate[] = data.data?.candidates ?? [];
        setCandidates(list);
        setFetchedTarget(data.data?.target ?? null);
        if (list.length > 0) {
          const preferred = initialDonorSourceId
            && list.some(c => c.sourceId === initialDonorSourceId)
            ? initialDonorSourceId
            : list[0].sourceId;
          setSelectedSourceId(preferred);
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [isOpen, nodeNum, sourceId, initialDonorSourceId]);

  const selectedCandidate = candidates.find(c => c.sourceId === selectedSourceId) ?? null;
  const effectiveCurrentNode = currentNode ?? fetchedTarget;

  const diffRows = DISPLAY_FIELDS.map(({ key, label }) => {
    const currentVal = field(effectiveCurrentNode, key);
    const incomingVal = selectedCandidate ? field(selectedCandidate.node, key) : null;
    const isNew = (currentVal == null || currentVal === '') &&
                  incomingVal != null && incomingVal !== '';
    // #4244: a field can now be copied even when the target already holds a
    // value, so "would this change anything?" is the real gate, not "is the
    // target empty?".
    const hasIncoming = incomingVal != null && incomingVal !== '';
    const differs = hasIncoming && String(currentVal ?? '') !== String(incomingVal);
    return { key, label, currentVal, incomingVal, isNew, hasIncoming, differs };
  });

  // Only rows with an incoming value are selectable — there is nothing to copy
  // from an empty donor field.
  const selectableKeys = useMemo(
    () => diffRows.filter(r => r.hasIncoming).map(r => r.key as string),
    [diffRows],
  );

  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Default the selection to every row that would actually change something,
  // which reproduces the old fill-empty behavior plus the stale-value refreshes
  // the old code silently refused to do. Re-runs when the donor changes.
  //
  // Deliberately keyed on the donor rather than on diffRows: diffRows is a new
  // array every render, so depending on it would re-run this effect forever and
  // stomp the user's checkbox edits on each pass.
  useEffect(() => {
    const changed = diffRows.filter(r => r.differs).map(r => r.key as string);
    setSelectedFields(new Set(
      preselectFields ? changed.filter(k => preselectFields.includes(k)) : changed,
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- #4244 see comment above
  }, [selectedSourceId, currentNode, fetchedTarget, preselectFields]);

  const toggleField = useCallback((key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allSelected = selectableKeys.length > 0 &&
    selectableKeys.every(k => selectedFields.has(k));

  const toggleAll = useCallback(() => {
    setSelectedFields(prev => {
      const everySelected = selectableKeys.length > 0 &&
        selectableKeys.every(k => prev.has(k));
      return everySelected ? new Set<string>() : new Set(selectableKeys);
    });
  }, [selectableKeys]);

  const hasChanges = selectedFields.size > 0;

  const handleConfirm = useCallback(async () => {
    if (!nodeNum || !selectedSourceId || !sourceId) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const baseUrl = await api.getBaseUrl();
      const res = await csrfFetch(
        `${baseUrl}/api/nodes/${nodeNum}/copy-nodeinfo`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromSourceId: selectedSourceId,
            toSourceId: sourceId,
            pushToNodeDb,
            // #4244: explicit selection — these overwrite the target even when
            // it already holds a (possibly derived/stale) value.
            fields: Array.from(selectedFields),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Copy failed');
      }

      const result = await res.json();
      const count = result.data?.copiedFields?.length ?? 0;
      let msg = t('nodes.copy_nodeinfo_success', { count });
      if (result.data?.pushedToDevice) {
        msg += ' ' + t('nodes.copy_nodeinfo_pushed');
      }
      setSuccessMessage(msg);
      onCopied();
    } catch (err) {
      setError((err instanceof Error && err.message) || t('nodes.copy_nodeinfo_error'));
    } finally {
      setSaving(false);
    }
  }, [nodeNum, selectedSourceId, sourceId, pushToNodeDb, selectedFields, csrfFetch, t, onCopied]);

  return {
    candidates,
    selectedSourceId,
    setSelectedSourceId,
    pushToNodeDb,
    setPushToNodeDb,
    loading,
    saving,
    error,
    successMessage,
    diffRows,
    selectableKeys,
    selectedFields,
    toggleField,
    allSelected,
    toggleAll,
    hasChanges,
    handleConfirm,
  };
}
