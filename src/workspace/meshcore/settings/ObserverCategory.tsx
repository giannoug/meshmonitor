/**
 * Settings › Analyzer Observer (Task 7.4, note s8n4: "brokers, signing key,
 * publisher status"), on the row kit over today's hooks: useObserverConfigDraftState
 * (today's broker draft without its SaveBar, Rule X), useObserverKey,
 * useObserverCredentials, useObserverStatus and the source's live status.
 *
 * - Status: the Publish switch and the publisher's live state.
 * - Brokers: the region code and each broker (label, URL, audience,
 *   authentication, Verify TLS with today's warning), Remove asking first,
 *   Add a broker from today's presets. The switch and the brokers save from
 *   the page's own bar: today's one source update, once per press; the brokers
 *   then reconnect once (today's words). The observer publishes over the
 *   internet only: it sends nothing on the mesh.
 * - Each broker's live status, and a password broker's username and password
 *   (saved or cleared at once, today's requests).
 * - Signing key: the public key, Fetch from device (a serial read), Enter key
 *   manually (masked), Clear stored key asking first. The private key is
 *   never shown, logged or kept here.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { useObserverConfigDraftState } from '../../../components/MeshCore/hooks/useObserverConfigDraft';
import { useObserverCredentials } from '../../../components/MeshCore/hooks/useObserverCredentials';
import { useObserverKey, type ObserverKeyAction } from '../../../components/MeshCore/hooks/useObserverKey';
import { useObserverStatus } from '../../../components/MeshCore/hooks/useObserverStatus';
import { MAX_OBSERVER_BROKERS, OBSERVER_BLOCK_FIELDS, OBSERVER_BROKER_FIELDS, OBSERVER_BROKER_PRESETS } from '../../../components/MeshCore/observerConfig';
import { describeObserverError, isPlausibleHexKey } from '../../../components/MeshCore/observerErrors';
import { useAuth } from '../../../contexts/AuthContext';
import { useSourceStatuses } from '../../../hooks/useDashboardData';
import type { ObserverBrokerStatus } from '../../../services/api';
import { formatRelativeTime } from '../../../utils/datetime';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { Warn } from '../../settings/categories/RowParts';
import { McDock, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

interface ObserverLive {
  configured: boolean;
  authMode?: 'token' | 'password';
  keyStored: boolean;
  connected: boolean;
  publishes: number;
  dropped: number;
  lastPublishAt: number | null;
  lastError: string | null;
  tokenExpiresAt: number | null;
}

type Confirm = { kind: 'removeBroker'; id: string; name: string } | { kind: 'clearKey' } | { kind: 'clearCreds'; key: string; name: string } | { kind: 'legacy' };

export default function ObserverCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { hasPermission } = useAuth();
  const canRead = hasPermission('configuration', 'read', { sourceId });
  const canWrite = hasPermission('configuration', 'write', { sourceId });
  const canEditBrokers = canWrite && hasPermission('sources', 'write', { sourceId });
  const key = useObserverKey(sourceId, { enabled: canRead });
  const creds = useObserverCredentials(sourceId, { enabled: canRead });
  const observerStatus = useObserverStatus(sourceId, { enabled: canRead });
  const brokers = observerStatus.status?.brokers ?? [];
  const live = (useSourceStatuses([sourceId]).get(sourceId) as { observer?: ObserverLive } | null | undefined)?.observer;
  const draft = useObserverConfigDraftState(sourceId, { canEdit: canEditBrokers });
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ObserverKeyAction | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [addPick, setAddPick] = useState('');

  const showKeyBlock = brokers.length > 0 ? brokers.some((b) => b.authMode !== 'password') : live?.authMode !== 'password';
  const hasPasswordBroker = brokers.some((b) => b.authMode === 'password');
  const legacy = creds.status?.legacy ?? null;
  const rotated = creds.status?.keyRotated === true;
  const status = key.status;
  const publicKey = status?.publicKey ?? null;
  const shortPk = publicKey && publicKey.length > 16 ? `${publicKey.slice(0, 8)}…${publicKey.slice(-8)}` : publicKey ?? '';
  const brokerName = (i: number, label: string) => label || t('meshcore.form.observer_broker_heading', 'Broker {{index}}', { index: i + 1 });

  const saveManual = async () => {
    setLastAction('manual');
    if (!isPlausibleHexKey(manual)) return setManualError(t('meshcore.observer.manual_invalid_length', 'The key must be exactly 128 hex characters (64 bytes).'));
    setManualError(null);
    if (await key.setManualKey(manual)) {
      setManualOpen(false);
      setManual('');
    }
  };

  const brokerCredentials = (b: ObserverBrokerStatus) => {
    if (b.authMode !== 'password') return null;
    const stored = creds.status?.brokers.find((x) => x.brokerKey === b.key) ?? null;
    const error = creds.actionError && creds.actionError.brokerKey === b.key ? describeObserverError(t, creds.actionError.error, null) : null;
    return <BrokerCredentials key={`c-${b.key}`} broker={b} stored={stored?.username ?? null} canWrite={canWrite} canStore={creds.status?.canStore !== false} busy={creds.busy !== null} error={error} onSave={(u, p) => creds.saveCredentials(b.key, u, p)} onClear={() => setConfirm({ kind: 'clearCreds', key: b.key, name: b.label || b.url })} />;
  };

  if (!canRead) return null;
  return (
    <McPage>
      <p className={styles.lead}>
        {t('meshcore.observer.intro', 'Publishes every packet this node hears to MeshCore Analyzer MQTT brokers. MeshMonitor only publishes over the internet: it never receives from a broker or transmits on the mesh.')}
      </p>
      <SettingGroup title={t('meshcore.observer.group_status', 'Status')}>
        <SettingRow id="meshcore.observer.enabled" label={t('meshcore.form.observer_enable', 'Publish heard packets to a MeshCore Analyzer broker')}>
          <SettingToggle checked={draft.draft.enabled} readOnly={!canEditBrokers || !draft.loaded} onChange={draft.setEnabled} />
        </SettingRow>
        {live && (
          <>
            <Fact label={t('meshcore.observer.status_heading', 'Publisher status')}>
              <UiIcon name={live.connected ? 'statusOn' : 'statusOff'} size={14} />{' '}
              {live.connected ? t('meshcore.observer.status_connected', 'Connected to broker') : t('meshcore.observer.status_disconnected', 'Not connected to broker')}
            </Fact>
            {!live.configured && <Warn>{t('meshcore.observer.not_configured', 'Enabled, but the broker URL, region, or audience is missing. Complete it under Brokers below.')}</Warn>}
            {!live.keyStored && (
              <Warn>
                {live.authMode === 'password'
                  ? t('meshcore.observer.no_credentials_running', 'No usable broker username/password — the publisher will not connect. Enter them below.')
                  : t('meshcore.observer.no_key_running', 'No usable signing key — the publisher will not connect. Import or paste one below.')}
              </Warn>
            )}
            <Fact label={t('meshcore.observer.published_count', 'Packets published')}>{live.publishes}</Fact>
            <Fact label={t('meshcore.observer.dropped_count', 'Packets dropped')}>
              {live.dropped}
              {live.dropped > 0 && ` · ${t('meshcore.observer.dropped_help', 'Packets heard while the broker socket was down.')}`}
            </Fact>
            <Fact label={t('meshcore.observer.last_publish', 'Last publish')}>{live.lastPublishAt ? formatRelativeTime(live.lastPublishAt) : t('common.never', 'Never')}</Fact>
            {live.authMode !== 'password' && (
              <Fact label={t('meshcore.observer.token_expires', 'Auth token expires')}>{live.tokenExpiresAt ? new Date(live.tokenExpiresAt * 1000).toLocaleString() : '—'}</Fact>
            )}
            {live.lastError && <Warn tone="danger">{`${t('meshcore.observer.last_error', 'Last error')}: ${live.lastError}`}</Warn>}
          </>
        )}
      </SettingGroup>

      <SettingGroup title={t('meshcore.observer.group_brokers', 'Brokers')}>
        <p className={styles.groupNote}>{t('meshcore.observer.brokers_hint', 'Where the observer publishes. Changes apply when you save; the brokers then reconnect once.')}</p>
        {canWrite && !canEditBrokers && <p className={styles.groupNote}>{t('meshcore.observer.brokers_need_sources_write', 'Changing the broker list also needs permission to edit sources.')}</p>}
        {draft.loaded &&
          OBSERVER_BLOCK_FIELDS.map((f) => (
            <SettingRow key={f.key} id={`meshcore.observer.${f.key}`} label={t(f.labelKey, f.labelFallback)}>
              <SettingText value={draft.draft.iataCode} placeholder={f.placeholder} readOnly={!canEditBrokers} onChange={draft.setIataCode} />
            </SettingRow>
          ))}
        {draft.loaded && draft.draft.brokers.length === 0 && <p className={styles.groupNote}>{t('meshcore.observer.brokers_none', 'No brokers yet. Add one from the presets below.')}</p>}
        {draft.loaded && canEditBrokers && (
          <SettingRow
            id="meshcore.observer.add"
            label={t('meshcore.observer.add_broker', 'Add a broker')}
            help={draft.draft.brokers.length >= MAX_OBSERVER_BROKERS ? t('meshcore.observer.broker_cap', 'At most {{max}} brokers.', { max: MAX_OBSERVER_BROKERS }) : undefined}
          >
            <SettingSelect
              value={addPick}
              readOnly={draft.draft.brokers.length >= MAX_OBSERVER_BROKERS}
              options={[{ value: '', label: t('workspace.meshcore.settings.pick_preset'), disabled: true }, ...OBSERVER_BROKER_PRESETS.map((p) => ({ value: p.id, label: t(p.labelKey, p.labelFallback) }))]}
              onChange={(id) => {
                setAddPick('');
                if (id) draft.addBroker(id);
              }}
            />
          </SettingRow>
        )}
      </SettingGroup>
      {draft.draft.brokers.map((row, i) => {
        const name = brokerName(i, row.label);
        const live = brokers.find((b) => b.url === row.url);
        return (
          <SettingGroup key={row.id} title={name}>
            {OBSERVER_BROKER_FIELDS.filter((f) => f.key !== 'tokenAudience' || row.authMode === 'token').map((f) => (
              <SettingRow key={f.key} id={`meshcore-broker.${row.id}.${f.key}`} label={t(f.labelKey, f.labelFallback)} help={t(f.helpKey, f.helpFallback)}>
                <SettingText value={row[f.key]} placeholder={f.placeholder} readOnly={!canEditBrokers} onChange={(v) => draft.updateBroker(row.id, { [f.key]: v })} />
              </SettingRow>
            ))}
            <SettingRow
              id={`meshcore-broker.${row.id}.auth`}
              label={t('meshcore.form.observer_auth_mode', 'Broker authentication')}
              help={
                row.authMode === 'password'
                  ? t('meshcore.observer.auth_mode_password_help', 'For regional brokers with a fixed MQTT login. Save the broker list, then set its username and password under Credentials.')
                  : t('meshcore.form.observer_auth_mode_token_help', "MeshMonitor signs a token with the node's own key and connects as v1_{PUBLIC_KEY}. The default, and what FL Mesh / LetsMesh brokers expect.")
              }
            >
              <SettingSelect
                value={row.authMode}
                readOnly={!canEditBrokers}
                options={[
                  { value: 'token', label: t('meshcore.form.observer_auth_mode_token', 'Signed token (FL Mesh / LetsMesh)') },
                  { value: 'password', label: t('meshcore.form.observer_auth_mode_password', 'Username / password') },
                ]}
                onChange={(v) => draft.updateBroker(row.id, { authMode: v === 'password' ? 'password' : 'token' })}
              />
            </SettingRow>
            <SettingRow
              id={`meshcore-broker.${row.id}.verifyTls`}
              label={t('meshcore.observer.verify_tls', 'Verify TLS certificate')}
              help={
                <>
                  {t('meshcore.observer.verify_tls_help', 'Applies to wss:// and mqtts:// brokers. Turn off only for a broker with a self-signed certificate.')}
                  {!row.verifyTls && <Warn>{t('meshcore.observer.verify_tls_off_warning', 'Certificate checks are off. Anyone between this server and the broker could read or alter what the observer sends.')}</Warn>}
                </>
              }
            >
              <SettingToggle checked={row.verifyTls} readOnly={!canEditBrokers} onChange={(v) => draft.updateBroker(row.id, { verifyTls: v })} />
            </SettingRow>
            {live && (
              <Fact label={t('meshcore.observer.status_heading', 'Publisher status')}>
                {live.connected ? t('meshcore.observer.status_connected', 'Connected to broker') : t('meshcore.observer.status_disconnected', 'Not connected to broker')}
                {` · ${t('meshcore.observer.published_count', 'Packets published')} ${live.publishes} · ${t('meshcore.observer.last_publish', 'Last publish')} ${live.lastPublishAt ? formatRelativeTime(live.lastPublishAt) : t('common.never', 'Never')}`}
                {live.lastError && ` · ${t('meshcore.observer.last_error', 'Last error')}: ${live.lastError}`}
              </Fact>
            )}
            {live && brokerCredentials(live)}
            {canEditBrokers && (
              <div className={styles.groupNote}>
                <button type="button" className={styles.danger} onClick={() => setConfirm({ kind: 'removeBroker', id: row.id, name })}>
                  {t('meshcore.form.observer_broker_remove', 'Remove broker {{index}}', { index: i + 1 })}
                </button>
              </div>
            )}
          </SettingGroup>
        );
      })}
      {draft.error && <p className={styles.error} role="alert">{draft.error}</p>}

      {showKeyBlock && (
        <SettingGroup title={t('meshcore.observer.key_heading', 'Signing key')}>
          {key.loading && <p className={styles.groupNote}>{t('meshcore.observer.key_loading', 'Checking…')}</p>}
          {!key.loading && key.loadError && <p className={styles.groupNote}><Warn tone="danger">{describeObserverError(t, key.loadError, null)}</Warn></p>}
          {!key.loading && !key.loadError && status?.canStore === false && (
            <p className={styles.groupNote}>
              <Warn>
                {t('meshcore.observer.cannot_store', 'MeshMonitor cannot store the signing key: {{reason}}', { reason: status.reason ?? '' })}{' '}
                {t('meshcore.observer.cannot_store_fix', 'Set a fixed SESSION_SECRET and restart to enable observer key storage.')}
              </Warn>
            </p>
          )}
          {!key.loading && !key.loadError && status?.canStore !== false && status?.stored === false && (
            <p className={styles.groupNote}>{t('meshcore.observer.key_none', 'No signing key stored. The observer cannot authenticate to the broker until you add one.')}</p>
          )}
          {!key.loading && !key.loadError && status?.stored === true && (
            <SettingRow
              id="meshcore-observer.publicKey"
              label={t('meshcore.observer.public_key', 'Node public key')}
              help={
                <>
                  {t('meshcore.observer.public_key_help', "This is the node's public key — safe to share. It is also the broker username and part of the topic path.")}{' '}
                  {`${status.origin === 'manual' ? t('meshcore.observer.origin_manual', 'Entered manually') : t('meshcore.observer.origin_device', 'Read from device')} · ${t('meshcore.observer.key_updated', 'Stored')} ${status.updatedAt ? formatRelativeTime(status.updatedAt) : ''}`}
                  {status.keyRotated && <Warn>{t('meshcore.observer.key_rotated')}</Warn>}
                </>
              }
            >
              <span className={styles.inline}>
                <span className={styles.mono} title={publicKey ?? ''}>{shortPk}</span>
                <button type="button" className={styles.button} onClick={() => void navigator.clipboard?.writeText(publicKey ?? '').catch(() => {})}>
                  <UiIcon name="copy" size={16} /> {t('meshcore.observer.copy_public_key', 'Copy public key')}
                </button>
              </span>
            </SettingRow>
          )}
          {canWrite && (
            <div className={styles.groupNote}>
              <span className={styles.buttons}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!d.connected || key.busy !== null || status?.canStore === false}
                  title={!d.connected ? t('meshcore.observer.fetch_needs_connection', 'Connect to the device first — the key is read over the live link.') : undefined}
                  onClick={() => {
                    setLastAction('import');
                    void key.importFromDevice();
                  }}
                >
                  <UiIcon name="import" size={16} /> {key.busy === 'import' ? t('meshcore.observer.fetching', 'Fetching…') : t('meshcore.observer.fetch_button', 'Fetch from device')}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={key.busy !== null || status?.canStore === false}
                  onClick={() => {
                    setManual('');
                    setManualError(null);
                    key.clearActionError();
                    setManualOpen(true);
                  }}
                >
                  <UiIcon name="key" size={16} /> {t('meshcore.observer.manual_button', 'Enter key manually')}
                </button>
                <button type="button" className={styles.danger} disabled={key.busy !== null || !status?.stored} onClick={() => setConfirm({ kind: 'clearKey' })}>
                  {key.busy === 'clear' ? t('meshcore.observer.clearing', 'Clearing…') : t('meshcore.observer.clear_button', 'Clear stored key')}
                </button>
              </span>
              <SendsLine>{t('workspace.meshcore.settings.sends_observer_key')}</SendsLine>
              {manualOpen && (
                <span className={styles.block}>
                  <label className={styles.field}>
                    <span>{t('meshcore.observer.manual_heading', "Paste the node's 128-character hex private key")}</span>
                    <PasswordField
                      autoComplete="off"
                      className={`${styles.input} ${styles.mono}`}
                      value={manual}
                      placeholder={t('meshcore.observer.manual_placeholder', '128-character hex private key')}
                      disabled={key.busy !== null}
                      onChange={(e) => setManual(e.target.value)}
                    />
                  </label>
                  {manualError && <span className={styles.error} role="alert">{manualError}</span>}
                  <span className={styles.buttons}>
                    <button type="button" className={styles.plain} disabled={key.busy !== null} onClick={() => setManualOpen(false)}>{t('common.cancel', 'Cancel')}</button>
                    <button type="button" className={styles.primary} disabled={key.busy !== null || manual.trim().length === 0} onClick={() => void saveManual()}>
                      {key.busy === 'manual' ? t('meshcore.observer.manual_saving', 'Saving…') : t('meshcore.observer.manual_save', 'Save key')}
                    </button>
                  </span>
                </span>
              )}
              {key.actionError && <span className={styles.error} role="alert">{describeObserverError(t, key.actionError, lastAction)}</span>}
            </div>
          )}
        </SettingGroup>
      )}

      {(creds.loadError || (creds.status?.canStore === false && hasPasswordBroker) || rotated || legacy) && (
        <SettingGroup title={t('meshcore.observer.group_credentials', 'Credentials')}>
          <div className={styles.groupNote}>
            {creds.loadError && <Warn tone="danger">{describeObserverError(t, creds.loadError, null)}</Warn>}
            {creds.status?.canStore === false && hasPasswordBroker && (
              <Warn>{t('meshcore.observer.credentials_cannot_store', 'MeshMonitor cannot store the broker password: {{reason}}', { reason: creds.status.reason ?? '' })}</Warn>
            )}
            {rotated && <Warn>{t('meshcore.observer.credentials_rotated_per_broker')}</Warn>}
            {(legacy || rotated) && (
              <span className={styles.block}>
                <span className={styles.muted}>
                  {rotated
                    ? t('meshcore.observer.credentials_unreadable_note', 'Unreadable broker credentials are still saved for this source.')
                    : t('meshcore.observer.legacy_credential_note', { username: legacy?.username ?? '' })}
                </span>
                {canWrite && (
                  <button type="button" className={styles.danger} disabled={creds.busy !== null} onClick={() => setConfirm({ kind: 'legacy' })}>
                    {rotated ? t('meshcore.observer.credentials_unreadable_remove', 'Remove unreadable credentials') : t('meshcore.observer.legacy_credential_remove', 'Remove old shared credential')}
                  </button>
                )}
              </span>
            )}
            {creds.actionError && creds.actionError.brokerKey === null && <Warn tone="danger">{describeObserverError(t, creds.actionError.error, null)}</Warn>}
          </div>
        </SettingGroup>
      )}

      <ConfirmSheet
        open={confirm !== null}
        title={
          confirm?.kind === 'removeBroker'
            ? t('meshcore.observer.remove_broker_title', 'Remove {{broker}}?', { broker: confirm.name })
            : confirm?.kind === 'clearCreds'
              ? t('meshcore.observer.broker_credentials_clear_title', 'Clear credentials for {{broker}}?', { broker: confirm.name })
              : confirm?.kind === 'legacy'
                ? rotated
                  ? t('meshcore.observer.credentials_unreadable_remove_title', 'Remove unreadable credentials?')
                  : t('meshcore.observer.legacy_credential_remove_title', 'Remove the old shared credential?')
                : t('meshcore.observer.clear_button', 'Clear stored key')
        }
        body={
          <p className={styles.para}>
            {confirm?.kind === 'removeBroker'
              ? t('meshcore.observer.remove_broker_confirm', 'The observer stops publishing to this broker once you save. A username and password stored for it are no longer used.')
              : confirm?.kind === 'clearCreds'
                ? t('meshcore.observer.broker_credentials_clear_confirm', 'The observer cannot log in to this broker until you set them again.')
                : confirm?.kind === 'legacy'
                  ? rotated
                    ? t('meshcore.observer.credentials_unreadable_remove_confirm')
                    : t('meshcore.observer.legacy_credential_remove_confirm', { username: legacy?.username ?? '' })
                  : t('meshcore.observer.clear_confirm', 'Forget the stored Analyzer Observer signing key? The observer will stop publishing until a new key is added.')}
          </p>
        }
        confirmLabel={confirm?.kind === 'clearKey' ? t('meshcore.observer.clear_button', 'Clear stored key') : confirm?.kind === 'clearCreds' ? t('meshcore.observer.broker_credentials_clear', 'Clear') : t('meshcore.observer.remove_broker', 'Remove')}
        danger
        submitOnEnter={false}
        onConfirm={async () => {
          const c = confirm!;
          setConfirm(null);
          if (c.kind === 'removeBroker') draft.removeBroker(c.id);
          else if (c.kind === 'clearCreds') await creds.clearCredentials(c.key);
          else if (c.kind === 'legacy') await creds.clearLegacyCredential();
          else {
            setLastAction('clear');
            await key.clearKey();
          }
        }}
        onCancel={() => setConfirm(null)}
      />

      <McDock
        changes={draft.hasChanges ? [t('meshcore.observer.group_brokers', 'Brokers')] : []}
        page={t('meshcore.observer.title')}
        sends={t('workspace.meshcore.settings.sends_observer')}
        saveLabel={t('common.save', 'Save')}
        saving={draft.isSaving}
        blocked={!canEditBrokers}
        error={draft.error}
        onSave={() => void draft.save()}
        onDiscard={draft.dismiss}
      />
    </McPage>
  );
}

/** A read-only fact row inside a group. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.cardRow}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.muted}>{children}</span>
    </div>
  );
}

/** A password broker's username and password: today's requests, saved or cleared at once. */
function BrokerCredentials({ broker, stored, canWrite, canStore, busy, error, onSave, onClear }: {
  broker: ObserverBrokerStatus;
  stored: string | null;
  canWrite: boolean;
  canStore: boolean;
  busy: boolean;
  error: string | null;
  onSave(username: string, password: string): Promise<boolean>;
  onClear(): void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(stored ?? '');
  const [password, setPassword] = useState('');
  const save = async () => {
    if (await onSave(username.trim(), password)) {
      setOpen(false);
      setPassword('');
    }
  };
  const name = broker.label || broker.url;
  return (
    <div className={styles.groupNote}>
      <span className={styles.rowLabel}>{t('meshcore.observer.broker_credentials_heading', 'Username / password')}</span>{' '}
      <span className={styles.muted}>
        {stored
          ? t('meshcore.observer.credentials_stored', 'Stored for user {{username}}', { username: stored })
          : t('meshcore.observer.broker_credentials_none', 'Not set. This broker cannot authenticate until you set them.')}
      </span>
      {canWrite && (
        <span className={styles.buttons}>
          <button type="button" className={styles.button} disabled={busy || !canStore} aria-label={t('meshcore.observer.broker_credentials_set_aria', 'Set username and password for {{broker}}', { broker: name })} onClick={() => setOpen(true)}>
            {stored ? t('meshcore.observer.broker_credentials_change', 'Change') : t('meshcore.observer.broker_credentials_set', 'Set')}
          </button>
          {stored && (
            <button type="button" className={styles.danger} disabled={busy} aria-label={t('meshcore.observer.broker_credentials_clear_aria', 'Clear username and password for {{broker}}', { broker: name })} onClick={onClear}>
              {t('meshcore.observer.broker_credentials_clear', 'Clear')}
            </button>
          )}
        </span>
      )}
      {open && (
        <span className={styles.block}>
          <label className={styles.field}>
            <span>{t('meshcore.observer.credentials_username', 'Broker username')}</span>
            <input className={styles.input} value={username} autoComplete="off" disabled={busy} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>{t('meshcore.observer.credentials_password', 'Broker password')}</span>
            <PasswordField className={styles.input} value={password} autoComplete="off" disabled={busy} placeholder={t('meshcore.observer.credentials_password_placeholder', 'Broker password')} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <span className={styles.buttons}>
            <button type="button" className={styles.plain} disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel', 'Cancel')}</button>
            <button type="button" className={styles.primary} disabled={busy || !username.trim() || !password} onClick={() => void save()}>
              {busy ? t('meshcore.observer.manual_saving', 'Saving…') : t('meshcore.observer.credentials_save', 'Save credentials')}
            </button>
          </span>
        </span>
      )}
      {error && <span className={styles.error} role="alert">{error}</span>}
    </div>
  );
}
