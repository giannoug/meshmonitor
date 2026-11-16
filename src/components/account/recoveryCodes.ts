/** Saves passkey recovery codes as a text file (#5841, D2): RecoveryCodesDialog's Download, shared with the Workspace. */
import type { TFunction } from 'i18next';

export function downloadRecoveryCodes(codes: string[], username: string, t: TFunction): void {
  const body = `${t('passkey_only.codes_file_heading', { username })}\n\n${codes.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'meshmonitor-recovery-codes.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
