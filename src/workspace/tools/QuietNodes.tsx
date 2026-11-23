/**
 * Quiet nodes (boards 16-06-quiet-nodes, 16-07-delete-nodes; note s16n2):
 * today's Dead nodes at `/source/:id/security/quiet`, oldest first.
 *
 * - Dead after (days) has its own Save, as today (settings:write; a
 *   per-source setting).
 * - Ticks key on today's `nodeKey`; Select all skips never-heard rows, as
 *   today. Delete needs security:write and nodes:write on this device (the
 *   route's own gates) and asks plainly with today's sentence, no typed word,
 *   naming what goes: the nodes in MeshMonitor, and those in the radio's node
 *   list there too. One bulk request for exactly the ticked keys; a second
 *   press waits for the first. The radio's list is changed over the local
 *   connection: nothing is sent on the mesh.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../components/common/NumberInput';
import { UiIcon } from '../../components/icons';
import { bulkDeleteDeadNodes, formatLastHeard, saveDeadNodeDays } from '../../components/security/deadNodesActions';
import type { DeadNode } from '../../components/security/securityTypes';
import { getHardwareModelName } from '../../utils/hardwareModel';
import { logger } from '../../utils/logger';
import ToolHead from '../meshcore/ToolHead';
import ConfirmSheet from '../patterns/ConfirmSheet';
import SendsLine from '../patterns/SendsLine';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import mc from '../meshcore/McTools.module.css';
import styles from './Tools.module.css';

const MIN_DAYS = 1;
const MAX_DAYS = 365;

export interface QuietNodesProps {
  sourceId: string;
  deviceName: string;
  isMeshCore: boolean;
  /** The delete also removes the node from the radio's own list (Meshtastic; a MeshCore Companion). */
  deviceDelete: boolean;
  loading: boolean;
  nodes: DeadNode[];
  thresholdDays: number;
  forbidden: boolean;
  canDelete: boolean;
  canEditThreshold: boolean;
  onChanged(): void | Promise<void>;
}

const nameOf = (n: DeadNode) => n.longName || n.shortName || n.nodeId;
const list = (names: string[]) => names.join(', ');

export default function QuietNodes({
  sourceId, deviceName, isMeshCore, deviceDelete, loading, nodes, thresholdDays, forbidden, canDelete, canEditThreshold, onChanged,
}: QuietNodesProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(thresholdDays);
  const [daysValid, setDaysValid] = useState(true);
  const [savingDays, setSavingDays] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // One bulk delete per confirm: a second press before the first re-render waits for it.
  const deletingRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const base = `/source/${encodeURIComponent(sourceId)}`;

  useEffect(() => setDays(thresholdDays), [thresholdDays]);
  // A poll replaces the list; keep ticks for rows that are still there (today's rule).
  useEffect(() => {
    setSelected((prev) => {
      const keys = new Set(nodes.map((n) => n.nodeKey));
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [nodes]);

  const heardKeys = nodes.filter((n) => n.lastHeard).map((n) => n.nodeKey);
  const allHeardSelected = heardKeys.length > 0 && heardKeys.every((k) => selected.has(k));
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const saveDays = async () => {
    if (!daysValid || savingDays) return;
    setSavingDays(true);
    setMessage(null);
    try {
      await saveDeadNodeDays(sourceId, days);
      await onChanged();
    } catch (err) {
      logger.error('Error saving dead node threshold:', err);
      setMessage(t('security.mc_dead_nodes_threshold_failed'));
    } finally {
      setSavingDays(false);
    }
  };

  const picked = nodes.filter((n) => selected.has(n.nodeKey));
  const onDevice = deviceDelete ? picked.filter((n) => n.inDeviceDb) : [];
  const localOnly = picked.filter((n) => !onDevice.includes(n));
  const deleteLabel = t('security.dead_nodes_delete_button', { count: selected.size });
  const reappear = t('security.mc_dead_nodes_reappear');

  const remove = async () => {
    if (deletingRef.current || selected.size === 0) return;
    deletingRef.current = true;
    setDeleting(true);
    setMessage(null);
    try {
      const kept = await bulkDeleteDeadNodes(sourceId, Array.from(selected));
      if (kept > 0) setMessage(t('security.mc_dead_nodes_protected', { count: kept }));
      setSelected(new Set());
      setConfirmOpen(false);
      await onChanged();
    } catch (err) {
      logger.error('Error bulk deleting dead nodes:', err);
      throw new Error(t('security.mc_dead_nodes_delete_failed'), { cause: err });
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const head = (
    <ToolHead
      title={t('workspace.security.quiet_nodes')}
      subtitle={t('workspace.security.quiet_scope', { device: deviceName, count: nodes.length, days: thresholdDays })}
      back={{ label: t('nav.security'), to: `${base}/security` }}
    />
  );
  if (loading) {
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
        {head}
        <StateView kind="loading" />
      </div>
    );
  }
  if (forbidden) {
    return (
      <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
        {head}
        <p className={mc.note} data-testid="security-dead-nodes-forbidden">{t('security.mc_no_node_access')}</p>
      </div>
    );
  }

  return (
    <div className={`${mc.page} ${styles.phoneScope}`} data-phone={isPhone ? '' : undefined}>
      {head}
      {isPhone && (
        <p className={mc.note}>
          <UiIcon name="security" size={18} />
          {t('workspace.security.quiet_scope', { device: deviceName, count: nodes.length, days: thresholdDays })}
        </p>
      )}
      <div className={mc.card}>
        <div className={styles.threshold}>
          <label className={styles.thresholdText} htmlFor="ws-dead-days">
            <span className={styles.quietName}>{t('security.mc_dead_nodes_threshold')}</span>
            <span className={styles.formHint}>{t('workspace.security.threshold_hint')}</span>
          </label>
          <NumberInput
            id="ws-dead-days"
            integer
            min={MIN_DAYS}
            max={MAX_DAYS}
            className={`${styles.input} ${styles.daysInput}`}
            value={days}
            disabled={!canEditThreshold}
            onChange={setDays}
            onValidityChange={setDaysValid}
          />
          {canEditThreshold && (
            <button type="button" className={mc.button} onClick={() => void saveDays()} disabled={savingDays || !daysValid || days === thresholdDays}>
              {t('common.save', 'Save')}
            </button>
          )}
        </div>
      </div>
      {isMeshCore && (
        <p className={mc.note} data-testid="security-dead-nodes-reappear"><UiIcon name="alert" size={16} />{reappear}</p>
      )}
      {message && <p className={mc.note} role="status">{message}</p>}
      {nodes.length === 0 ? (
        <p className={mc.note}>{t('security.mc_dead_nodes_empty', { days: thresholdDays })}</p>
      ) : (
        <>
          <div className={styles.selectBar}>
            <span>{t('workspace.security.selected', { selected: selected.size, total: nodes.length })}</span>
            <button type="button" className={styles.textButton} onClick={() => setSelected(allHeardSelected ? new Set() : new Set(heardKeys))}>
              {allHeardSelected ? t('security.dead_nodes_deselect_all') : t('security.dead_nodes_select_all')}
            </button>
          </div>
          <div className={mc.card}>
            {nodes.map((n) => (
              <label key={n.nodeKey} className={styles.quietRow}>
                <input type="checkbox" checked={selected.has(n.nodeKey)} onChange={() => toggle(n.nodeKey)} aria-label={nameOf(n)} />
                <span className={styles.avatar} aria-hidden="true">{(n.shortName || nameOf(n)).slice(0, 4)}</span>
                <span className={styles.quietText}>
                  <span className={styles.quietName}>
                    {n.longName || n.shortName || t('security.mc_unknown_name')}
                    {n.shortName && n.longName && n.shortName !== n.longName && <span className={mc.muted}> ({n.shortName})</span>}
                  </span>
                  <span className={styles.quietLine}>
                    {formatLastHeard(t as never, n.lastHeard)} ·{' '}
                    <span title={n.inDeviceDb ? t('security.dead_nodes_in_both') : t('security.dead_nodes_local_only')}>
                      {n.inDeviceDb ? t('security.dead_nodes_local_and_device') : t('security.dead_nodes_local_only_short')}
                    </span>
                    {' · '}
                    <span className={mc.mono}>{isMeshCore ? n.nodeId.slice(0, 12) : n.nodeId}</span>
                    {!isMeshCore && n.hwModel != null && ` · ${getHardwareModelName(n.hwModel)}`}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className={styles.dock}>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={!canDelete || selected.size === 0 || deleting}
              onClick={() => setConfirmOpen(true)}
            >
              {deleting ? t('security.dead_nodes_deleting') : deleteLabel}
            </button>
            {!canDelete && <p className={mc.muted}>{t('workspace.security.delete_needs')}</p>}
            <SendsLine>{t('workspace.packets.sends_nothing')}</SendsLine>
          </div>
        </>
      )}
      <ConfirmSheet
        open={confirmOpen}
        title={t('workspace.security.delete_title', { label: deleteLabel })}
        danger
        busy={deleting}
        submitOnEnter={false}
        confirmLabel={deleteLabel}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
        body={
          <>
            <p>{t('workspace.security.removes')}</p>
            <ul className={styles.bullets}>
              <li>{t('workspace.security.removes_meshmonitor', { names: list(picked.map(nameOf)) })}</li>
              {onDevice.length > 0 && (
                <li>
                  {t('workspace.security.removes_device', { names: list(onDevice.map(nameOf)), device: deviceName })}
                  {localOnly.length > 0 && ` ${t('workspace.security.removes_local_only', { names: list(localOnly.map(nameOf)) })}`}
                </li>
              )}
              <li>{isMeshCore ? t('workspace.security.kept_meshcore') : t('workspace.security.kept_meshtastic')}</li>
            </ul>
            <p>
              {t('security.dead_nodes_confirm_delete', { count: selected.size })}
              {isMeshCore && ` ${reappear}`}
            </p>
            <SendsLine>{t('workspace.packets.sends_nothing')}</SendsLine>
          </>
        }
      />
    </div>
  );
}
