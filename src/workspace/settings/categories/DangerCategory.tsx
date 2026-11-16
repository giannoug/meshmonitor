/**
 * Maintenance › Danger zone (boards 12-10 / 12-28, Task 5.7), also drawn on
 * the Maintenance page. Today's actions and words, each confirmed in a
 * ConfirmSheet; every one transmits an admin packet, so Enter never confirms
 * (Ruling BH).
 *
 * - Reboot (plain) and Purge node database (types PURGE): today's danger zone,
 *   through the frame's saves (configuration:write), busy while they run.
 * - Shut down and Reboot into DFU mode (plain), Reset config and Full device
 *   reset (type the short name): moved here from Admin Commands, admins only
 *   as its route, one admin command each, never retried. DFU and the resets are
 *   for the local node only; on a remote target they are off with today's reason.
 *   Shut down is off when the node's metadata says it cannot shut down, read
 *   once from the local node's cached metadata (no packet is sent).
 * - On a remote target (Task 5.9) Reboot, Purge and Shut down go to that node
 *   as Admin Commands sends them: Reboot after a delay of 0–60 s (default 5),
 *   Purge typing PURGE, Shut down typing the node's short name with today's
 *   remote warning, off when the node's metadata (Retrieve Device Metadata, on
 *   today's button only) says it cannot shut down. Each is one admin packet.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { FactoryResetWipeList } from '../../../components/shared/config/FactoryResetWipeList';
import { useAuth } from '../../../contexts/AuthContext';
import { usePoll } from '../../../hooks/usePoll';
import apiService from '../../../services/api';
import { isTxDisabledError } from '../../../utils/txDisabled';
import { mqttRootErrorMessage } from '../../../components/MQTT/mqttRootApiError';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useRemoteTarget } from '../remote/useRemoteTarget';
import { useIsPhone } from '../../shell/useIsPhone';
import { NumberInput } from '../../../components/common/NumberInput';
import type { CategoryProps } from '../categories';
import { ActionRow, MaintenancePage } from './maintenanceShared';
import pages from './SettingsPages.module.css';
import styles from './Maintenance.module.css';

/** Seconds the node waits before it powers off, as Admin Commands. */
const SHUTDOWN_DELAY_SECONDS = 5;

type DeviceAction = 'shutdown' | 'enterDfuMode' | 'factoryResetConfig' | 'factoryResetDevice';
type Action = 'reboot' | 'purge' | DeviceAction;

/** Admin Commands' locale stem per action (DeviceActionsSection). */
const KEY: Record<DeviceAction, string> = {
  shutdown: 'shutdown',
  enterDfuMode: 'dfu',
  factoryResetConfig: 'reset_config',
  factoryResetDevice: 'reset_device',
};

const isReset = (a: Action | null) => a === 'factoryResetConfig' || a === 'factoryResetDevice';

export default function DangerCategory(props: CategoryProps) {
  return (
    <MaintenancePage child={{ sourceId: props.sourceId }}>
      <DangerBody {...props} />
    </MaintenancePage>
  );
}

export function DangerBody({ sourceId, target, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { authStatus } = useAuth();
  const isAdmin = authStatus?.user?.isAdmin === true;
  const config = useSharedDeviceConfig();
  // Today's fallback word when the node has no short name: its node id.
  const { data: poll } = usePoll();
  const [pending, setPending] = useState<Action | null>(null);
  // The typed word as the sheet opened, so a refetch that blanks the name can never make it plain.
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ action: DeviceAction; name: string } | null>(null);
  // Today's canShutdown (DeviceActionsSection): for the local node the route answers from the
  // manager's cache and sends nothing (adminRoutes get-device-metadata). Admins only, as the route.
  const { data: metadata } = useQuery({
    queryKey: ['workspace', 'localDeviceMetadata', sourceId],
    queryFn: () => apiService.post<{ deviceMetadata?: { canShutdown?: boolean | null } }>('/api/admin/get-device-metadata', { sourceId }),
    enabled: isAdmin && target.kind === 'local',
    staleTime: Infinity,
    retry: false,
  });
  const remote = useRemoteTarget();
  const isPhone = useIsPhone();
  // Admin Commands' reboot delay for a remote node: 0–60 s, 5 by default.
  const [delay, setDelay] = useState<number | null>(5);
  const canShutdown = remote ? remote.metadata?.canShutdown : metadata?.deviceMetadata?.canShutdown;
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const { state, saves } = config;

  const nodeId = (poll?.config?.localNodeInfo as { nodeId?: string } | undefined)?.nodeId ?? '';
  // Today's typed word: the node's short name, or its node id when it has none.
  const name = remote ? remote.node.shortName.trim() || remote.node.nodeId : state.shortName.trim() || nodeId;
  const localOnly = target.kind === 'remote' ? t('device_actions.local_only_note') : null;
  const off = (remote ? busy || remote.blocked : state.isSaving) || readOnly;
  const adminOff = busy || readOnly || !!remote?.blocked;
  const sendsText = remote
    ? t('workspace.settings.remote.sends_admin_packet', { name: remote.node.longName })
    : t('workspace.settings.savebar.sends_nothing');
  const sends = <SendsLine>{sendsText}</SendsLine>;
  const close = () => setPending(null);
  // A remote node's command: today's executeCommand, which shows its own result.
  const sendRemote = async (command: string, params: Record<string, unknown>) => {
    setBusy(true);
    try {
      await remote!.execute(command, params);
    } catch {
      // Shown by execute.
    } finally {
      setBusy(false);
      close();
    }
  };

  const send = async (action: DeviceAction, sentName: string) => {
    if (remote) {
      setBusy(true);
      try {
        await remote.execute(action, action === 'shutdown' ? { seconds: SHUTDOWN_DELAY_SECONDS } : {});
        setSent({ action, name: sentName });
      } catch {
        // Shown by execute.
      } finally {
        setBusy(false);
        close();
      }
      return;
    }
    setBusy(true);
    try {
      const result = await apiService.sendAdminCommand<{ success: boolean; message?: string; data?: { message?: string } }>({
        command: action,
        sourceId,
        ...(action === 'shutdown' ? { seconds: SHUTDOWN_DELAY_SECONDS } : {}),
      });
      showToast(result.message || result.data?.message || t('admin_commands.command_executed', { command: action }), 'success');
      setSent({ action, name: sentName });
    } catch (error) {
      // Admin Commands' mapping: a TX-disabled race, a refused MQTT root, else the server's message.
      if (isTxDisabledError(error)) showToast(t('tx_disabled.send_blocked_toast'), 'warning');
      else showToast(mqttRootErrorMessage(error, t) || (error instanceof Error && error.message) || t('admin_commands.failed_execute_command'), 'error');
    } finally {
      setBusy(false);
      close();
    }
  };

  const device = pending && pending !== 'reboot' && pending !== 'purge' ? pending : null;
  const key = device ? KEY[device] : '';

  const danger = (action: Action, labelText: string, disabled: boolean) => (
    <button
      type="button"
      className={`${pages.button} ${pages.dangerButton}`}
      disabled={disabled}
      onClick={() => {
        setWord(name);
        setPending(action);
      }}
    >
      {labelText}
    </button>
  );

  return (
    <>
      <p className={pages.note}>
        <UiIcon name="info" size={16} />
        <span>{t('config.danger_zone_description')}</span>
      </p>
      <DangerZone
        title={
          <span className={pages.inline}>
            <UiIcon name="alert" size={16} /> {t('config.danger_zone')}
          </span>
        }
      >
        <ActionRow
          id="maintenance.danger.restart"
          label={t('workspace.settings.maintenance.restart_title')}
          help={remote ? t('workspace.settings.remote.restart_help', { word: name }) : t('workspace.settings.maintenance.restart_help')}
          blocked={isAdmin && canShutdown === false ? t('device_actions.shutdown.cannot_note') : null}
          sends={sends}
        >
          {danger('reboot', t('config.reboot_device'), off)}
          {isAdmin && danger('shutdown', t('device_actions.shutdown.button'), adminOff || canShutdown === false)}
        </ActionRow>
        <ActionRow id="maintenance.danger.nodedb" label={t('workspace.settings.maintenance.nodedb_title')} help={t('workspace.settings.maintenance.nodedb_help')} sends={sends}>
          {danger('purge', t('config.purge_node_db'), off)}
        </ActionRow>
        {isAdmin && (
          <>
            <ActionRow id="maintenance.danger.dfu" label={t('workspace.settings.maintenance.dfu_title')} help={t('device_actions.dfu.note')} blocked={localOnly} sends={sends}>
              {danger('enterDfuMode', t('device_actions.dfu.button'), adminOff || !!localOnly)}
            </ActionRow>
            <ActionRow
              id="maintenance.danger.reset"
              label={t('workspace.settings.maintenance.reset_title')}
              help={name ? t('workspace.settings.maintenance.reset_help', { word: name }) : undefined}
              blocked={localOnly}
              sends={sends}
            >
              {/* A blank word would make the typed confirm a plain one. */}
              {danger('factoryResetConfig', t('device_actions.reset_config.button'), adminOff || !!localOnly || !name)}
              {danger('factoryResetDevice', t('device_actions.reset_device.button'), adminOff || !!localOnly || !name)}
            </ActionRow>
          </>
        )}
      </DangerZone>

      {sent && (
        <div className={styles.sent} role="status">
          <strong>{t(`device_actions.${KEY[sent.action]}.sent_title`, { name: sent.name })}</strong>
          <span>
            {t(remote && sent.action === 'shutdown' ? 'device_actions.shutdown.sent_remote' : `device_actions.${KEY[sent.action]}.sent_local`, {
              name: sent.name,
              seconds: SHUTDOWN_DELAY_SECONDS,
            })}
          </span>
        </div>
      )}

      <ConfirmSheet
        open={pending === 'reboot'}
        title={t('config.reboot_dialog_title')}
        body={
          remote ? (
            <>
              <label className={pages.field} data-phone={isPhone || undefined}>
                <span className={pages.infoLabel}>{t('admin_commands.reboot_delay_label')}</span>
                <NumberInput integer min={0} max={60} className={pages.keyInput} value={delay} onChange={setDelay} onValidityChange={(ok) => !ok && setDelay(null)} />
              </label>
              <p className={pages.para}>{t('admin_commands.reboot_confirmation', { seconds: delay ?? 5 })}</p>
              {sends}
            </>
          ) : (
            <>
              <p className={pages.para}>{t('config.reboot_dialog_message')}</p>
              {sends}
            </>
          )
        }
        confirmLabel={t('config.reboot_device')}
        busy={remote ? busy : state.isSaving}
        confirmDisabled={!!remote && delay === null}
        submitOnEnter={false}
        onConfirm={async () => {
          if (remote) return sendRemote('reboot', { seconds: delay ?? 5 });
          await saves.reboot();
          close();
        }}
        onCancel={close}
      />
      <ConfirmSheet
        open={pending === 'purge'}
        title={t('config.purge_dialog_title')}
        body={
          <>
            <p className={pages.para}>{t(remote ? 'admin_commands.purge_confirmation' : 'config.purge_dialog_body')}</p>
            {sends}
          </>
        }
        confirmWord="PURGE"
        confirmLabel={t('config.purge_node_db')}
        danger
        busy={remote ? busy : state.isSaving}
        submitOnEnter={false}
        onConfirm={async () => {
          if (remote) return sendRemote('purgeNodeDb', { seconds: 0 });
          await saves.purgeNodeDb();
          close();
        }}
        onCancel={close}
      />
      <ConfirmSheet
        open={device !== null}
        title={t(`device_actions.${key}.confirm_title`, { name: word })}
        body={
          <>
            <p className={pages.para}>{t(`device_actions.${key}.confirm_body`, { name: word, seconds: SHUTDOWN_DELAY_SECONDS })}</p>
            {remote && device === 'shutdown' && <p className={pages.warn}>{t('device_actions.shutdown.remote_warning')}</p>}
            {isReset(device) && (
              <>
                <FactoryResetWipeList
                  items={device === 'factoryResetDevice' ? ['settings', 'channels', 'nodedb', 'network', 'identity'] : ['settings', 'channels', 'nodedb', 'network']}
                />
                <p className={pages.para}>{t(`device_actions.${key}.keeps`)}</p>
                <p className={pages.warn}>{t('device_actions.reset_drop_warning')}</p>
              </>
            )}
            {sends}
          </>
        }
        // Today's: the resets type the name; so does Shut down for a remote node, which stays off until someone walks to it.
        confirmWord={isReset(device) || (remote && device === 'shutdown') ? word : undefined}
        confirmLabel={t(`device_actions.${key}.confirm_label`)}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => send(device!, word)}
        onCancel={close}
      />
    </>
  );
}
