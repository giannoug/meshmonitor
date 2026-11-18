/**
 * Settings › Console: a remote target's console (Task 7.3,
 * RepeaterConsoleCategory), or this radio's serial CLI (Task 7.4, note s8n4:
 * "the same console() as 8-06", Ruling HN), on 7.3's parts:
 *
 * - Today's quick actions for this device (localConsoleCatalog), today's
 *   CliConsoleBody (transcript, input, ↑/↓ history), one command per Send.
 * - A danger command (today's catalogue: reboot …) waits in a ConfirmSheet
 *   with today's typed name and `submitOnEnter={false}`; only its button sends,
 *   once, with `confirm: true`.
 * - Its Sends line: commands go over the serial link, the ones that transmit
 *   (adverts, discover.neighbors) say so; receive-only holds those as today.
 * - Command history (all users, secrets masked) and, on a repeater or room
 *   server, the access list (setperm), as today's console.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CliConsoleBody, type CliConsoleBodyHandle } from '../../../components/MeshCore/CliConsoleBody';
import { localActionCatalog } from '../../../components/MeshCore/localConsoleCatalog';
import { companionHasNativeCli } from '../../../utils/meshcoreCompanionCli';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import AclManager from '../remote/AclManager';
import { HistoryPanel } from '../remote/ConsolePanels';
import RepeaterConsoleCategory from '../remote/RepeaterConsoleCategory';
import { useMeshCoreTarget } from '../remote/remoteTarget';
import { useIsPhone } from '../../shell/useIsPhone';
import { McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import remote from '../remote/McRemote.module.css';
import styles from './McSettings.module.css';

export default function ConsoleCategory(props: CategoryProps) {
  const target = useMeshCoreTarget();
  return target ? <RepeaterConsoleCategory {...props} /> : <LocalConsole sourceId={props.sourceId} />;
}

function LocalConsole({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const isPhone = useIsPhone();
  const bodyRef = useRef<CliConsoleBodyHandle | null>(null);
  const [danger, setDanger] = useState<{ command: string; send: () => Promise<void> } | null>(null);
  const deviceType = d.local?.advType;
  const nativeCli = deviceType === 1 && companionHasNativeCli(d.local?.firmwareVer);
  // Today's typed word (MeshCoreLocalConsole's targetName).
  const name = d.local?.name || t('meshcore.localConsole.default_target', 'this device');
  const catalog = localActionCatalog(deviceType, nativeCli, d.receiveOnly);
  const placeholder = nativeCli
    ? t('meshcore.localConsole.companion_native_placeholder', 'Type a CLI command (ver, stats, get radio, set tx, get wifi.status, set tz.offset, help…)')
    : deviceType === 1
      ? t('meshcore.localConsole.companion_placeholder', 'Type a command (ver, stats, clock, advert.zerohop, advert, help)')
      : t('meshcore.localConsole.repeater_placeholder', 'Type a CLI command (ver, stats, neighbors, advert…)');
  const run = (text: string, opts?: { confirm?: boolean }) => d.actions.sendLocalCliCommand(text, opts);
  const showAcl = d.connected && (deviceType === 2 || deviceType === 3);

  return (
    <McPage>
      <div className={`${remote.columns} ${styles.console}`} data-phone={isPhone || undefined}>
        <section className={remote.console} aria-label={t('meshcore.localConsole.title', 'Device console')}>
          <div className={remote.panelHead}>
            <h2 className={remote.heading}>{t('meshcore.remoteConsole.quick_actions', 'Quick actions')}</h2>
            <span className={styles.muted}>
              {d.connected ? t('meshcore.localConsole.connected', 'Connected') : t('meshcore.localConsole.disconnected', 'Not connected')}
            </span>
          </div>
          <CliConsoleBody
            ref={bodyRef}
            targetId={sourceId}
            targetName={name}
            runCommand={run}
            actionCatalog={d.connected ? catalog : []}
            disabled={!d.connected}
            disabledPlaceholder={t('meshcore.localConsole.disconnected_placeholder', 'Connect the source to send commands')}
            placeholder={d.receiveOnly ? `${placeholder} ${t('meshcore.receive_only.console_placeholder')}` : placeholder}
            emptyTextDisabled={t('meshcore.localConsole.empty_disconnected', 'Connect the source to begin sending commands.')}
            emptyTextEnabled={t('meshcore.localConsole.empty_connected', 'Type a command below and press Send.')}
            onDangerCommand={(command, send) => setDanger({ command, send })}
          />
          <SendsLine>{t('workspace.meshcore.settings.sends_local_command')}</SendsLine>
        </section>
        <HistoryPanel target="local" sourceId={sourceId} />
      </div>
      {showAcl && (
        <div className={styles.console}>
        <AclManager
          run={(c) => run(c)}
          sends={t('workspace.meshcore.settings.sends_local_acl', { name })}
          disabled={!d.connected}
        />
        </div>
      )}
      <ConfirmSheet
        open={danger !== null}
        title={t('meshcore.remoteConsole.danger_modal_title', 'Confirm destructive command')}
        body={
          danger && (
            <>
              <p className={styles.para}>{t('workspace.meshcore.remote.danger_body', { command: danger.command, name })}</p>
              <SendsLine>{t('workspace.meshcore.settings.sends_local_danger', { command: danger.command, name })}</SendsLine>
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
    </McPage>
  );
}
