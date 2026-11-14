/**
 * Purge Data (boards 15-05, 15-18; s15n2): PurgeDataModal's choices in one
 * plain confirm, no typed word, as today: the four purges as checkboxes, and
 * keep / delete locally / purge from the device as radios, nothing picked.
 * The requests and toasts are today's: Purge All Messages and the two deletes
 * as App sends them, the other three through useMeshtasticNodeActions
 * (Ruling 2.4). A delete leaves the node's page for the device's.
 * Nothing here sends on the mesh; purging from the device tells the
 * connected radio to forget the node (its Sends line says so).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import type { MeshtasticNodeActions } from '../../../hooks/useMeshtasticNodeActions';
import { appBasename } from '../../../init';
import type { DeviceInfo } from '../../../types/device';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import { useShellDevices } from '../../shell/shellDevices';
import styles from './PurgeDataSheet.module.css';

export interface PurgeDataSheetProps {
  open: boolean;
  sourceId: string;
  node: DeviceInfo;
  onClose(): void;
  purgeNodeData: MeshtasticNodeActions['purgeNodeData'];
  refetchPoll(): unknown;
  /** After Purge All Messages succeeds, so the open conversation can drop them (as App does). */
  onMessagesPurged?(): void;
}

interface PurgeChoice {
  messages: boolean;
  traceroutes: boolean;
  telemetry: boolean;
  positionHistory: boolean;
  node: 'keep' | 'local' | 'device';
}

const EMPTY: PurgeChoice = { messages: false, traceroutes: false, telemetry: false, positionHistory: false, node: 'keep' };

const BOXES = [
  ['messages', 'purgeModal.purgeMessages'],
  ['traceroutes', 'purgeModal.purgeTraceroutes'],
  ['telemetry', 'purgeModal.purgeTelemetry'],
  ['positionHistory', 'purgeModal.purgePositionHistory'],
] as const;

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export default function PurgeDataSheet({ open, sourceId, node, onClose, purgeNodeData, refetchPoll, onMessagesPurged }: PurgeDataSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const csrfFetch = useCsrfFetch();
  const { sources } = useShellDevices();
  const deviceName = sources.find((s) => s.id === sourceId)?.name ?? '';
  const nodeName = node.user?.longName || node.user?.shortName || node.user?.id || '';
  const [choice, setChoice] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setChoice(EMPTY);
  }, [open]);
  const picked = choice.messages || choice.traceroutes || choice.telemetry || choice.positionHistory || choice.node !== 'keep';
  const radios = [
    ['keep', t('workspace.node_menu.purge_keep')],
    ['local', t('purgeModal.deleteLocal')],
    ['device', t('purgeModal.deleteDevice')],
  ] as const;

  const purge = async () => {
    const shortName = node.user?.shortName || node.user?.longName || `Node ${node.nodeNum}`;
    if (choice.messages) {
      const res = await csrfFetch(`${appBasename}/api/messages/direct-messages/${node.nodeNum}`, jsonInit('DELETE', { sourceId }));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(t('toast.failed_purge_messages', { error: body.message || t('errors.unknown') }));
      showToast(t('toast.purged_messages_dm', { count: body.deletedCount, node: shortName }), 'success');
      onMessagesPurged?.();
    }
    for (const what of ['traceroutes', 'telemetry', 'positionHistory'] as const) {
      if (choice[what]) await purgeNodeData(node.nodeNum, { what });
    }
    if (choice.node !== 'keep') {
      const device = choice.node === 'device';
      const res = await csrfFetch(
        `${appBasename}/api/messages/nodes/${node.nodeNum}${device ? '/purge-from-device' : ''}`,
        jsonInit(device ? 'POST' : 'DELETE', { sourceId }),
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(t(device ? 'toast.failed_purge_node_device' : 'toast.failed_delete_node', { error: body.message || t('errors.unknown') }));
      showToast(
        t(device ? 'toast.purged_node_device' : 'toast.deleted_node', {
          node: shortName, messages: body.messagesDeleted, traceroutes: body.traceroutesDeleted, telemetry: body.telemetryDeleted,
        }),
        'success',
      );
      void refetchPoll();
      onClose();
      void navigate(`/source/${encodeURIComponent(sourceId)}`);
      return;
    }
    onClose();
  };

  return (
    <ConfirmSheet
      open={open}
      title={
        <span className={styles.title}>
          <UiIcon name="alert" size={20} className={styles.titleIcon} />
          {t('purgeModal.title', { nodeName })}
        </span>
      }
      confirmLabel={t('workspace.chat.purge')}
      danger
      busy={busy}
      confirmDisabled={!picked}
      onCancel={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          await purge();
        } finally {
          setBusy(false);
        }
      }}
      body={
        <div className={styles.purge}>
          <p>{t('purgeModal.warning')}</p>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('workspace.chat.purge')}</legend>
            <div className={styles.boxes}>
              {BOXES.map(([key, label]) => (
                <label key={key} className={styles.check}>
                  <input type="checkbox" checked={choice[key]} onChange={(e) => setChoice({ ...choice, [key]: e.target.checked })} />
                  {t(label)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{t('purgeModal.deleteNodeTitle')}</legend>
            <p className={styles.hint}>{t('purgeModal.deleteNodeDescription')}</p>
            {radios.map(([value, label]) => (
              <label key={value} className={styles.check}>
                <input type="radio" name="purge-node" checked={choice.node === value} onChange={() => setChoice({ ...choice, node: value })} />
                {label}
              </label>
            ))}
            {choice.node === 'device' && <SendsLine>{t('workspace.node_menu.purge_device_sends', { device: deviceName })}</SendsLine>}
          </fieldset>
          {node.asset && (
            <p className={styles.asset} role="alert">
              <UiIcon name="alert" size={16} /> {t('purgeModal.assetWarning')}
            </p>
          )}
        </div>
      }
    />
  );
}
