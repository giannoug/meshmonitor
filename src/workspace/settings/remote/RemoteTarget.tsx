/**
 * The frame's remote target (Task 5.9): while a remote node is picked, the
 * device's pages read and edit that node's values instead of this radio's.
 * It provides, for the one node:
 *
 * - its own values (Ruling DG) and a save queue over them, whose Save is
 *   "Send to node": one admin command per changed category, one after another
 *   (useRadioSaveQueue's saveAll), through today's `sendAdminCommand`;
 * - Security's confirms before its send: today's "Save security config to
 *   <node>?" first, then the frame's own checks (securitySaveGuard);
 * - `useRemoteTarget()` for the pages.
 *
 * It is keyed by the node, so picking another node, or This radio, drops what
 * was read.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import { useDeviceConfigState } from '../../../hooks/deviceConfig/useDeviceConfigState';
import type { ConfigSaveSection, DeviceConfigSaves } from '../../../hooks/deviceConfig/useDeviceConfigSaves';
import { useTxStatus } from '../../../hooks/useTxStatus';
import { appBasename } from '../../../init';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import { CATEGORIES, categoryById } from '../categories';
import RadioSaveBar from '../RadioSaveBar';
import { DeviceConfigContext } from '../sharedDeviceConfig';
import { useSecuritySaveGuard } from '../securitySaveGuard';
import { RadioSaveQueueContext, useRadioSaveQueue, useRadioSaveQueueState, type RadioSaveQueue } from '../useRadioSaveQueue';
import { REMOTE_READS } from './remoteConfig';
import { updateRemote, type RemoteNode } from './remoteTargetStore';
import { RemoteTargetContext, useRemoteTargetState, useSetRemoteTarget, type RemoteTargetApi } from './useRemoteTarget';
import pages from '../categories/SettingsPages.module.css';

/** The sections a remote target sends, by category. */
const SENT = CATEGORIES.filter((c) => c.saveSection && REMOTE_READS[c.id]).map((c) => [c.saveSection!, c.id] as const);

const REMOTE_EXTRA: readonly ConfigSaveSection[] = ['mqtt'];

const runNow = <T,>(fn: () => Promise<T>) => fn();

export interface RemoteTargetProps {
  sourceId: string;
  node: RemoteNode;
  /** The nodes the picker offers, to switch from here. */
  nodes: RemoteNode[];
  /** The open page saves through the queue: show the bar even with nothing queued ("No changes yet"). */
  showBar: boolean;
  /** The frame's leave guard, rendered over this node's queue. */
  guard: ReactNode;
  children: ReactNode;
}

export default function RemoteTarget({ sourceId, node, nodes, showBar, guard, children }: RemoteTargetProps) {
  const { t } = useTranslation();
  const state = useDeviceConfigState(sourceId, 0, { load: false });
  const numbers = useNumberInputScope();
  const api = useRef<RemoteTargetApi | null>(null);
  const label = `${node.longName || node.shortName || node.nodeId} (${node.nodeId})`;
  const security = useSecuritySaveGuard(state, { label, shortName: node.shortName, fallbackWord: node.nodeId });
  // Today's first confirm before a security save to a remote node (today's browser confirm there).
  const [overwrite, setOverwrite] = useState<((ok: boolean) => void) | null>(null);
  const askOverwrite = () => new Promise<boolean>((resolve) => setOverwrite(() => resolve));
  const answer = (ok: boolean) => {
    overwrite?.(ok);
    setOverwrite(null);
  };

  const saves = useMemo(() => {
    const send = (id: string) => async () => {
      try {
        await api.current!.sendCategory(id);
        return true;
      } catch {
        return false;
      }
    };
    // Only what a remote node takes; the pages that call anything else are not offered on a remote target.
    return Object.fromEntries(SENT.map(([section, id]) => [section, send(id)])) as unknown as DeviceConfigSaves;
  }, []);
  // What today's Admin Commands knows of the node without asking (I1): no module is locked as
  // unsupported (today locks one only when its load fails, and a failed read shows no rows here),
  // and the firmware the node row holds names the restart rules and Protection Level until a read does.
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    state.setSupportedModules({ statusmessage: true, trafficManagement: true, meshBeacon: true, takConfig: true });
    if (node.firmwareVersion) state.setLocalFirmwareVersion(node.firmwareVersion);
  }
  const queue = useRadioSaveQueueState(
    { state, saves },
    {
      numberScope: numbers,
      runBatch: runNow,
      guards: { security: async () => (await askOverwrite()) && security.guard() } as Partial<Record<ConfigSaveSection, () => Promise<boolean>>>,
      // A remote node's MQTT goes out with Send to node too.
      extraSections: REMOTE_EXTRA,
    },
  );
  // Read once when the node is picked (no timer of its own: Ruling N); the shell's own reads refresh it.
  const { isTxDisabled } = useTxStatus({ baseUrl: appBasename, sourceId, refetchInterval: 0 });
  const setTarget = useSetRemoteTarget(sourceId, nodes);
  // The leave guard lists this radio's queued edits beside the node's, so neither is lost on leaving (I3).
  const local = useRadioSaveQueue();
  const named = queue.queue.map((e) => ({ ...e, where: `${t(categoryById(e.categoryId)?.labelKey ?? e.categoryId)} · ${node.longName || node.nodeId}` }));
  const both: RadioSaveQueue = {
    ...queue,
    queue: [...(local?.queue ?? []), ...named],
    discard: (section) => {
      local?.discard(section);
      queue.discard(section);
    },
  };
  // The picker asks before a switch drops the node's edits.
  const unsent = named.map((e) => ({ key: e.section, title: e.where, changes: e.changes.map((c) => c.label) }));
  const unsentKey = JSON.stringify(unsent);
  useEffect(() => {
    updateRemote(sourceId, { unsent: JSON.parse(unsentKey) as typeof unsent });
  }, [sourceId, unsentKey]);
  const remote = useRemoteTargetState({ sourceId, node, nodes, state, blocked: isTxDisabled, setTarget, rebase: queue.rebase });
  api.current = remote;

  const [title, ...body] = t('admin_commands.security_save_confirm', { node: label }).split('\n\n');
  return (
    <DeviceConfigContext.Provider value={{ state, saves }}>
      <RadioSaveQueueContext.Provider value={queue}>
        <RemoteTargetContext.Provider value={remote}>
          <NumberInputScope scope={numbers}>{children}</NumberInputScope>
          {showBar && <RadioSaveBar deviceName={node.longName || node.nodeId} />}
          <RadioSaveQueueContext.Provider value={both}>{guard}</RadioSaveQueueContext.Provider>
          {security.sheets}
          <ConfirmSheet
            open={overwrite !== null}
            title={title}
            body={
              <>
                {body.map((p) => <p key={p} className={pages.para}>{p}</p>)}
                <SendsLine>{t('workspace.settings.remote.sends_admin_packet', { name: node.longName })}</SendsLine>
              </>
            }
            confirmLabel={t('workspace.settings.remote.send')}
            danger
            submitOnEnter={false}
            onConfirm={() => answer(true)}
            onCancel={() => answer(false)}
          />
        </RemoteTargetContext.Provider>
      </RadioSaveQueueContext.Provider>
    </DeviceConfigContext.Provider>
  );
}
