/**
 * The remote target's access list (board 8-07 "Manage access list"; 8-25's
 * Access list row opens it in a sheet): today's MeshCoreAclManager form on
 * the Workspace card. A public key (exactly 64 hex, today's check) and a
 * level (today's four), one `setperm <key> <level>` per Apply through today's
 * route (its server guard and history); the reply shows under the form, and
 * the key clears after each Apply as today. Today has no list of the keys
 * the node holds (`get acl` is serial-only), so none is drawn.
 */
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAclKey, PERMISSION_LEVELS } from '../../../components/MeshCore/meshcoreAclLevels';
import SendsLine from '../../patterns/SendsLine';
import type { MeshCoreTarget } from './remoteTarget';
import styles from './McRemote.module.css';

export default function AclManager({ target, disabled, heading = true }: { target: MeshCoreTarget; disabled: boolean; heading?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const [key, setKey] = useState('');
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const normalized = key.trim().toLowerCase();
  const valid = isAclKey(normalized);
  const title = t('meshcore.acl.title', 'Manage access list');

  const apply = async () => {
    if (!valid || disabled || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await target.actions.sendCliCommand(target.publicKey, `setperm ${normalized} ${level}`);
      setResult(r.ok ? { ok: true, text: r.reply || '(empty reply)' } : { ok: false, text: r.error });
      setKey('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.group} aria-labelledby={heading ? `${id}-title` : undefined} aria-label={heading ? undefined : title}>
      {heading && <h2 className={styles.groupTitle} id={`${id}-title`}>{title}</h2>}
      <div className={styles.aclCard}>
        <p className={styles.note}>
          {t('meshcore.acl.hint', 'Grant or revoke admin / guest access for a specific public key. Translates to a `setperm` command.')}
        </p>
        <div className={styles.aclRow}>
          <label className={styles.label} htmlFor={`${id}-key`}>{t('meshcore.acl.pubkey_label', 'Public key (64 hex)')}</label>
          <input
            id={`${id}-key`}
            type="text"
            className={`${styles.input} ${styles.mono}`}
            placeholder={t('meshcore.acl.pubkey_label', 'Public key (64 hex)')}
            value={key}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={(key.length > 0 && !valid) || undefined}
            disabled={disabled || busy}
            onChange={(e) => setKey(e.target.value)}
          />
          <label className={styles.field}>
            <span className={styles.label}>{t('meshcore.acl.level_label', 'Permission level')}</span>
            <select className={styles.input} value={level} disabled={disabled || busy} onChange={(e) => setLevel(Number(e.target.value))}>
              {PERMISSION_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{t(`meshcore.acl.level.${l.key}`, l.defaultLabel)}</option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.button} disabled={disabled || busy || !valid} onClick={() => void apply()}>
            {busy ? t('meshcore.acl.applying', 'Applying…') : t('meshcore.acl.apply', 'Apply')}
          </button>
        </div>
        {key.length > 0 && !valid && <p className={styles.error}>{t('meshcore.acl.pubkey_invalid', 'Must be exactly 64 hex characters')}</p>}
        {result && (
          <p className={result.ok ? styles.note : styles.error} role={result.ok ? 'status' : 'alert'}>
            {result.text}
          </p>
        )}
        <SendsLine>{t('workspace.meshcore.remote.sends_acl', { name: target.name })}</SendsLine>
      </div>
    </section>
  );
}
