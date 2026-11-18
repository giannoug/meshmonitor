/**
 * MeshCoreContactSyncSection (#5502).
 *
 * A MeshCore companion keeps its OWN contact list, separate from the nodes
 * MeshMonitor tracks. The radio can only log in to, poll, or message nodes in
 * that list. Two things put them out of step: auto-add turned off on the radio
 * (it then stores no node it hears), and eviction when the list fills up.
 *
 * This section shows the radio's auto-add state with a toggle, warns when
 * MeshMonitor favourites are missing from the radio, and offers "Push to
 * radio": fill the radio's free slots with MeshMonitor's nodes, favourites
 * first. Both are local writes over the serial/TCP link; nothing is sent over
 * the air. The push never replaces a contact already on the radio.
 *
 * Lives in MeshCore Settings, next to the other device settings. The per-node
 * "Not in the radio's contact list" notice points here.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import Modal from '../common/Modal';
import styles from './MeshCoreContactSyncSection.module.css';
import { ConfigSection } from '../shared/config/ConfigSection';
import { MESHCORE_DOCS } from './meshcoreDocs';
import { TYPE_ORDER, useMeshCoreContactSync, type AddMode } from './hooks/useMeshCoreContactSync';

interface MeshCoreContactSyncSectionProps {
  baseUrl: string;
  sourceId: string;
  connected: boolean;
  /** configuration:write — may change the auto-add device setting. */
  canEditConfig: boolean;
  /** nodes:write — may push contacts to the radio. */
  canEditNodes: boolean;
}

export const MeshCoreContactSyncSection: React.FC<MeshCoreContactSyncSectionProps> = ({
  baseUrl,
  sourceId,
  connected,
  canEditConfig,
  canEditNodes,
}) => {
  const { t } = useTranslation();
  const {
    status,
    savingAutoAdd,
    pushing,
    pushResult,
    error,
    config,
    confirmRemove,
    setConfirmRemove,
    removing,
    removeResult,
    handleMode,
    handleType,
    handleOverwrite,
    handleMaxHops,
    handleRemove,
    handleToggleAutoAdd,
    handlePush,
    autoAdd,
    mode,
    configLocked,
    hopChoices,
    hopLabel,
    removable,
    kept,
    typeLabels,
    missing,
    skippedBy,
  } = useMeshCoreContactSync({ baseUrl, sourceId, connected, canEditConfig });

  return (
    <div id="meshcore-contact-sync" data-testid="meshcore-contact-sync">
      <ConfigSection
        title={t('meshcore.contact_sync.title', 'Radio contact list')}
        docsUrl={`${MESHCORE_DOCS}#radio-contact-table-vs-meshmonitor`}
        bodyClassName={styles.section}
        description={t(
          'meshcore.contact_sync.hint',
          'The radio keeps its own contact list, separate from the nodes MeshMonitor tracks. It can only log in to, poll, or message nodes in that list.',
        )}
      >

        {mode === null ? (
          <>
          <div className={styles.row}>
            <span className={styles.label}>{t('meshcore.contact_sync.auto_add_label', 'Auto-add contacts')}:</span>
            <span className={styles.value} data-testid="meshcore-auto-add-state">
              {autoAdd === null
                ? t('meshcore.contact_sync.unknown', 'Unknown')
                : autoAdd
                  ? t('meshcore.contact_sync.on', 'On')
                  : t('meshcore.contact_sync.off', 'Off')}
            </span>
            {canEditConfig && autoAdd !== null && (
              <button
                type="button"
                onClick={() => void handleToggleAutoAdd(!autoAdd)}
                disabled={!connected || savingAutoAdd}
              >
                {savingAutoAdd
                  ? t('common.saving', 'Saving…')
                  : autoAdd
                    ? t('meshcore.contact_sync.turn_off', 'Turn off')
                    : t('meshcore.contact_sync.turn_on', 'Turn on')}
              </button>
            )}
          </div>
          <p className="hint">
            {t(
              'meshcore.contact_sync.auto_add_hint',
              'On: the radio saves every node it hears advertising. Off: it keeps only contacts added by hand, and MeshMonitor cannot log in to or poll nodes missing from the radio. Changing this writes a setting to the radio; nothing is transmitted.',
            )}
          </p>
          </>
        ) : (
          <fieldset className={styles.modes} disabled={configLocked} data-testid="meshcore-auto-add-modes">
            <legend className={styles.label}>{t('meshcore.contact_sync.auto_add_label', 'Auto-add contacts')}</legend>
            <span className="sr-only" hidden data-testid="meshcore-auto-add-state">{mode}</span>
            {(['all', 'types', 'none'] as AddMode[]).map((m) => (
              <label key={m} className={styles.choice}>
                <input
                  type="radio"
                  name="meshcore-auto-add-mode"
                  checked={mode === m}
                  onChange={() => void handleMode(m)}
                />
                <span>
                  {m === 'all'
                    ? t('meshcore.contact_sync.mode_all', 'Add every node it hears')
                    : m === 'types'
                      ? t('meshcore.contact_sync.mode_types', 'Add only these types')
                      : t('meshcore.contact_sync.mode_none', 'Add none (manual)')}
                </span>
              </label>
            ))}
            <div className={styles.types}>
              {TYPE_ORDER.map((k) => (
                <label key={k} className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={config!.types[k]}
                    disabled={mode !== 'types'}
                    onChange={(e) => void handleType(k, e.target.checked)}
                  />
                  <span>{typeLabels[k]}</span>
                </label>
              ))}
            </div>
            <p className="hint">
              {t(
                'meshcore.contact_sync.types_hint',
                'The type boxes do nothing while "Add every node it hears" is on. With "Add none", the radio saves only contacts added by hand. Changing these writes a setting to the radio; nothing is transmitted.',
              )}
            </p>
            {mode !== 'none' && (
              <div className={styles.row}>
                <label htmlFor="meshcore-auto-add-hops" className={styles.label}>
                  {t('meshcore.contact_sync.max_hops_label', 'Max hops')}
                </label>
                <select
                  id="meshcore-auto-add-hops"
                  className={styles.select}
                  value={config!.maxHops}
                  onChange={(e) => void handleMaxHops(Number(e.target.value))}
                >
                  {hopChoices.map((v) => (
                    <option key={v} value={v}>{hopLabel(v)}</option>
                  ))}
                </select>
              </div>
            )}
            {mode !== 'none' && (
              <p className="hint">
                {t('meshcore.contact_sync.max_hops_hint', 'The radio saves a node only if its advert came in over this many hops or fewer.')}
              </p>
            )}
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={config!.overwriteOldest}
                onChange={(e) => void handleOverwrite(e.target.checked)}
              />
              <span>{t('meshcore.contact_sync.overwrite_label', 'Replace the oldest non-favourite contact when the list is full')}</span>
            </label>
            <p className="hint">
              {t(
                'meshcore.contact_sync.overwrite_hint',
                'Off: when the list is full, the radio stops saving new nodes. Favourites are never replaced.',
              )}
            </p>
          </fieldset>
        )}
        {config && !config.supported && (
          <p className="hint" data-testid="meshcore-autoadd-unsupported">
            {t('meshcore.contact_sync.unsupported', 'This firmware does not support auto-add options.')}
          </p>
        )}

        {status && status.deviceContactsKnown === false && (
          <p className="hint" data-testid="meshcore-device-contacts-unknown">
            {t(
              'meshcore.contact_sync.device_list_unknown',
              "The radio's contact list hasn't been read since it connected, so MeshMonitor can't tell yet which nodes it holds. Push to radio still checks the radio first.",
            )}
          </p>
        )}

        {missing > 0 && (
          <div className={styles.banner} role="status" data-testid="meshcore-missing-favorites">
            <div className={styles.bannerHeading}>
              <UiIcon name="alert" size={16} />
              {t('meshcore.contact_sync.missing_favorites', {
                count: missing,
                defaultValue: "{{count}} favourite(s) are not in the radio's contact list",
              })}
            </div>
            {autoAdd === false && (
              <p className={styles.bannerBody}>
                {t(
                  'meshcore.contact_sync.auto_add_off_explain',
                  'Auto-add contacts is off on this radio, so nodes heard via advert are not saved to it. MeshMonitor cannot log in to or poll contacts the radio does not hold. Turn auto-add on, or push MeshMonitor contacts to the radio.',
                )}
              </p>
            )}
          </div>
        )}

        {canEditNodes && (
          <div className={styles.actions}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handlePush()}
              disabled={!connected || pushing}
              title={t('meshcore.contact_sync.push_tooltip', 'Store MeshMonitor nodes in the radio (no radio transmission)')}
            >
              <UiIcon name="uploadData" size={14} />{' '}
              {pushing
                ? t('meshcore.contact_sync.pushing', 'Pushing…')
                : t('meshcore.contact_sync.push_button', 'Push to radio')}
            </button>
            <span className={styles.subtle}>
              {t(
                'meshcore.contact_sync.push_hint',
                'Adds favourites first, then the most recently heard nodes, into free slots only. Nothing on the radio is replaced.',
              )}
            </span>
          </div>
        )}

        {canEditNodes && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => setConfirmRemove(true)}
              disabled={!connected || removing || removable === 0}
            >
              <UiIcon name="delete" size={14} />{' '}
              {t('meshcore.contact_sync.remove_button', 'Remove non-favourite contacts from the radio')}
            </button>
            <span className={styles.subtle}>
              {t(
                'meshcore.contact_sync.remove_hint',
                'Frees room on the radio. Favourites stay. MeshMonitor keeps its own node list.',
              )}
            </span>
          </div>
        )}

        <Modal
          isOpen={confirmRemove}
          onClose={() => { if (!removing) setConfirmRemove(false); }}
          title={t('meshcore.contact_sync.remove_title', 'Remove non-favourite contacts?')}
        >
          <p data-testid="meshcore-remove-confirm-text">
            {t('meshcore.contact_sync.remove_confirm', {
              removable,
              kept,
              defaultValue: 'This removes {{removable}} contacts from the radio and keeps {{kept}} favourites.',
            })}
          </p>
          <p className="hint">
            {t(
              'meshcore.contact_sync.remove_confirm_note',
              "This changes the radio's list only. MeshMonitor keeps its nodes and history. Nothing is transmitted.",
            )}
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={() => setConfirmRemove(false)} disabled={removing}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => void handleRemove()} disabled={removing}>
              {removing
                ? t('meshcore.contact_sync.removing', 'Removing…')
                : t('meshcore.contact_sync.remove_confirm_button', 'Remove')}
            </button>
          </div>
        </Modal>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {removeResult && (
          <p className={styles.subtle} data-testid="meshcore-remove-result">
            {t('meshcore.contact_sync.remove_result', {
              removed: removeResult.removed,
              kept: removeResult.kept,
              failed: removeResult.failed,
              defaultValue: 'Removed {{removed}}, kept {{kept}}, failed {{failed}}',
            })}
          </p>
        )}

        {pushResult && (
          <ul className={styles.result} data-testid="meshcore-push-result">
            <li>{t('meshcore.contact_sync.result_added', { count: pushResult.added.length, defaultValue: 'Added: {{count}}' })}</li>
            <li>{t('meshcore.contact_sync.result_already', { count: pushResult.alreadyOnDevice, defaultValue: 'Already on the radio: {{count}}' })}</li>
            {pushResult.notAddedNoRoom > 0 && (
              <li>{t('meshcore.contact_sync.result_no_room', { count: pushResult.notAddedNoRoom, defaultValue: 'Not added, no free slot: {{count}}' })}</li>
            )}
            {skippedBy('unknown_type') > 0 && (
              <li>{t('meshcore.contact_sync.result_unknown_type', { count: skippedBy('unknown_type'), defaultValue: 'Skipped, type not known yet: {{count}}' })}</li>
            )}
            {skippedBy('ignored') > 0 && (
              <li>{t('meshcore.contact_sync.result_ignored', { count: skippedBy('ignored'), defaultValue: 'Skipped, ignored or blocked: {{count}}' })}</li>
            )}
            {skippedBy('failed') > 0 && (
              <li>{t('meshcore.contact_sync.result_failed', { count: skippedBy('failed'), defaultValue: 'Failed: {{count}}' })}</li>
            )}
            {pushResult.capacityKnown ? (
              <li>
                {t('meshcore.contact_sync.result_slots', {
                  before: pushResult.freeSlotsBefore,
                  after: pushResult.freeSlotsAfter,
                  max: pushResult.maxContacts,
                  defaultValue: 'Free slots: {{before}} before, {{after}} after (of {{max}})',
                })}
              </li>
            ) : (
              <li>
                {t(
                  'meshcore.contact_sync.result_capacity_unknown',
                  "Could not read how many contacts the radio holds, so only favourites were pushed.",
                )}
              </li>
            )}
            {pushResult.error && <li className={styles.error}>{pushResult.error}</li>}
          </ul>
        )}
        {pushResult && pushResult.notAddedNoRoom > 0 && pushResult.freeSlotsAfter === 0 && (
          <p className="hint" data-testid="meshcore-push-full-hint">
            {t(
              'meshcore.contact_sync.full_hint',
              "The radio's contact list is full, so nothing more could be added. To add a specific node, open it in Node Details and use \"Add to radio\": after you confirm, the radio replaces its oldest contact that isn't a favourite. Or turn on replacing the oldest contact, or remove non-favourite contacts, in this section.",
            )}
          </p>
        )}
      </ConfigSection>
    </div>
  );
};
