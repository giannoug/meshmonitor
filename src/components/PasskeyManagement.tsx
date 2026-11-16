/**
 * Passkey management for the signed-in local user (#5841): list, add, rename,
 * delete. Shown from the user menu next to two-factor auth.
 *
 * Below the list, the passkey-only switch and its recovery codes (PR 3).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from './icons';
import { passkeysSupported } from '../services/passkeyClient';
import { NICKNAME_MAX, usePasskeys } from './account/usePasskeys';
import PasswordLoginControl from './PasswordLoginControl';
import styles from './PasskeyManagement.module.css';

function formatTime(ms: number | null, never: string): string {
  return ms ? new Date(ms).toLocaleString() : never;
}

interface PasskeyManagementProps {
  /** False when a surrounding dialog already shows the "Passkeys" title. */
  showHeading?: boolean;
}

const PasskeyManagement: React.FC<PasskeyManagementProps> = ({ showHeading = true }) => {
  const { t } = useTranslation();
  const supported = passkeysSupported();

  const { passkeys, busy, add, rename, remove } = usePasskeys();
  const [adding, setAdding] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await add(newNickname, () => {
      setAdding(false);
      setNewNickname('');
    });
  };

  const handleRename = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    await rename(id, editNickname, () => setEditingId(null));
  };

  const handleDelete = async (id: number) => {
    await remove(id, () => setConfirmDeleteId(null));
  };

  return (
    <section
      className={styles.section}
      aria-labelledby={showHeading ? 'passkey-heading' : undefined}
      aria-label={showHeading ? undefined : t('passkey.title')}
    >
      {showHeading && (
        <h3 id="passkey-heading" className={styles.heading}>
          <UiIcon name="key" size={18} />
          {t('passkey.title')}
        </h3>
      )}
      <p className={styles.description}>{t('passkey.description')}</p>

      {!supported && <p className={styles.unsupported}>{t('passkey.unsupported')}</p>}

      {passkeys === null ? (
        <p className={styles.muted}>{t('common.loading')}</p>
      ) : passkeys.length === 0 ? (
        <p className={styles.muted}>{t('passkey.none')}</p>
      ) : (
        <ul className={styles.list}>
          {passkeys.map((pk) => (
            <li key={pk.id} className={styles.item} data-testid="passkey-item">
              {editingId === pk.id ? (
                <form className={styles.inlineForm} onSubmit={(e) => handleRename(e, pk.id)}>
                  <input
                    type="text"
                    value={editNickname}
                    maxLength={NICKNAME_MAX}
                    onChange={(e) => setEditNickname(e.target.value)}
                    aria-label={t('passkey.nickname')}
                    disabled={busy}
                    autoFocus
                  />
                  <button type="submit" className="button button-primary" disabled={busy}>
                    {t('common.save')}
                  </button>
                  <button type="button" className="button" onClick={() => setEditingId(null)} disabled={busy}>
                    {t('common.cancel')}
                  </button>
                </form>
              ) : (
                <div className={styles.itemMain}>
                  <div className={styles.name}>{pk.nickname || t('passkey.unnamed')}</div>
                  <div className={styles.meta}>
                    <span>{t('passkey.hostname', { host: pk.rpId })}</span>
                    <span>{t('passkey.created', { when: formatTime(pk.createdAt, t('passkey.never')) })}</span>
                    <span>{t('passkey.last_used', { when: formatTime(pk.lastUsedAt, t('passkey.never')) })}</span>
                  </div>
                </div>
              )}

              {editingId !== pk.id && (
                confirmDeleteId === pk.id ? (
                  <div className={styles.actions}>
                    <span className={styles.confirmText}>{t('passkey.delete_confirm')}</span>
                    <button
                      type="button"
                      className={`button ${styles.danger}`}
                      onClick={() => handleDelete(pk.id)}
                      disabled={busy}
                    >
                      {t('common.delete')}
                    </button>
                    <button type="button" className="button" onClick={() => setConfirmDeleteId(null)} disabled={busy}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => {
                        setEditingId(pk.id);
                        setEditNickname(pk.nickname ?? '');
                        setConfirmDeleteId(null);
                      }}
                      disabled={busy}
                      aria-label={t('passkey.rename')}
                      title={t('passkey.rename')}
                    >
                      <UiIcon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => {
                        setConfirmDeleteId(pk.id);
                        setEditingId(null);
                      }}
                      disabled={busy}
                      aria-label={t('passkey.delete')}
                      title={t('passkey.delete')}
                    >
                      <UiIcon name="delete" size={16} />
                    </button>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {supported && (
        adding ? (
          <form className={styles.inlineForm} onSubmit={handleAdd}>
            <input
              type="text"
              value={newNickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder={t('passkey.nickname_placeholder')}
              aria-label={t('passkey.nickname')}
              disabled={busy}
              autoFocus
            />
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? t('passkey.adding') : t('passkey.continue')}
            </button>
            <button type="button" className="button" onClick={() => setAdding(false)} disabled={busy}>
              {t('common.cancel')}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className={`button button-primary ${styles.addButton}`}
            onClick={() => setAdding(true)}
            disabled={busy}
          >
            <UiIcon name="plus" size={16} />
            {t('passkey.add')}
          </button>
        )
      )}

      {passkeys !== null && (
        <PasswordLoginControl passkeyCount={passkeys.length} supported={supported} />
      )}
    </section>
  );
};

export default PasskeyManagement;
