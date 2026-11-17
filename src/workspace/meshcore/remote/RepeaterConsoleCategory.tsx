/**
 * Settings › Remote: <repeater or room server> › Console (boards 8-06, 8-21):
 * today's remote console (MeshCoreRemoteConsole) on the shared parts.
 *
 * - The login card (RemoteLogin): guest or admin, remember, saved password,
 *   resume the remembered session.
 * - Once logged in, today's Remote node status (MeshCoreRemoteStatsPanel):
 *   Fetch stats only when pressed, never on a timer.
 * - The quick actions and transcript on today's CliConsoleBody: a quick
 *   action fills the command, only Send (or Enter) sends it, one message
 *   each. A command that matches DANGER_COMMAND_PATTERN (typed, or the reboot
 *   action) asks first in a ConfirmSheet with today's words and the
 *   contact's name to type; Enter there sends nothing (BH). The server keeps
 *   its own guard.
 * - Today's command history (all users, secrets masked).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CliConsoleBody, type ActionCommand } from '../../../components/MeshCore/CliConsoleBody';
import { MeshCoreRemoteStatsPanel } from '../../../components/MeshCore/MeshCoreRemoteStatsPanel';
import { REMOTE_ACTION_CATALOG } from '../../../components/MeshCore/remoteActionCatalog';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import type { CategoryProps } from '../../settings/categories';
import { useMeshCoreTarget } from './remoteTarget';
import RemoteLogin from './RemoteLogin';
import { useTargetHeader } from './useTargetHeader';
import styles from './McRemote.module.css';

/**
 * Today's quick actions, each chip labelled with its command as the boards draw them (i18next
 * returns the default for a key it does not hold), plus the three `get` reads the boards add;
 * each fills the input and sends nothing. No `stats`: a remote node has no such verb (today's note).
 */
const GETS = ['get radio', 'get tx', 'get name'].map((command): ActionCommand => ({ key: command, labelKey: command, defaultLabel: command, command }));
const clockAt = REMOTE_ACTION_CATALOG.findIndex((a) => a.key === 'clock');
const CATALOG: ActionCommand[] = [...REMOTE_ACTION_CATALOG.slice(0, clockAt), ...GETS, ...REMOTE_ACTION_CATALOG.slice(clockAt)].map((a) => ({
  ...a,
  labelKey: a.command,
  defaultLabel: a.command,
}));

export default function RepeaterConsoleCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const target = useMeshCoreTarget();
  useTargetHeader(target);
  const [danger, setDanger] = useState<{ command: string; send: () => Promise<void> } | null>(null);
  if (!target) return <StateView kind="noPermission" />;
  const { session: s, name, publicKey, blocked } = target;
  // `discover.neighbors` is simple_repeater-only firmware (today's catalog drops it for room servers).
  const catalog = target.isRepeater ? CATALOG : CATALOG.filter((a) => a.key !== 'discover_neighbors');

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <RemoteLogin target={target} />
      {s.loggedIn && (
        <div className={styles.stats}>
          <MeshCoreRemoteStatsPanel publicKey={publicKey} fetchStatus={target.actions.getRemoteStatus} receiveOnly={target.receiveOnly} />
          <SendsLine>{t('workspace.meshcore.remote.sends_stats', { name })}</SendsLine>
        </div>
      )}
      <section className={styles.console} aria-label={t('workspace.meshcore.tab_console')}>
        {s.loggedIn && <h2 className={styles.heading}>{t('meshcore.remoteConsole.quick_actions', 'Quick actions')}</h2>}
        <CliConsoleBody
          ref={target.bodyRef}
          targetId={publicKey}
          targetName={name}
          history={{ sourceId, target: publicKey }}
          runCommand={(text, opts) => target.actions.sendCliCommand(publicKey, text, opts)}
          actionCatalog={s.loggedIn ? catalog : []}
          disabled={!s.loggedIn || !!blocked}
          disabledPlaceholder={blocked ?? undefined}
          timeoutHint={s.resumed ? t('meshcore.remoteConsole.resumed_timeout_hint') : undefined}
          onDangerCommand={(command, send) => setDanger({ command, send })}
        />
        <SendsLine>{t('workspace.meshcore.remote.sends_command', { name })}</SendsLine>
      </section>
      <ConfirmSheet
        open={danger !== null}
        title={t('meshcore.remoteConsole.danger_modal_title', 'Confirm destructive command')}
        body={
          danger && (
            <>
              <p>{t('workspace.meshcore.remote.danger_body', { command: danger.command, name })}</p>
              <SendsLine>{t('workspace.meshcore.remote.sends_danger', { command: danger.command, name })}</SendsLine>
            </>
          )
        }
        confirmWord={name}
        confirmLabel={t('meshcore.remoteConsole.danger_confirm', 'Send {{command}}', { command: danger?.command ?? '' })}
        danger
        submitOnEnter={false}
        onConfirm={() => {
          const send = danger!.send;
          setDanger(null);
          void send();
        }}
        onCancel={() => setDanger(null)}
      />
    </div>
  );
}
