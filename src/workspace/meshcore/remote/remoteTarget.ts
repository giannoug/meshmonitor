/** A MeshCore remote target (Task 7.3): what its pages read (MeshCoreTargetProvider fills it). */
import { createContext, useContext } from 'react';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import type { CliConsoleBodyHandle } from '../../../components/MeshCore/CliConsoleBody';
import type { MeshCoreRemoteSession } from '../../../components/MeshCore/hooks/useMeshCoreRemoteSession';
import type { useRemoteRepeaterSettings } from '../../../components/MeshCore/hooks/useRemoteRepeaterSettings';
import type { MeshCoreActions } from '../../../components/MeshCore/hooks/useMeshCore';

export type RemoteActions = Pick<
  MeshCoreActions,
  | 'loginRemote'
  | 'loginRemoteWithSaved'
  | 'getLoginProgress'
  | 'cancelLogin'
  | 'sendCliCommand'
  | 'getRemoteAdminCapability'
  | 'forgetRemoteCredential'
  | 'getRemoteStatus'
  | 'getRemoteAdminSession'
  | 'logoutRemote'
  | 'readRemoteSettings'
  | 'saveRemoteSettings'
>;

export interface MeshCoreTarget {
  contact: MeshCoreContact;
  publicKey: string;
  name: string;
  isRepeater: boolean;
  /** "Remote repeater · Lycabettus Repeater · 3fa1…9c02 · direct · SNR 6.5 dB". */
  scope: string;
  actions: RemoteActions;
  session: MeshCoreRemoteSession;
  settings: ReturnType<typeof useRemoteRepeaterSettings>;
  bodyRef: React.MutableRefObject<CliConsoleBodyHandle | null>;
  receiveOnly: boolean;
  /** Why the radio cannot address the node now, or null. */
  blocked: string | null;
  /** Hops to the node, or null when no path is known. */
  pathHops: number | null;
  radio: { sf?: number; bw?: number; cr?: number };
}

/** Repeaters (2) and room servers (3): the contacts today's remote console logs in to. */
export const isRemoteTarget = (c: MeshCoreContact) => (c.advType === 2 || c.advType === 3) && !c.isLocal;

/** Today's contact label (MeshCoreContactDetailPanel). */
export const contactLabel = (c: MeshCoreContact) => c.advName || c.name || `${c.publicKey.substring(0, 8)}…`;

export const TargetContext = createContext<MeshCoreTarget | null>(null);

export function useMeshCoreTarget(): MeshCoreTarget | null {
  return useContext(TargetContext);
}

