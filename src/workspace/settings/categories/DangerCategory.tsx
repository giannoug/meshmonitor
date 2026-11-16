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
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { FactoryResetWipeList } from '../../../components/shared/config/FactoryResetWipeList';
import { useAuth } from '../../../contexts/AuthContext';
import { usePoll } from '../../../hooks/usePoll';
import apiService from '../../../services/api';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
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
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<DeviceAction | null>(null);
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const { state, saves } = config;

  const nodeId = (poll?.config?.localNodeInfo as { nodeId?: string } | undefined)?.nodeId ?? '';
  const name = state.shortName.trim() || nodeId;
  const localOnly = target.kind === 'remote' ? t('device_actions.local_only_note') : null;
  const off = state.isSaving || readOnly;
  const adminOff = busy || readOnly;
  const sends = <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>;
  const close = () => setPending(null);

  // shortcut: reboot, purge and shut down act on the local node; Task 5.9 routes them to a remote target.
  const send = async (action: DeviceAction) => {
    setBusy(true);
    try {
      const result = await apiService.sendAdminCommand<{ success: boolean; message?: string; data?: { message?: string } }>({
        command: action,
        sourceId,
        ...(action === 'shutdown' ? { seconds: SHUTDOWN_DELAY_SECONDS } : {}),
      });
      showToast(result.message || result.data?.message || t('admin_commands.command_executed', { command: action }), 'success');
      setSent(action);
    } catch (error) {
      showToast(error instanceof Error && error.message ? error.message : t('admin_commands.failed_execute_command'), 'error');
    } finally {
      setBusy(false);
      close();
    }
  };

  const device = pending && pending !== 'reboot' && pending !== 'purge' ? pending : null;
  const key = device ? KEY[device] : '';

  const danger = (action: Action, labelText: string, disabled: boolean) => (
    <button type="button" className={`${pages.button} ${pages.dangerButton}`} disabled={disabled} onClick={() => setPending(action)}>
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
        <ActionRow id="maintenance.danger.restart" label={t('workspace.settings.maintenance.restart_title')} help={t('workspace.settings.maintenance.restart_help')} sends={sends}>
          {danger('reboot', t('config.reboot_device'), off)}
          {isAdmin && danger('shutdown', t('device_actions.shutdown.button'), adminOff)}
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
          <strong>{t(`device_actions.${KEY[sent]}.sent_title`, { name })}</strong>
          <span>{t(`device_actions.${KEY[sent]}.sent_local`, { name, seconds: SHUTDOWN_DELAY_SECONDS })}</span>
        </div>
      )}

      <ConfirmSheet
        open={pending === 'reboot'}
        title={t('config.reboot_dialog_title')}
        body={
          <>
            <p className={pages.para}>{t('config.reboot_dialog_message')}</p>
            {sends}
          </>
        }
        confirmLabel={t('config.reboot_device')}
        busy={state.isSaving}
        submitOnEnter={false}
        onConfirm={async () => {
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
            <p className={pages.para}>{t('config.purge_dialog_body')}</p>
            {sends}
          </>
        }
        confirmWord="PURGE"
        confirmLabel={t('config.purge_node_db')}
        danger
        busy={state.isSaving}
        submitOnEnter={false}
        onConfirm={async () => {
          await saves.purgeNodeDb();
          close();
        }}
        onCancel={close}
      />
      <ConfirmSheet
        open={device !== null}
        title={t(`device_actions.${key}.confirm_title`, { name })}
        body={
          <>
            <p className={pages.para}>{t(`device_actions.${key}.confirm_body`, { name, seconds: SHUTDOWN_DELAY_SECONDS })}</p>
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
        confirmWord={isReset(device) ? name : undefined}
        confirmLabel={t(`device_actions.${key}.confirm_label`)}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => send(device!)}
        onCancel={close}
      />
    </>
  );
}
