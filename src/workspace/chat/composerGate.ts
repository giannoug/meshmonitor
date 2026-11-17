/**
 * The one gate for a conversation's composer (channel thread and DM, Task 6.7,
 * note ds7), from the shell's status for the device:
 * - connected: the composer, off only while TX is disabled (today's tooltip);
 * - offline: the composer stays, off, saying sending is paused (history stays);
 * - anything else (no status yet, disabled): no composer, as before.
 * `sendReason` is the same decision for a message row's sends (reply, react,
 * resend): off with that reason, or "Disconnected" while there is no status.
 * Receive-only (MQTT) and guests never reach the composer: they get a ReadOnlyNote.
 */
import type { TFunction } from 'i18next';
import type { WorkspaceSourceStatus } from '../shell/useWorkspaceSources';

export function composerGate(
  t: TFunction,
  status: WorkspaceSourceStatus | undefined,
  deviceName: string,
  txDisabled: boolean,
): { show: boolean; disabledReason?: string; sendReason?: string } {
  if (status === 'offline') {
    const paused = t('workspace.connection.sending_paused', { name: deviceName });
    return { show: true, disabledReason: paused, sendReason: paused };
  }
  if (status !== 'connected') return { show: false, sendReason: t('source.status_disconnected') };
  const tx = txDisabled ? t('tx_disabled.control_tooltip') : undefined;
  return { show: true, disabledReason: tx, sendReason: tx };
}
