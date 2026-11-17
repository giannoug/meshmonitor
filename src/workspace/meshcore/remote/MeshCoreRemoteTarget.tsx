/**
 * A MeshCore device's remote target (Task 7.3, notes s8n0, s8n4): a repeater
 * or room server its settings configure, picked as "Configuring Remote: …"
 * like a Meshtastic node (Task 5.9). The provider holds, for the one node and
 * across its pages (Settings, Console):
 *
 * - today's login, saved password and remembered session
 *   (useMeshCoreRemoteSession, the flow MeshCoreRemoteConsole runs);
 * - the settings already read (useRemoteRepeaterSettings), so moving to the
 *   Console and back reads nothing again;
 * - the console transcript's handle, for the login's info lines;
 * - why commands to the node are off: receive-only, not in the radio's
 *   contacts (today's two), or a radio that is not a connected Companion
 *   (today hides the console then).
 *
 * It is keyed by the node, so another node starts logged out, as today.
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import type { CliConsoleBodyHandle } from '../../../components/MeshCore/CliConsoleBody';
import { useMeshCoreRemoteSession } from '../../../components/MeshCore/hooks/useMeshCoreRemoteSession';
import { useRemoteRepeaterSettings } from '../../../components/MeshCore/hooks/useRemoteRepeaterSettings';
import { useRepeaterSettingsDraft } from '../../../components/MeshCore/hooks/useRepeaterSettingsDraft';
import { useRemoteStats } from '../../../components/MeshCore/hooks/useRemoteStats';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import LeaveGuard from '../../settings/LeaveGuard';
import { remoteEntry, updateRemote } from '../../settings/remote/remoteTargetStore';
import { useMeshCoreRuntime } from '../runtime';
import { contactLabel, SETTING_LABELS, TargetContext, type MeshCoreTarget, type RemoteActions } from './remoteTarget';

export function MeshCoreTargetProvider({ contact, children }: { contact: MeshCoreContact; children: ReactNode }) {
  const { t } = useTranslation();
  const { meshCore, receiveOnly, sourceId } = useMeshCoreRuntime();
  const a = meshCore.actions;
  // useMeshCore rebuilds `actions` on every render; its members are stable, so the session's lookups run once.
  const actions = useMemo<RemoteActions>(
    () => ({
      loginRemote: a.loginRemote,
      loginRemoteWithSaved: a.loginRemoteWithSaved,
      getLoginProgress: a.getLoginProgress,
      cancelLogin: a.cancelLogin,
      sendCliCommand: a.sendCliCommand,
      getRemoteAdminCapability: a.getRemoteAdminCapability,
      forgetRemoteCredential: a.forgetRemoteCredential,
      getRemoteStatus: a.getRemoteStatus,
      getRemoteAdminSession: a.getRemoteAdminSession,
      logoutRemote: a.logoutRemote,
      readRemoteSettings: a.readRemoteSettings,
      saveRemoteSettings: a.saveRemoteSettings,
    }),
    [a.loginRemote, a.loginRemoteWithSaved, a.getLoginProgress, a.cancelLogin, a.sendCliCommand, a.getRemoteAdminCapability,
      a.forgetRemoteCredential, a.getRemoteStatus, a.getRemoteAdminSession, a.logoutRemote, a.readRemoteSettings, a.saveRemoteSettings],
  );
  const publicKey = contact.publicKey;
  const name = contactLabel(contact);
  const bodyRef = useRef<CliConsoleBodyHandle | null>(null);
  // Info lines land in the console's transcript when it is open (as today's console).
  const log = useCallback((text: string) => bodyRef.current?.appendInfo(text), []);
  const session = useMeshCoreRemoteSession({ publicKey, contactName: name, actions, log });
  const settings = useRemoteRepeaterSettings(publicKey, actions);

  const status = meshCore.status;
  const notOnDevice = contact.onDevice === false;
  const blocked = receiveOnly
    ? t('meshcore.receive_only.control_tooltip')
    : notOnDevice
      ? t('meshcore.not_on_device.control_tooltip')
      : !status?.connected
        ? t('source.status_disconnected')
        : (status.deviceType ?? 0) !== 1
          ? t('workspace.meshcore.companion_only')
          : null;
  const isRepeater = contact.advType === 2;
  const pathHops = typeof contact.pathLen === 'number' && contact.pathLen >= 0 ? contact.pathLen : null;
  const scope = [
    t(isRepeater ? 'workspace.meshcore.remote.kind_repeater' : 'workspace.meshcore.remote.kind_room'),
    name,
    `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}`,
    pathHops === 0
      ? t('workspace.meshcore.remote.direct')
      : pathHops !== null
        ? t('node_details.hops', { count: pathHops })
        : t('workspace.meshcore.remote.path_unknown'),
    ...(typeof contact.snr === 'number' ? [t('workspace.meshcore.remote.snr', { snr: contact.snr })] : []),
  ].join(' · ');

  const radio = useMemo(
    () => ({ sf: status?.localNode?.radioSf, bw: status?.localNode?.radioBw, cr: status?.localNode?.radioCr }),
    [status?.localNode?.radioSf, status?.localNode?.radioBw, status?.localNode?.radioCr],
  );
  // The settings draft lives here, so Settings → Console → Settings keeps it (GR).
  const numbers = useNumberInputScope();
  const draft = useRepeaterSettingsDraft({
    values: settings.values,
    firmwareVersion: settings.firmware,
    radio,
    canWrite: !blocked,
    disabled: !!blocked,
    onSave: settings.save,
    mode: 'remote',
    deviceType: isRepeater ? 'repeater' : 'room',
    loadedGroups: settings.loadedGroups,
    numbers,
  });
  const stats = useRemoteStats(publicKey, actions.getRemoteStatus, receiveOnly);

  // What the draft would send, by today's labels: the leave guard and the picker ask before dropping it.
  const settingsBase = `/source/${encodeURIComponent(sourceId)}/settings`;
  const changes = Object.keys(draft.changed).map((k) => {
    const [key, fallback] = SETTING_LABELS[k as keyof typeof SETTING_LABELS] ?? [k, k];
    return t(key, fallback);
  });
  const unsentTitle = `${t('meshcore.repeater.remote_title')} · ${name}`;
  const unsentKey = JSON.stringify(changes);
  useEffect(() => {
    const list = JSON.parse(unsentKey) as string[];
    updateRemote(sourceId, { unsent: list.length ? [{ key: 'node-settings', title: unsentTitle, changes: list }] : [] });
  }, [sourceId, unsentKey, unsentTitle]);
  // The settings list's Session line (8-06).
  const sessionStatus = session.loggedIn
    ? [t('workspace.meshcore.remote.logged_in'), ...(session.session?.isAdmin ? [t('workspace.meshcore.remote.as_admin')] : [])].join(' · ')
    : session.canResume
      ? t('meshcore.remoteConsole.session_saved')
      : t('meshcore.remoteConsole.not_logged_in', 'Not logged in');
  useEffect(() => {
    updateRemote(sourceId, { session: { loggedIn: session.loggedIn, status: sessionStatus } });
  }, [sourceId, session.loggedIn, sessionStatus]);
  // Leaving drops the line; the frame may already have forgotten the target.
  useEffect(() => () => {
    if (remoteEntry(sourceId).node) updateRemote(sourceId, { session: null, unsent: [] });
  }, [sourceId]);

  const value: MeshCoreTarget = {
    contact,
    publicKey,
    name,
    isRepeater,
    scope,
    actions,
    session,
    settings,
    bodyRef,
    receiveOnly,
    blocked,
    pathHops,
    radio,
    draft,
    numbers,
    stats,
  };
  return (
    <TargetContext.Provider value={value}>
      {children}
      <LeaveGuard
        base={settingsBase}
        pending={
          changes.length > 0
            ? { scope: settingsBase, title: unsentTitle, changes, discard: draft.handleDiscard }
            : null
        }
      />
    </TargetContext.Provider>
  );
}
