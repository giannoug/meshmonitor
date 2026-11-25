/**
 * The actions a region feed's runtime holds: it has no radio, so every one
 * refuses. MeshCoreNodesTable (feed) calls none of them; typed against the real
 * actions so a new action fails the build here rather than being missing at runtime.
 */
import type { MeshCoreActions } from '../../components/MeshCore/hooks/useMeshCore';

const unavailable = (): Promise<never> => Promise.reject(new Error('A region feed has no radio.'));

export const READ_ONLY_ACTIONS: MeshCoreActions = {
  connect: unavailable, disconnect: unavailable, refreshContacts: unavailable, resetContactPath: unavailable,
  shareContact: unavailable, setContactOutPath: unavailable, traceContactPath: unavailable,
  pingContactZeroHop: unavailable, discoverContactPath: unavailable, discoverNodes: unavailable,
  getDiscoverable: unavailable, setDiscoverable: unavailable, getDefaultScope: unavailable,
  setDefaultScope: unavailable, getSenderNamePolicy: unavailable, setSenderNamePolicy: unavailable,
  getDefaultPathHashSize: unavailable, setDefaultPathHashSize: unavailable, discoverRegions: unavailable,
  fetchSavedRegions: unavailable, addSavedRegion: unavailable, deleteSavedRegion: unavailable,
  removeContact: unavailable, addContactToDevice: unavailable, setNodeFavorite: unavailable,
  setContactRemoteCli: unavailable, setNodePositionOverride: unavailable, exportContact: unavailable,
  importContact: unavailable, syncDeviceTime: unavailable, getNeighbours: unavailable,
  getRepeaterSettings: unavailable, saveRepeaterSettings: unavailable, readRemoteSettings: unavailable,
  saveRemoteSettings: unavailable, powerOffDevice: unavailable, rebootDevice: unavailable, getBlePin: unavailable,
  setBlePin: unavailable, setMultiAcks: unavailable, factoryReset: unavailable, exportPrivateKey: unavailable,
  importPrivateKey: unavailable, sendAdvert: unavailable, sendMessage: unavailable, sendReaction: unavailable,
  refreshStatus: unavailable, deleteMessage: unavailable, resendMessage: unavailable, clearConversation: unavailable,
  clearChannelMessages: unavailable, purgeAllMessages: unavailable, fetchDmMessages: unavailable,
  fetchDmPeers: unavailable, fetchRoomMessages: unavailable, fetchRoomStats: unavailable, setDeviceName: unavailable,
  setRadioParams: unavailable, setTxPower: unavailable, setCoords: unavailable, setAdvertLocPolicy: unavailable,
  setTelemetryModeBase: unavailable, setTelemetryModeLoc: unavailable, setTelemetryModeEnv: unavailable,
  refreshAll: unavailable, clearError: () => {}, loginRemote: unavailable, sendCliCommand: unavailable,
  getRemoteAdminCapability: unavailable, loginRemoteWithSaved: unavailable, getLoginProgress: unavailable,
  cancelLogin: unavailable, startNeighboursFetch: unavailable, getNeighboursFetchProgress: unavailable,
  cancelNeighboursFetch: unavailable, sendLocalCliCommand: unavailable, forgetRemoteCredential: unavailable,
  getRemoteAdminSession: unavailable, logoutRemote: unavailable, getRemoteStatus: unavailable,
  loginRoom: unavailable, loginRoomWithSaved: unavailable, sendRoomPost: unavailable,
  getRoomCredentials: unavailable, forgetRoomCredential: unavailable, setRoomSyncConfig: unavailable,
  getRoomSyncConfig: unavailable,
};
