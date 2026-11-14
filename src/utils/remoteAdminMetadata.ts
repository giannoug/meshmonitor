/**
 * The device metadata a remote-admin check stored on the node (#5535 era):
 * a JSON string, parsed as NodeDetailsBlock did inline, so the Workspace node
 * page reads the same rows. Malformed JSON gives null.
 */
export interface RemoteAdminMetadata {
  firmwareVersion?: string;
  hasWifi?: boolean;
  hasBluetooth?: boolean;
  hasEthernet?: boolean;
  canShutdown?: boolean;
}

export function parseRemoteAdminMetadata(json: string): RemoteAdminMetadata | null {
  try {
    return JSON.parse(json) as RemoteAdminMetadata | null;
  } catch {
    return null;
  }
}
