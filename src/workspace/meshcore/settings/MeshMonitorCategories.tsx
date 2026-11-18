/**
 * A MeshCore device's In MeshMonitor pages that are today's simple controls,
 * on the row kit (note s8n4): Connection (connect / disconnect, the local node
 * and Answer discovery requests), Receive-only (strict) and Regions (the saved
 * regions). Each sends today's one request per change.
 */
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { MeshCoreReceiveOnlyNote } from '../../../components/MeshCore/MeshCoreReceiveOnlyNote';
import type { SavedRegion } from '../../../components/MeshCore/hooks/useMeshCore';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { appBasename } from '../../../init';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly } from '../../settings/kit/useFieldRegistry';
import { McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

export function ConnectionCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const local = d.local;
  const [discoverable, setDiscoverable] = useState(false);
  const { getDiscoverable, setDiscoverable: save } = d.actions;
  // Today: read when connected to a Companion.
  useEffect(() => {
    if (d.connected && d.isCompanion) void getDiscoverable().then(setDiscoverable);
  }, [d.connected, d.isCompanion, getDiscoverable]);
  const toggle = async () => {
    const next = !discoverable;
    setDiscoverable(next);
    if (!(await save(next))) {
      setDiscoverable(!next);
      showToast(t('meshcore.discover.toggle_failed', 'Failed to update setting'), 'error');
    }
  };
  return (
    <McPage>
      <div className={styles.card}>
        <span className={styles.rowLabel}>{t('meshcore.connection')}</span>
        <span className={styles.muted}>
          {d.connected
            ? t('meshcore.settings.currently_connected')
            : t('meshcore.settings.persource_hint', 'Connection parameters are managed in the source configuration.')}
        </span>
        <span>
          {d.connected ? (
            <button type="button" className={styles.button} disabled={d.loading} onClick={() => void d.actions.disconnect()}>
              {t('meshcore.disconnect', 'Disconnect')}
            </button>
          ) : (
            <button type="button" className={styles.primary} disabled={d.loading} onClick={() => void d.actions.connect()}>
              {d.loading ? t('meshcore.connecting', 'Connecting…') : t('meshcore.connect', 'Connect')}
            </button>
          )}
        </span>
      </div>
      {local && (
        <dl className={styles.facts} aria-label={t('meshcore.settings.local_node', 'Local node')}>
          <dt>{t('meshcore.settings.name', 'Name')}</dt>
          <dd>{local.name || '—'}</dd>
          <dt>{t('meshcore.settings.type', 'Type')}</dt>
          <dd>{d.status?.deviceTypeName}</dd>
          <dt>{t('meshcore.public_key', 'Public key')}</dt>
          <dd className={styles.mono}>{local.publicKey ?? '—'}</dd>
          {typeof local.radioFreq === 'number' && (
            <>
              <dt>{t('meshcore.radio', 'Radio')}</dt>
              <dd>{`${local.radioFreq} MHz, BW${local.radioBw}, SF${local.radioSf}, CR${local.radioCr}`}</dd>
            </>
          )}
        </dl>
      )}
      {d.isCompanion && (
        <SettingGroup>
          <SettingRow
            id="meshcore.discoverable"
            label={t('meshcore.discover.responder_title')}
            help={
              <>
                {t('meshcore.discover.respond_label')}. {t('meshcore.discover.respond_hint')}
                {!d.canWriteConfig && <span className={styles.block}>{t('meshcore.discover.respond_needs_config_write')}</span>}
                <SendsLine>{t('workspace.meshcore.settings.sends_discoverable')}</SendsLine>
                <MeshCoreReceiveOnlyNote receiveOnly={d.receiveOnly} />
              </>
            }
          >
            {/* Today's gate: configuration:write on this source, whatever the page's settings grant. */}
            <SettingToggle checked={discoverable} readOnly={!d.canWriteConfig || !d.connected || d.loading} onChange={() => void toggle()} />
          </SettingRow>
        </SettingGroup>
      )}
    </McPage>
  );
}

/** Today's strict receive-only switch (#4547): on at once; off asks first, as today. */
export function ReceiveOnlyCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const off = useReadOnly(readOnly);
  const { showToast } = useToast();
  const csrfFetch = useCsrfFetch();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const set = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await csrfFetch(`${appBasename}/api/settings?sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meshcoreReceiveOnly: next }),
      });
      if (!res.ok) {
        showToast(t('meshcore.receive_only.save_failed'), 'error');
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['txStatus'] });
      showToast(t(next ? 'meshcore.receive_only.saved_on' : 'meshcore.receive_only.saved_off'), 'success');
    } finally {
      setSaving(false);
      setAsking(false);
    }
  };
  return (
    <McPage>
      <SettingGroup>
        <SettingRow
          id="meshcore.receiveOnly"
          label={t('meshcore.receive_only.toggle_label')}
          help={
            <>
              {t('meshcore.receive_only.description')}
              <span className={styles.block}>{t('meshcore.receive_only.firmware_caveat')}</span>
            </>
          }
        >
          <SettingToggle checked={d.receiveOnly} readOnly={off || saving} onChange={(next) => (next ? void set(true) : setAsking(true))} />
        </SettingRow>
      </SettingGroup>
      <p className={styles.lead}>
        <UiIcon name="info" size={16} />
        <span>{t('meshcore.receive_only.why_here')}</span>
      </p>
      <ConfirmSheet
        open={asking}
        title={t('meshcore.receive_only.disable_confirm').split('\n\n')[0]}
        body={<p className={styles.para}>{t('meshcore.receive_only.disable_confirm').split('\n\n').slice(1).join(' ')}</p>}
        confirmLabel={t('workspace.meshcore.settings.transmit_again')}
        busy={saving}
        submitOnEnter={false}
        onConfirm={() => set(false)}
        onCancel={() => setAsking(false)}
      />
    </McPage>
  );
}

/** Today's saved-regions catalogue (#3770): a list MeshMonitor keeps; nothing goes to the radio. */
export function RegionsCategory({ readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const off = useReadOnly(readOnly);
  const { showToast } = useToast();
  const { fetchSavedRegions, addSavedRegion, deleteSavedRegion } = d.actions;
  const [regions, setRegions] = useState<SavedRegion[]>([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    const rows = await fetchSavedRegions();
    if (rows) setRegions(rows);
  }, [fetchSavedRegions]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const add = async () => {
    const name = input.trim().replace(/^#/, '');
    if (!name) return;
    setSaving(true);
    try {
      const saved = await addSavedRegion(name);
      if (!saved) return showToast(t('meshcore.regions.save_failed', 'Failed to save region'), 'error');
      await refresh();
      setInput('');
      showToast(t('meshcore.regions.saved', 'Region "{{name}}" saved', { name: saved.name }), 'success');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (r: SavedRegion) => {
    if (!(await deleteSavedRegion(r.id))) return showToast(t('meshcore.regions.delete_failed', 'Failed to delete region'), 'error');
    await refresh();
  };
  return (
    <McPage>
      <p className={styles.lead}>
        {t(
          'meshcore.regions.hint',
          'A list of region/scope names you maintain. Save regions reported by repeaters or add your own, then pick them when setting a channel scope or overriding the scope for a single message. Letters, digits and hyphens only.',
        )}
      </p>
      <div className={styles.card}>
        <form
          className={styles.inline}
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            className={styles.input}
            aria-label={t('workspace.meshcore.settings.regions')}
            value={input}
            maxLength={63}
            spellCheck={false}
            autoComplete="off"
            placeholder={t('meshcore.regions.add_placeholder', 'e.g. muenchen')}
            disabled={saving || off}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className={styles.button} disabled={saving || off || !input.trim()}>
            {saving ? t('common.saving', 'Saving…') : t('meshcore.regions.add', 'Add')}
          </button>
        </form>
        {regions.length === 0 ? (
          <p className={styles.muted}>{t('meshcore.regions.empty', 'No saved regions yet.')}</p>
        ) : (
          <ul className={styles.chips} aria-label={t('workspace.meshcore.settings.regions')}>
            {regions.map((r) => (
              <li key={r.id} className={styles.chip}>
                <span>{r.name}</span>
                <button
                  type="button"
                  className={styles.chipX}
                  disabled={off}
                  aria-label={t('meshcore.regions.delete', 'Delete "{{name}}"', { name: r.name })}
                  onClick={() => void remove(r)}
                >
                  <UiIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </McPage>
  );
}
