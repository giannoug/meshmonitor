/**
 * The remote target's access list (board 8-07 "Manage access list"; 8-25's
 * Access list opens it in a sheet): today's MeshCoreAclManager form (a public
 * key and a level, one `setperm` per Apply). Today it runs the command in the
 * console's transcript; here the reply shows under the form, and the command
 * goes through the same route (today's server guard and history).
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CliConsoleBodyHandle } from '../../../components/MeshCore/CliConsoleBody';
import { MeshCoreAclManager } from '../../../components/MeshCore/MeshCoreAclManager';
import SendsLine from '../../patterns/SendsLine';
import type { MeshCoreTarget } from './remoteTarget';
import styles from './McRemote.module.css';

export default function AclManager({ target, disabled }: { target: MeshCoreTarget; disabled: boolean }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // MeshCoreAclManager sends through a console handle; this one runs the command and keeps its reply.
  const handle = useRef<CliConsoleBodyHandle | null>(null);
  handle.current = {
    appendInfo: () => {},
    clear: () => setResult(null),
    runCommand: async (command) => {
      setResult(null);
      const r = await target.actions.sendCliCommand(target.publicKey, command);
      setResult(r.ok ? { ok: true, text: r.reply || '(empty reply)' } : { ok: false, text: r.error });
    },
  };
  return (
    <div className={styles.acl}>
      <MeshCoreAclManager bodyRef={handle} disabled={disabled} />
      {result && (
        <p className={result.ok ? styles.note : styles.error} role={result.ok ? 'status' : 'alert'}>
          {result.text}
        </p>
      )}
      <SendsLine>{t('workspace.meshcore.remote.sends_acl', { name: target.name })}</SendsLine>
    </div>
  );
}
