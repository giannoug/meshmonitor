/**
 * Copy NodeInfo (board 15-05; s15n5 "a bottom sheet with the desktop fields"
 * on phone): CopyNodeInfoModal's logic (useCopyNodeInfo) in a sheet: the
 * donor source, each field's current and incoming value with today's default
 * ticks, and Push to NodeDB. A copy writes MeshMonitor's row only; Push to
 * NodeDB adds today's one NodeInfo request on the node's channel, and its
 * Sends line says so, so Enter does not confirm (Ruling BH). Closes on
 * success, as today's callers do. NodeInfo Enrichment's copy preview (6-07)
 * opens it by node number with the row's donor and fields preselected.
 */
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatFieldValue, formatTimestamp, useCopyNodeInfo } from '../../../hooks/useCopyNodeInfo';
import type { DeviceInfo } from '../../../types/device';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import styles from './CopyNodeInfoSheet.module.css';

export interface CopyNodeInfoSheetProps {
  open: boolean;
  /** The copy's target source. */
  sourceId: string;
  /** The target node with its current values; or `nodeNum` alone, and the values come from the copy-candidates reply. */
  node?: DeviceInfo;
  nodeNum?: number;
  initialDonorSourceId?: string | null;
  preselectFields?: string[] | null;
  /** After a copy, before the sheet closes. */
  onCopied?(): void;
  onClose(): void;
}

export default function CopyNodeInfoSheet({ open, sourceId, node, nodeNum, initialDonorSourceId, preselectFields, onCopied, onClose }: CopyNodeInfoSheetProps) {
  const { t } = useTranslation();
  const selectId = useId();
  // NodeActionMenus' (and MessagesTab's) current values. Memoised: the hook re-seeds its ticks when this object changes.
  const user = node?.user;
  const hasNode = node !== undefined;
  const currentNode = useMemo(() => hasNode ? ({
    longName: user?.longName,
    shortName: user?.shortName,
    hwModel: user?.hwModel,
    role: user?.role != null ? Number(user.role) : null,
    publicKey: user?.publicKey,
    macaddr: user?.macaddr,
    hasPKC: user?.hasPKC,
    firmwareVersion: user?.firmwareVersion,
  }) : undefined, [hasNode, user]);
  const copy = useCopyNodeInfo({
    isOpen: open,
    nodeNum: node?.nodeNum ?? nodeNum ?? null,
    targetSourceId: sourceId,
    currentNode,
    initialDonorSourceId,
    preselectFields,
    onCopied: () => {
      onCopied?.();
      onClose();
    },
  });
  const ready = !copy.loading && copy.candidates.length > 0;

  return (
    <ConfirmSheet
      open={open}
      title={t('nodes.copy_nodeinfo_title')}
      confirmLabel={copy.saving ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm')}
      busy={copy.saving}
      confirmDisabled={!ready || !copy.hasChanges}
      onCancel={onClose}
      onConfirm={copy.handleConfirm}
      submitOnEnter={false}
      body={
        <div className={styles.copy}>
          {copy.loading ? (
            <p className={styles.muted}>{t('common.loading')}...</p>
          ) : copy.candidates.length === 0 ? (
            <p className={styles.muted}>{copy.error ?? t('nodes.copy_nodeinfo_no_candidates')}</p>
          ) : (
            <>
              <p className={styles.muted}>{t('nodes.copy_nodeinfo_description')}</p>
              <div className={styles.field}>
                <label htmlFor={selectId} className={styles.label}>{t('nodes.copy_nodeinfo_source')}</label>
                <select
                  id={selectId}
                  className={styles.select}
                  value={copy.selectedSourceId ?? ''}
                  onChange={(e) => copy.setSelectedSourceId(e.target.value)}
                  disabled={copy.saving}
                >
                  {copy.candidates.map((c) => (
                    <option key={c.sourceId} value={c.sourceId}>
                      {c.sourceName} ({c.fieldsFilled}/{c.totalFields} fields) — {formatTimestamp(c.node.updatedAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.tick}>
                        <input
                          type="checkbox"
                          checked={copy.allSelected}
                          onChange={copy.toggleAll}
                          disabled={copy.selectableKeys.length === 0}
                          aria-label={t('nodes.copy_nodeinfo_select_all', 'Select all fields')}
                          title={t('nodes.copy_nodeinfo_select_all', 'Select all fields')}
                        />
                      </th>
                      <th>{t('nodes.copy_nodeinfo_field')}</th>
                      <th>{t('nodes.copy_nodeinfo_current')}</th>
                      <th>{t('nodes.copy_nodeinfo_incoming')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copy.diffRows.map((row) => (
                      <tr key={row.key} data-change={row.isNew ? 'new' : row.differs ? 'overwrite' : undefined}>
                        <td className={styles.tick}>
                          <input
                            type="checkbox"
                            checked={copy.selectedFields.has(row.key)}
                            disabled={!row.hasIncoming}
                            onChange={() => copy.toggleField(row.key)}
                            aria-label={row.label}
                          />
                        </td>
                        <td>{row.label}</td>
                        <td className={styles.value}>{formatFieldValue(row.key, row.currentVal)}</td>
                        <td className={styles.value}>{formatFieldValue(row.key, row.incomingVal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!copy.hasChanges && <p className={styles.muted}>{t('nodes.copy_nodeinfo_no_changes')}</p>}
              <div className={styles.push}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={copy.pushToNodeDb}
                    onChange={(e) => copy.setPushToNodeDb(e.target.checked)}
                    disabled={copy.saving}
                  />
                  {t('nodes.copy_nodeinfo_push_to_device')}
                </label>
                <p className={styles.muted}>{t('nodes.copy_nodeinfo_push_to_device_help')}</p>
                <SendsLine>{t('workspace.node_dialogs.push_sends')}</SendsLine>
              </div>
              {copy.error && <p className={styles.error} role="alert">{copy.error}</p>}
            </>
          )}
        </div>
      }
    />
  );
}
