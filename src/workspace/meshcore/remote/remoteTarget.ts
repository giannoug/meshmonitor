/** A MeshCore remote target (Task 7.3): what its pages read (MeshCoreTargetProvider fills it). */
import { createContext, useContext } from 'react';
import type { TFunction } from 'i18next';
import { getRepeaterSettingDef, type RepeaterSettingValue } from '../../../utils/meshcoreRepeaterSettings';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import type { CliConsoleBodyHandle } from '../../../components/MeshCore/CliConsoleBody';
import type { MeshCoreRemoteSession } from '../../../components/MeshCore/hooks/useMeshCoreRemoteSession';
import type { useRemoteRepeaterSettings } from '../../../components/MeshCore/hooks/useRemoteRepeaterSettings';
import type { MeshCoreActions } from '../../../components/MeshCore/hooks/useMeshCore';
import type { useRepeaterSettingsDraft, DraftKey } from '../../../components/MeshCore/hooks/useRepeaterSettingsDraft';
import type { useRemoteStats } from '../../../components/MeshCore/hooks/useRemoteStats';
import type { NumberInputScopeHandle } from '../../../components/common/numberInputScopeContext';

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
  /** The settings draft (today's form logic), kept for the node across its pages. */
  draft: ReturnType<typeof useRepeaterSettingsDraft>;
  /** The draft's number fields: an invalid one holds Send to node. */
  numbers: NumberInputScopeHandle;
  /** Remote node status, fetched only by Fetch stats. */
  stats: ReturnType<typeof useRemoteStats>;
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


/** Today's label of each remote setting (meshcore.repeater.*), for the rows, the dock and the leave guard. */
export const SETTING_LABELS: Record<DraftKey | 'guestPassword' | 'adminPassword', readonly [string, string]> = {
  name: ['meshcore.repeater.remote_name', 'Name'],
  lat: ['meshcore.repeater.remote_lat', 'Latitude'],
  lon: ['meshcore.repeater.remote_lon', 'Longitude'],
  txPower: ['meshcore.repeater.remote_tx_power', 'TX power'],
  advertInterval: ['meshcore.repeater.advert_interval', 'Advert interval'],
  floodAdvertInterval: ['meshcore.repeater.flood_advert_interval', 'Flood advert interval'],
  floodMax: ['meshcore.repeater.flood_max', 'Flood hop limit'],
  repeat: ['meshcore.repeater.repeat', 'Repeat (forward packets)'],
  af: ['meshcore.repeater.af', 'Airtime factor'],
  rxDelay: ['meshcore.repeater.rx_delay', 'RX delay'],
  txDelay: ['meshcore.repeater.tx_delay', 'TX delay (flood)'],
  directTxDelay: ['meshcore.repeater.direct_tx_delay', 'TX delay (direct)'],
  allowReadOnly: ['meshcore.repeater.allow_read_only', 'Allow read-only login'],
  guestPassword: ['meshcore.repeater.guest_password', 'Guest password'],
  adminPassword: ['meshcore.repeater.admin_password', 'Admin password'],
};

/** A value as the rows show it: Off, or the number with today's unit. */
export function formatSetting(t: TFunction, key: DraftKey, value: RepeaterSettingValue | undefined): string {
  if (value === undefined) return '—';
  const def = getRepeaterSettingDef(key);
  if (typeof value === 'number' && value === 0 && def?.offAllowed) return t('meshcore.repeater.off', 'Off');
  return def?.unit && typeof value === 'number' ? `${value} ${def.unit}` : String(value);
}

