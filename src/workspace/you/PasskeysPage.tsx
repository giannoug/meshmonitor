/**
 * Passkeys (boards r1-you-security, s4-security, 11-11; s11n4), drawn inside
 * Sign-in & security over Classic's `usePasskeys` (Rule X): each passkey with
 * today's hostname, added and last-used lines; Rename in place (64
 * characters, with a counter); Delete behind a ConfirmSheet with today's
 * "Delete this passkey?". The server decides what may go: deleting the last
 * passkey while password sign-in is off is refused with today's LAST_PASSKEY
 * message, and the sheet stays open, as today's inline confirm did.
 * Add a passkey asks for a nickname, then the browser prompt.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NICKNAME_MAX, type usePasskeys } from '../../components/account/usePasskeys';
import ConfirmSheet from '../patterns/ConfirmSheet';
import styles from './YouAccount.module.css';

function formatTime(ms: number | null, never: string): string {
  return ms ? new Date(ms).toLocaleString() : never;
}

interface PasskeysPageProps {
  passkeys: ReturnType<typeof usePasskeys>;
  supported: boolean;
}

export default function PasskeysPage({ passkeys: hook, supported }: PasskeysPageProps) {
  const { t } = useTranslation();
  const { passkeys, busy, add, rename, remove } = hook;
  const [adding, setAdding] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    await add(newNickname, () => {
      setAdding(false);
      setNewNickname('');
    });
  };
  const submitRename = async (e: FormEvent, id: number) => {
    e.preventDefault();
    await rename(id, editNickname, () => setEditingId(null));
  };
  const count = <span className={styles.rowSub}>{t('workspace.you.security.nickname_count', { length: (editingId !== null ? editNickname : newNickname).length, max: NICKNAME_MAX })}</span>;

  return (
    <>
      <p className={styles.intro}>{t('passkey.description')}</p>
      {!supported && <p className={styles.notice}>{t('passkey.unsupported')}</p>}
      <div className={styles.card}>
        {passkeys === null ? (
          <p className={styles.row}>{t('common.loading')}</p>
        ) : passkeys.length === 0 ? (
          <p className={styles.row}>{t('passkey.none')}</p>
        ) : (
          passkeys.map((pk) =>
            editingId === pk.id ? (
              <form key={pk.id} className={`${styles.row} ${styles.form}`} onSubmit={(e) => submitRename(e, pk.id)}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('passkey.rename')}</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={editNickname}
                    maxLength={NICKNAME_MAX}
                    onChange={(e) => setEditNickname(e.target.value)}
                    aria-label={t('passkey.nickname')}
                    disabled={busy}
                    autoFocus
                  />
                </label>
                <span className={styles.rowText}>
                  {count}
                  <span className={styles.rowSub}>{t('passkey.hostname', { host: pk.rpId })}</span>
                </span>
                <span className={styles.actions}>
                  <button type="button" className={styles.btn} onClick={() => setEditingId(null)} disabled={busy}>{t('common.cancel')}</button>
                  <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>{t('common.save')}</button>
                </span>
              </form>
            ) : (
              <div key={pk.id} className={styles.row} data-testid="passkey-row">
                <span className={styles.tile} data-tone="account"><UiIcon name="key" size={18} /></span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{pk.nickname || t('passkey.unnamed')}</span>
                  <span className={styles.rowSub}>
                    {t('passkey.created', { when: formatTime(pk.createdAt, t('passkey.never')) })} · {t('passkey.last_used', { when: formatTime(pk.lastUsedAt, t('passkey.never')) })}
                  </span>
                  <span className={styles.rowSub}>{t('passkey.hostname', { host: pk.rpId })}</span>
                </span>
                <span className={styles.actions}>
                  <button
                    type="button"
                    className={styles.btn}
                    data-variant="quiet"
                    onClick={() => {
                      setEditingId(pk.id);
                      setEditNickname(pk.nickname ?? '');
                    }}
                    disabled={busy}
                  >
                    {t('passkey.rename')}
                  </button>
                  <button type="button" className={styles.btn} data-variant="quiet" onClick={() => setDeleteId(pk.id)} disabled={busy}>
                    {t('passkey.delete')}
                  </button>
                </span>
              </div>
            ),
          )
        )}
        {supported &&
          (adding ? (
            <form className={`${styles.row} ${styles.form}`} onSubmit={submitAdd}>
              <label className={styles.field}>
                <span className={styles.label}>{t('passkey.nickname')}</span>
                <input
                  className={styles.input}
                  type="text"
                  value={newNickname}
                  maxLength={NICKNAME_MAX}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder={t('passkey.nickname_placeholder')}
                  disabled={busy}
                  autoFocus
                />
              </label>
              <span className={styles.rowText}>{count}</span>
              <span className={styles.actions}>
                <button type="button" className={styles.btn} onClick={() => setAdding(false)} disabled={busy}>{t('common.cancel')}</button>
                <button type="submit" className={styles.btn} data-variant="primary" disabled={busy}>
                  {busy ? t('passkey.adding') : t('passkey.continue')}
                </button>
              </span>
            </form>
          ) : (
            <button type="button" className={`${styles.row} ${styles.addRow}`} onClick={() => setAdding(true)} disabled={busy}>
              <span className={styles.tile}><UiIcon name="plus" size={18} /></span>
              <span className={styles.rowTitle}>{t('passkey.add')}</span>
            </button>
          ))}
      </div>

      <ConfirmSheet
        open={deleteId !== null}
        title={t('passkey.delete_confirm')}
        confirmLabel={t('common.delete')}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={async () => {
          if (deleteId !== null) await remove(deleteId, () => setDeleteId(null));
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
