import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import { formatFieldValue, formatTimestamp, useCopyNodeInfo } from '../../hooks/useCopyNodeInfo';
import './CopyNodeInfoModal.css';

interface CopyNodeInfoModalProps {
  isOpen: boolean;
  nodeNum: number | null;
  /**
   * The target's current NodeInfo values. Optional — when omitted the modal
   * falls back to the `target` snapshot returned by the copy-candidates
   * endpoint (used by callers that don't hold the target row, e.g. the
   * cross-source enrichment report).
   */
  currentNode?: {
    longName?: string | null;
    shortName?: string | null;
    hwModel?: number | null;
    role?: number | null;
    macaddr?: string | null;
    publicKey?: string | null;
    hasPKC?: boolean | null;
    firmwareVersion?: string | null;
  } | null;
  /** Copy-destination source. Defaults to the active SourceContext source. */
  targetSourceId?: string | null;
  /** Donor to preselect in the source dropdown when present in the candidates. */
  initialDonorSourceId?: string | null;
  /**
   * Restrict the *default* field selection to these keys (still only rows that
   * would change something). The user can adjust afterwards. Used by the
   * enrichment report to preview exactly its fill-blanks field set.
   */
  preselectFields?: string[] | null;
  onClose: () => void;
  onCopied: () => void;
}

export const CopyNodeInfoModal: React.FC<CopyNodeInfoModalProps> = ({
  isOpen,
  nodeNum,
  currentNode,
  targetSourceId,
  initialDonorSourceId,
  preselectFields,
  onClose,
  onCopied,
}) => {
  const { t } = useTranslation();
  const {
    candidates, selectedSourceId, setSelectedSourceId, pushToNodeDb, setPushToNodeDb, loading, saving, error,
    successMessage, diffRows, selectableKeys, selectedFields, toggleField, allSelected, toggleAll, hasChanges, handleConfirm,
  } = useCopyNodeInfo({ isOpen, nodeNum, currentNode, targetSourceId, initialDonorSourceId, preselectFields, onCopied });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('nodes.copy_nodeinfo_title')}
      className="copy-nodeinfo-modal"
      maxWidth="600px"
    >
      {loading ? (
        <div className="copy-nodeinfo-loading">{t('common.loading')}...</div>
      ) : successMessage ? (
        <div className="copy-nodeinfo-success">
          <p>{successMessage}</p>
          <div className="copy-nodeinfo-actions">
            <button className="copy-nodeinfo-btn primary" onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="copy-nodeinfo-empty">
          <p>{t('nodes.copy_nodeinfo_no_candidates')}</p>
          <div className="copy-nodeinfo-actions">
            <button className="copy-nodeinfo-btn" onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="copy-nodeinfo-description">
            {t('nodes.copy_nodeinfo_description')}
          </p>

          <div className="copy-nodeinfo-source-select">
            <label>{t('nodes.copy_nodeinfo_source')}:</label>
            <select
              value={selectedSourceId ?? ''}
              onChange={e => setSelectedSourceId(e.target.value)}
              disabled={saving}
            >
              {candidates.map(c => (
                <option key={c.sourceId} value={c.sourceId}>
                  {c.sourceName} ({c.fieldsFilled}/{c.totalFields} fields) —{' '}
                  {formatTimestamp(c.node.updatedAt)}
                </option>
              ))}
            </select>
          </div>

          <div className="copy-nodeinfo-diff">
            <table>
              <thead>
                <tr>
                  <th className="field-select">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={selectableKeys.length === 0}
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
                {diffRows.map(row => {
                  const checked = selectedFields.has(row.key as string);
                  return (
                    <tr
                      key={row.key}
                      className={[
                        row.isNew ? 'diff-new' : '',
                        // A row that overwrites existing data is visually
                        // distinct from one that merely fills a blank (#4244).
                        row.differs && !row.isNew ? 'diff-overwrite' : '',
                        checked ? 'is-selected' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className="field-select">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!row.hasIncoming}
                          onChange={() => toggleField(row.key as string)}
                          aria-label={row.label}
                        />
                      </td>
                      <td className="field-name">{row.label}</td>
                      <td className="field-current">
                        {formatFieldValue(row.key, row.currentVal)}
                      </td>
                      <td className={`field-incoming${row.isNew ? ' new-value' : ''}`}>
                        {formatFieldValue(row.key, row.incomingVal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!hasChanges && (
            <p className="copy-nodeinfo-no-changes">
              {t('nodes.copy_nodeinfo_no_changes')}
            </p>
          )}

          <div className="copy-nodeinfo-push-option">
            <label>
              <input
                type="checkbox"
                checked={pushToNodeDb}
                onChange={e => setPushToNodeDb(e.target.checked)}
                disabled={saving}
              />
              {t('nodes.copy_nodeinfo_push_to_device')}
            </label>
            <span className="push-help">{t('nodes.copy_nodeinfo_push_to_device_help')}</span>
          </div>

          {error && <div className="copy-nodeinfo-error">{error}</div>}

          <div className="copy-nodeinfo-actions">
            <button
              className="copy-nodeinfo-btn"
              onClick={onClose}
              disabled={saving}
            >
              {t('common.cancel')}
            </button>
            <button
              className="copy-nodeinfo-btn primary"
              onClick={handleConfirm}
              disabled={saving || !hasChanges}
            >
              {saving ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CopyNodeInfoModal;
