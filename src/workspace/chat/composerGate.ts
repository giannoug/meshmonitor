/**
 * The one gate for a conversation's composer (channel thread and DM, Task 6.7,
 * note ds7), from the shell's status for the device:
 * - connected: the composer, off only while TX is disabled (today's tooltip);
 * - offline: the composer stays, off, saying sending is paused (history stays);
 * - anything else (no status yet, disabled): no composer, as before.
 * Receive-only (MQTT) and guests never reach it: they get a ReadOnlyNote.
 */
import type { TFunction } from 'i18next';
import type { WorkspaceSourceStatus } from '../shell/useWorkspaceSources';

export function composerGate(
  t: TFunction,
  status: WorkspaceSourceStatus | undefined,
  deviceName: string,
  txDisabled: boolean,
): { show: boolean; disabledReason?: string } {
  if (status === 'offline') return { show: true, disabledReason: t('workspace.connection.sending_paused', { name: deviceName }) };
  if (status !== 'connected') return { show: false };
  return { show: true, disabledReason: txDisabled ? t('tx_disabled.control_tooltip') : undefined };
}
