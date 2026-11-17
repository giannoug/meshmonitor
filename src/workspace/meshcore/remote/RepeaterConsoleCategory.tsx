/**
 * Settings › Remote: <repeater or room server> › Console (boards 8-06, 8-21):
 * today's remote console (MeshCoreRemoteConsole) drawn as the boards draw it.
 *
 * - Header (desktop): Log out (sends nothing) and Forget stored password.
 * - The login card (RemoteLogin): guest or admin, remember, saved password,
 *   resume the remembered session.
 * - Once logged in: Remote node status (Fetch stats only when pressed, never
 *   on a timer), today's quick actions (each labelled with its command; it
 *   fills the input and sends nothing; on the phone the first few and
 *   "+N more", note s8n6), the transcript and input on today's
 *   CliConsoleBody, and the History panel.
 * - A command that matches DANGER_COMMAND_PATTERN (typed, or the reboot
 *   action) asks first in a ConfirmSheet with today's words and the
 *   contact's name to type (Ruling 7.3 HI); Enter there sends nothing (BH).
 *   The server keeps its own guard.
 */
import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CliConsoleBody, type ActionCommand } from '../../../components/MeshCore/CliConsoleBody';
import { REMOTE_ACTION_CATALOG } from '../../../components/MeshCore/remoteActionCatalog';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import type { CategoryProps } from '../../settings/categories';
import { SettingsHeaderSlotContext } from '../../settings/settingsDock';
import { HistoryPanel, RemoteStatusPanel } from './ConsolePanels';
import { useMeshCoreTarget } from './remoteTarget';
import RemoteLogin, { SessionButtons } from './RemoteLogin';
import { useTargetHeader } from './useTargetHeader';
import styles from './McRemote.module.css';

/** Today's remote quick actions, each chip showing its command as the boards draw them (not translated). */
const CATALOG: ActionCommand[] = REMOTE_ACTION_CATALOG.map((a) => ({ ...a, label: a.command }));
/** The phone shows these first (8-21); "+N more" opens the rest (note s8n6). */
const PHONE_FIRST = ['ver', 'neighbors', 'clock_sync', 'advert', 'reboot'];
/** A restart: what the 8-06 confirm says happens (firmware facts, MESHCORE_REMOTE_ADMIN.md). */
const RESTART = /^\s*(reboot|clkreboot)\b/i;

export default function RepeaterConsoleCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const target = useMeshCoreTarget();
  const slot = useContext(SettingsHeaderSlotContext);
  useTargetHeader(target);
  const [danger, setDanger] = useState<{ command: string; send: () => Promise<void> } | null>(null);
  const [more, setMore] = useState(false);
  if (!target) return <StateView kind="noPermission" />;
  const { session: s, name, publicKey, blocked } = target;
  // `discover.neighbors` is simple_repeater-only firmware (today's catalog drops it for room servers).
  const catalog = target.isRepeater ? CATALOG : CATALOG.filter((a) => a.key !== 'discover_neighbors');
  const hidden = isPhone && !more ? catalog.filter((a) => !PHONE_FIRST.includes(a.key)) : [];
  const shown = catalog.filter((a) => !hidden.includes(a));
  const restart = !!danger && RESTART.test(danger.command);

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {slot && s.loggedIn && !isPhone && createPortal(<SessionButtons target={target} />, slot)}
      <RemoteLogin target={target} headerActions={!isPhone} />
      {s.loggedIn && <RemoteStatusPanel target={target} />}
      <div className={`${styles.columns} ${styles.consoleColumns}`} data-phone={isPhone || undefined}>
        <section className={styles.console} aria-label={t('workspace.meshcore.tab_console')}>
          {s.loggedIn && (
            <div className={styles.panelHead}>
              <h2 className={styles.heading}>{t('meshcore.remoteConsole.quick_actions', 'Quick actions')}</h2>
              {isPhone && hidden.length > 0 && (
                <button type="button" className={styles.button} onClick={() => setMore(true)}>
                  {t('workspace.meshcore.remote.more_actions', { count: hidden.length })}
                </button>
              )}
            </div>
          )}
          <CliConsoleBody
            ref={target.bodyRef}
            targetId={publicKey}
            targetName={name}
            runCommand={(text, opts) => target.actions.sendCliCommand(publicKey, text, opts)}
            actionCatalog={s.loggedIn ? shown : []}
            disabled={!s.loggedIn || !!blocked}
            disabledPlaceholder={blocked ?? undefined}
            timeoutHint={s.resumed ? t('meshcore.remoteConsole.resumed_timeout_hint') : undefined}
            onDangerCommand={(command, send) => setDanger({ command, send })}
          />
          <SendsLine>{t('workspace.meshcore.remote.sends_command', { name })}</SendsLine>
        </section>
        <HistoryPanel target={target} sourceId={sourceId} />
      </div>
      <ConfirmSheet
        open={danger !== null}
        title={t('meshcore.remoteConsole.danger_modal_title', 'Confirm destructive command')}
        body={
          danger && (
            <>
              <p>{t('workspace.meshcore.remote.danger_body', { command: danger.command, name })}</p>
              <SendsLine>{t('workspace.meshcore.remote.sends_danger', { command: danger.command, name })}</SendsLine>
              {restart && <p>{t('workspace.meshcore.remote.what_happens')}</p>}
            </>
          )
        }
        consequences={
          restart
            ? [t('workspace.meshcore.remote.restart_effect', { name }), t('workspace.meshcore.remote.restart_session')]
            : undefined
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
