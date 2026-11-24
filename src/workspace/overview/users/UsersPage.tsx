/**
 * Overview › Users (o4, 13-13, 13-18, q4; s13n0, s13n2, s13n4, s13n5, s13n7):
 * admins only, as today. Desktop: the users column, then the user's Account
 * (ManageUser) and Permissions (PermissionMatrix) tabs. Phone: its own header,
 * search and Add User above the list; a user opens the Manage sheet; its
 * Permissions row opens the device chips page (PhonePermissions).
 *
 * Every write is today's request with today's body (UsersTab): create user,
 * admin toggle, password lock, set password, deactivate, permanent delete,
 * per-source and virtual channel permissions, passkeys. Deactivate, Permanently
 * Delete and Remove Admin ask first in a ConfirmSheet. A password lives only in
 * its sheet's state and today's request body. Nothing here transmits on the mesh.
 */
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { logger } from '../../../utils/logger';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ToastContainer';
import { UiIcon } from '../../../components/icons';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import AdminPasskeysDialog from '../../../components/AdminPasskeysDialog';
import type { AdminUser, PermissionSource } from '../../../components/users/userPermissionModel';
import { useIsPhone } from '../../shell/useIsPhone';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import ManageUser from './ManageUser';
import PermissionMatrix from './PermissionMatrix';
import PhonePermissions from './PhonePermissions';
import { usePermissionMatrix } from './usePermissionMatrix';
import styles from './UsersPage.module.css';

type Layer = 'create' | 'password' | 'passkeys' | 'admin' | 'deactivate' | 'delete';

const forbidden = (err: unknown) => !!err && typeof err === 'object' && 'status' in err && err.status === 403;
const displayName = (u: AdminUser) => u.displayName || u.username;

function initials(name: string): string {
  const words = name.split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)).toUpperCase();
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { authStatus, loading } = useAuth();
  if (loading) return <StateView kind="loading" />;
  // Today's gate (UsersTab): admins only.
  if (!authStatus?.user?.isAdmin) {
    return <div className={styles.page}><StateView kind="noPermission" title={t('users.access_denied')} /></div>;
  }
  return <UsersAdmin me={authStatus.user.id} />;
}

function UsersAdmin({ me }: { me: number }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isPhone = useIsPhone();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sources, setSources] = useState<PermissionSource[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<'account' | 'permissions'>('account');
  const [layer, setLayer] = useState<Layer | null>(null);
  const [phonePermissions, setPhonePermissions] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const tabsId = useId();
  const selected = users?.find((u) => u.id === selectedId) ?? null;

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get<{ users: AdminUser[] }>('/api/users');
      setUsers(response.users);
      setLoadFailed(false);
    } catch (err) {
      logger.error('Failed to fetch users:', err);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    api.get<PermissionSource[]>('/api/sources')
      .then((list) => setSources(Array.isArray(list) ? list : []))
      .catch((err) => { logger.debug('Failed to fetch sources:', err); setSources([]); });
  }, [fetchUsers]);

  const patchUser = (id: number, patch: Partial<AdminUser>) =>
    setUsers((prev) => prev && prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  /** A confirmed action: a failure keeps the sheet open with `failure`'s words (ConfirmSheet shows them). */
  const confirmed = (run: () => Promise<void>, failure: (err: unknown) => string) => async () => {
    setBusy(true);
    try {
      await run();
      setLayer(null);
    } catch (err) {
      logger.error('User action failed:', err);
      throw new Error(failure(err), { cause: err });
    } finally {
      setBusy(false);
    }
  };

  const setAdmin = async (user: AdminUser) => {
    await api.put(`/api/users/${user.id}/admin`, { isAdmin: !user.isAdmin });
    await fetchUsers();
    showToast(user.isAdmin ? t('users.admin_removed') : t('users.admin_granted'), 'success');
  };

  const toggleAdmin = (user: AdminUser) => {
    if (user.isAdmin) return setLayer('admin');
    setAdmin(user).catch((err) => {
      logger.error('Failed to update admin status:', err);
      showToast(t('users.failed_admin_status'), 'error');
    });
  };

  const togglePasswordLocked = async (user: AdminUser) => {
    try {
      await api.put(`/api/users/${user.id}`, { passwordLocked: !user.passwordLocked });
      await fetchUsers();
      showToast(user.passwordLocked ? t('users.password_unlocked') : t('users.password_locked'), 'success');
    } catch (err) {
      logger.error('Failed to toggle password lock:', err);
      showToast(t('users.failed_password_lock'), 'error');
    }
  };

  const removeUser = async (user: AdminUser, url: string, done: string) => {
    await api.delete(url);
    await fetchUsers();
    setSelectedId((id) => (id === user.id ? null : id));
    showToast(t(done, { username: user.username }), 'success');
  };

  if (loadFailed && !users) return <div className={styles.page}><StateView kind="error" title={t('users.failed_load')} onRetry={() => void fetchUsers()} /></div>;
  if (!users || !sources) return <div className={styles.page}><StateView kind="loading" title={t('users.loading')} /></div>;

  const meta = (u: AdminUser) =>
    [`@${u.username}`, u.authProvider.toUpperCase(), ...((u.passkeyCount ?? 0) > 0 ? [t('passkey_admin.count', { count: u.passkeyCount })] : [])].join(' · ');
  const q = search.trim().toLowerCase();
  const shown = q ? users.filter((u) => [u.username, u.displayName, u.email].some((v) => v?.toLowerCase().includes(q))) : users;
  const select = (u: AdminUser) => { setSelectedId(u.id); setLayer(null); };

  const list = (
    <ul className={styles.list} aria-label={t('nav.users')}>
      {shown.map((u) => (
        <li key={u.id}>
          <button type="button" className={styles.userRow} aria-current={u.id === selectedId || undefined} onClick={() => select(u)}>
            <span className={styles.avatar} aria-hidden="true">{initials(displayName(u))}</span>
            <span className={styles.userText}>
              <span className={styles.userName}>
                {displayName(u)}
                {/* The space keeps the name a word of its own in the row's accessible name. */}
                {u.isAdmin && ' '}
                {u.isAdmin && (
                  <span role="img" aria-label={t('users.administrator')} className={styles.star}><UiIcon name="favorite" size={15} /></span>
                )}
              </span>
              <span className={styles.userMeta}>{meta(u)}</span>
            </span>
            {!u.isActive && <span className={styles.inactive}>{t('users.inactive')}</span>}
            {isPhone && <UiIcon name="chevronRight" size={18} />}
          </button>
        </li>
      ))}
    </ul>
  );

  const addUser = (
    <button type="button" className={styles.primary} onClick={() => setLayer('create')}>
      <UiIcon name="plus" size={18} />
      {t('users.add_user')}
    </button>
  );

  const manage = selected && (
    <ManageUser
      user={selected}
      me={me}
      phone={isPhone}
      onToggleAdmin={() => toggleAdmin(selected)}
      onTogglePasswordLocked={() => void togglePasswordLocked(selected)}
      onSetPassword={() => setLayer('password')}
      onPasskeys={() => setLayer('passkeys')}
      onDeactivate={() => setLayer('deactivate')}
      onDelete={() => setLayer('delete')}
      onPermissions={isPhone ? () => setPhonePermissions(true) : undefined}
    />
  );

  const layers = (
    <>
      {layer === 'create' && <CreateUserSheet onClose={() => setLayer(null)} onCreated={async () => { setLayer(null); await fetchUsers(); }} />}
      {selected && layer === 'password' && (
        <SetPasswordSheet
          user={selected}
          onClose={() => setLayer(null)}
          // An admin-set password turns password sign-in back on (#5841).
          onDone={() => { patchUser(selected.id, { passwordLoginDisabled: false }); setLayer(null); }}
        />
      )}
      {selected && layer === 'passkeys' && (
        <AdminPasskeysDialog
          userId={selected.id}
          username={selected.username}
          onClose={() => setLayer(null)}
          onChanged={(passkeyCount) => patchUser(selected.id, { passkeyCount })}
        />
      )}
      {selected && (
        <>
          <ConfirmSheet
            submitOnEnter={false}
            open={layer === 'admin'}
            title={t('users.remove_admin')}
            body={t('workspace.users.remove_admin_body', { username: selected.username })}
            confirmLabel={t('users.remove_admin')}
            danger
            busy={busy}
            onConfirm={confirmed(() => setAdmin(selected), () => t('users.failed_admin_status'))}
            onCancel={() => setLayer(null)}
          />
          <ConfirmSheet
            submitOnEnter={false}
            open={layer === 'deactivate'}
            title={t('users.deactivate_confirm')}
            body={
              <>
                <p><Trans i18nKey="users.deactivate_confirm_text" values={{ username: selected.username }} components={{ strong: <strong /> }} /></p>
                <p className={styles.warning}>{t('users.deactivate_warning')}</p>
              </>
            }
            confirmLabel={t('users.deactivate_user')}
            danger
            busy={busy}
            onConfirm={confirmed(
              () => removeUser(selected, `/api/users/${selected.id}`, 'users.user_deactivated'),
              (err) => t(forbidden(err) ? 'users.insufficient_permissions_deactivate' : 'users.failed_deactivate'),
            )}
            onCancel={() => setLayer(null)}
          />
          <ConfirmSheet
            submitOnEnter={false}
            open={layer === 'delete'}
            title={t('users.permanent_delete_confirm')}
            body={
              <>
                <p><Trans i18nKey="users.permanent_delete_confirm_text" values={{ username: selected.username }} components={{ strong: <strong /> }} /></p>
                <p className={styles.warning}>{t('users.permanent_delete_warning')}</p>
                <p>{t('users.permanent_delete_details')}</p>
              </>
            }
            confirmLabel={t('users.permanently_delete')}
            danger
            busy={busy}
            onConfirm={confirmed(
              () => removeUser(selected, `/api/users/${selected.id}/permanent`, 'users.user_permanently_deleted'),
              (err) => (err instanceof Error && err.message ? err.message : t(forbidden(err) ? 'users.insufficient_permissions_delete' : 'users.failed_permanent_delete')),
            )}
            onCancel={() => setLayer(null)}
          />
        </>
      )}
    </>
  );

  if (isPhone) {
    if (selected && phonePermissions) {
      return <PhoneMatrix user={selected} sources={sources} onBack={() => { setPhonePermissions(false); setSelectedId(null); }} />;
    }
    const inactive = users.filter((u) => !u.isActive).length;
    return (
      <div className={styles.phonePage}>
        <header className={styles.phoneHead}>
          <Link to="/overview" className={styles.back}>
            <UiIcon name="back" size={20} />
            {t('workspace.shell.overview')}
          </Link>
          <h1 className={styles.phoneTitle}>{t('users.title')}</h1>
          <span />
        </header>
        <p className={styles.scope}>
          <UiIcon name="users" size={18} />
          {t('workspace.users.summary', { count: users.length, inactive })}
        </p>
        <div className={styles.phoneBar}>
          <input
            type="search"
            className={styles.search}
            aria-label={t('workspace.users.search')}
            placeholder={t('workspace.users.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {addUser}
        </div>
        {list}
        {/* Escape closes only the top layer (Ruling CR): a confirm, the password sheet or the passkeys dialog first. */}
        <Sheet open={!!selected} onClose={() => (layer ? setLayer(null) : setSelectedId(null))} title={selected ? displayName(selected) : ''}>
          {manage}
        </Sheet>
        {layers}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <aside className={styles.listCol}>
        <div className={styles.listHead}>
          <h1 className={styles.title}>{t('users.title')}</h1>
          {addUser}
        </div>
        {list}
      </aside>
      <section className={styles.detail}>
        {selected ? (
          <>
            <header className={styles.userHead}>
              <span className={styles.avatarLarge} aria-hidden="true">{initials(displayName(selected))}</span>
              <span className={styles.userText}>
                <h2 className={styles.userTitle}>{displayName(selected)}</h2>
                <span className={styles.userMeta}>{meta(selected)}</span>
              </span>
            </header>
            <div className={styles.tabs} role="tablist" aria-label={displayName(selected)}>
              {(['account', 'permissions'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`${tabsId}-${k}`}
                  aria-selected={tab === k}
                  aria-controls={`${tabsId}-panel`}
                  className={styles.tab}
                  onClick={() => setTab(k)}
                >
                  {k === 'account' ? t('workspace.users.account') : t('users.permissions')}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} className={styles.panel}>
              {tab === 'account' ? manage : <DesktopMatrix user={selected} sources={sources} />}
            </div>
          </>
        ) : (
          <StateView kind="empty" title={t('workspace.users.pick')} />
        )}
      </section>
      {layers}
    </div>
  );
}

function DesktopMatrix({ user, sources }: { user: AdminUser; sources: PermissionSource[] }) {
  return <PermissionMatrix model={usePermissionMatrix(user, sources)} sources={sources} />;
}

function PhoneMatrix({ user, sources, onBack }: { user: AdminUser; sources: PermissionSource[]; onBack(): void }) {
  return <PhonePermissions user={user} sources={sources} model={usePermissionMatrix(user, sources)} onBack={onBack} />;
}

/** Today's Set Password form: both fields, at least 8 characters, matching; the value goes only into the request body. */
function SetPasswordSheet({ user, onClose, onDone }: { user: AdminUser; onClose(): void; onDone(): void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = useId();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.newPassword || !form.confirmPassword) return setError(t('users.password_fields_required'));
    if (form.newPassword.length < 8) return setError(t('users.password_min_length'));
    if (form.newPassword !== form.confirmPassword) return setError(t('users.passwords_not_match'));
    try {
      await api.post(`/api/users/${user.id}/set-password`, { newPassword: form.newPassword });
      showToast(t('users.password_updated'), 'success');
      onDone();
    } catch (err) {
      logger.error('Failed to set password');
      const message = err instanceof Error && err.message ? err.message : t('users.failed_set_password');
      showToast(forbidden(err) ? t('users.insufficient_permissions_password') : message, 'error');
      setError(message);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('users.set_password_for', { username: user.username })}
      footer={
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form={id} className={styles.primary} disabled={!form.newPassword || !form.confirmPassword}>
            {t('users.set_password')}
          </button>
        </div>
      }
    >
      <form id={id} className={styles.form} onSubmit={(e) => void submit(e)}>
        <label htmlFor={`${id}-new`}>{t('users.new_password')} *</label>
        <PasswordField
          id={`${id}-new`}
          className={styles.input}
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          placeholder={t('users.at_least_8_chars')}
          autoComplete="new-password"
          minLength={8}
        />
        <label htmlFor={`${id}-confirm`}>{t('users.confirm_password')} *</label>
        <PasswordField
          id={`${id}-confirm`}
          className={styles.input}
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder={t('users.reenter_password')}
          autoComplete="new-password"
          minLength={8}
        />
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

/** Today's Create New User form: username, password (8+), display name, email, administrator. */
function CreateUserSheet({ onClose, onCreated }: { onClose(): void; onCreated(): Promise<void> }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const id = useId();
  const [form, setForm] = useState({ username: '', password: '', email: '', displayName: '', isAdmin: false });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.username || !form.password) return setError(t('users.username_password_required'));
    if (form.password.length < 8) return setError(t('users.password_min_length'));
    try {
      await api.post('/api/users', form);
      await onCreated();
      showToast(t('users.user_created'), 'success');
    } catch (err) {
      logger.error('Failed to create user');
      setError(err instanceof Error && err.message ? err.message : t('users.failed_create'));
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('users.create_new_user')}
      footer={
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" form={id} className={styles.primary}>{t('users.create_user')}</button>
        </div>
      }
    >
      <form id={id} className={styles.form} onSubmit={(e) => void submit(e)}>
        <label htmlFor={`${id}-username`}>{t('users.username_label')} *</label>
        <input id={`${id}-username`} className={styles.input} type="text" value={form.username} placeholder="username"
          onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <label htmlFor={`${id}-password`}>{t('users.password_label')} *</label>
        <PasswordField id={`${id}-password`} className={styles.input} value={form.password} placeholder={t('users.at_least_8_chars')}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <label htmlFor={`${id}-display`}>{t('users.display_name')}</label>
        <input id={`${id}-display`} className={styles.input} type="text" value={form.displayName} placeholder={t('users.full_name')}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <label htmlFor={`${id}-email`}>{t('users.email')}</label>
        <input id={`${id}-email`} className={styles.input} type="email" value={form.email} placeholder="user@example.com"
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className={styles.check}>
          <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} />
          {t('users.administrator')}
        </label>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}
