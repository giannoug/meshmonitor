/**
 * A Companion's Path hash & scope, Sender names and Contacts (Task 7.4, note
 * s8n4), on the row kit with today's requests (the sections they replace:
 * MeshCorePathHashSection, MeshCoreDefaultScopeSection,
 * MeshCoreSenderNamesSection, MeshCoreDeviceActionsSection):
 *
 * - Path hash & scope: hash size and the default region / scope, read when
 *   connected, saved from the page's own bar (`setDefaultPathHashSize`,
 *   `setDefaultScope`, each once and only if changed). Discover regions asks
 *   nearby repeaters (it transmits; its Sends line says so); a region it
 *   found fills the scope or saves to the regions list.
 * - Sender names: the switch and the names, one save from the bar.
 * - Contacts: Refresh contacts, the two adverts (flood asks first) and the
 *   three discoveries, each once per press; nothing is saved.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import type { DiscoveredNode, SavedRegion, SenderNamePolicy } from '../../../components/MeshCore/hooks/useMeshCore';
import { SENDER_NAME_ALLOWLIST_MAX, normalizeSenderName, validateMeshcoreSenderName } from '../../../utils/meshcoreSenderName';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { ContactList } from './MaintenanceCategory';
import { DeviceNotes, McDock, McPage } from './mcShared';
import { runSweep, useSweep } from './sweepStore';
import { useDraft } from './useDraft';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

type HashSize = 1 | 2 | 3;
const normalize = (value: string) => value.trim().replace(/^#/, '');

export function PathScopeCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const { getDefaultPathHashSize, setDefaultPathHashSize, getDefaultScope, setDefaultScope, discoverRegions, fetchSavedRegions, addSavedRegion } = d.actions;
  const [saved, setSaved] = useState<{ hash: HashSize; scope: string }>({ hash: 1, scope: '' });
  const draft = useDraft(saved);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[] | null>(null);
  const sweep = useSweep(d.sourceId);
  const discovering = sweep === 'regions';
  const [savedRegions, setSavedRegions] = useState<SavedRegion[]>([]);
  const [savingRegion, setSavingRegion] = useState(false);

  // Today: both read when connected; the saved regions always.
  useEffect(() => {
    if (!d.connected) return;
    void getDefaultPathHashSize().then((hash) => setSaved((s) => ({ ...s, hash })));
    void getDefaultScope().then((scope) => setSaved((s) => ({ ...s, scope })));
  }, [d.connected, getDefaultPathHashSize, getDefaultScope]);
  const refreshRegions = useCallback(async () => {
    const rows = await fetchSavedRegions();
    if (rows) setSavedRegions(rows);
  }, [fetchSavedRegions]);
  useEffect(() => {
    void refreshRegions();
  }, [refreshRegions]);
  const savedNames = useMemo(() => new Set(savedRegions.map((r) => r.name.toLowerCase())), [savedRegions]);

  const off = !d.connected || !d.canWriteConfig || d.loading || saving;
  const scopeChanged = normalize(draft.value('scope')) !== saved.scope;
  const changes = [
    ...(draft.isChanged('hash') ? [t('meshcore.path_hash.title', 'Default path hash size')] : []),
    ...(draft.isChanged('scope') && scopeChanged ? [t('meshcore.scope.title', 'Default region / scope')] : []),
  ];
  const save = async () => {
    setSaving(true);
    setFailed(null);
    const failedNames: string[] = [];
    if (draft.isChanged('hash')) {
      const r = await setDefaultPathHashSize(draft.value('hash'));
      if (r === null) failedNames.push(t('meshcore.path_hash.title', 'Default path hash size'));
      else {
        setSaved((s) => ({ ...s, hash: r }));
        draft.settle(['hash']);
      }
    }
    if (draft.isChanged('scope') && scopeChanged) {
      const r = await setDefaultScope(draft.value('scope'));
      if (r === null) failedNames.push(t('meshcore.scope.title', 'Default region / scope'));
      else {
        setSaved((s) => ({ ...s, scope: r }));
        draft.settle(['scope']);
        setRegions(null);
      }
    }
    setSaving(false);
    if (failedNames.length) setFailed(t('workspace.meshcore.settings.not_saved', { names: failedNames.join(', ') }));
  };
  const discover = async () => {
    if (sweep !== null) return;
    const result = await runSweep(d.sourceId, 'regions', discoverRegions);
    if (result === null) return showToast(t('meshcore.scope.discover_failed', 'Failed to discover regions'), 'error');
    setRegions(result.regions);
    if (result.noZeroHopRepeaters) showToast(t('meshcore.scope.discover_no_repeaters', 'No nearby (0-hop) repeaters found. Move closer to a repeater and try again.'), 'info');
    else if (result.regions.length === 0) showToast(t('meshcore.scope.discover_none', 'Nearby repeaters reported no regions.'), 'info');
  };
  const saveRegion = async (name: string) => {
    setSavingRegion(true);
    try {
      const r = await addSavedRegion(normalize(name));
      if (!r) return showToast(t('meshcore.regions.save_failed', 'Failed to save region'), 'error');
      await refreshRegions();
      showToast(t('meshcore.regions.saved', 'Region "{{name}}" saved', { name: r.name }), 'success');
    } finally {
      setSavingRegion(false);
    }
  };
  // One radio sweep at a time (today's otherSweepRunning): a node discovery holds this too.
  const discoverOff = !d.canWriteNodes || !d.connected || d.loading || sweep !== null || d.receiveOnly;

  return (
    <McPage>
      <DeviceNotes />
      <SettingGroup>
        <SettingRow
          id="meshcore.pathHash"
          label={t('meshcore.path_hash.title', 'Default path hash size')}
          help={t(
            'meshcore.path_hash.hint',
            'Number of bytes used for path/loop-detection hashes on outgoing messages. 1 byte (256 values) is enough for small meshes; 2 bytes (65,536 values) is recommended for mid-to-large deployments to avoid path-table collisions that drop packets on valid routes. Applied to the device immediately and re-asserted on reconnect.',
          )}
          was={draft.isChanged('hash') ? String(saved.hash) : undefined}
        >
          <SettingSelect
            value={String(draft.value('hash'))}
            readOnly={off}
            options={[
              { value: '1', label: t('meshcore.path_hash.one', '1 byte') },
              { value: '2', label: t('meshcore.path_hash.two', '2 bytes (recommended)') },
              { value: '3', label: t('meshcore.path_hash.three', '3 bytes') },
            ]}
            onChange={(v) => draft.set('hash', Number(v) as HashSize)}
          />
        </SettingRow>
        <SettingRow
          id="meshcore.defaultScope"
          label={t('meshcore.scope.title', 'Default region / scope')}
          help={t(
            'meshcore.scope.hint',
            'Region applied to all outgoing flood traffic (direct messages, adverts, requests) that has no channel-specific scope. Use a large region that includes you and the contacts you message — both your messages and the returning ACKs are scoped to it. Leave blank to send unscoped (legacy). Letters, digits and hyphens only.',
          )}
          was={draft.isChanged('scope') && scopeChanged ? saved.scope || '—' : undefined}
        >
          <SettingText value={draft.value('scope')} maxLength={63} placeholder={t('meshcore.scope.placeholder', 'e.g. muenchen — blank for unscoped')} readOnly={off} onChange={(v) => draft.set('scope', v)} />
        </SettingRow>
      </SettingGroup>

      <section className={styles.section} aria-labelledby="mc-discover-regions">
        <h2 className={styles.heading} id="mc-discover-regions">{t('workspace.meshcore.settings.discover_regions')}</h2>
        <div className={styles.card}>
          <span className={styles.muted}>{t('meshcore.scope.discover_hint', 'Sweeps for nearby (0-hop / direct-range) repeaters and asks each one which regions it serves.')}</span>
          <SendsLine>{t('workspace.meshcore.settings.sends_discover_regions')}</SendsLine>
          {d.receiveOnly && <span className={styles.muted}>{t('meshcore.receive_only.control_tooltip')}</span>}
          {!d.canWriteNodes && <span className={styles.muted}>{t('meshcore.device_actions.needs_nodes_write', 'This needs the Nodes write permission on this source.')}</span>}
          <span>
            <button type="button" className={styles.button} disabled={discoverOff} onClick={() => void discover()}>
              {discovering ? t('meshcore.scope.discovering', 'Discovering regions…') : t('meshcore.scope.discover', 'Discover regions from repeaters')}
            </button>
          </span>
          {regions && regions.length > 0 && (
            <ul className={styles.chips} aria-label={t('workspace.meshcore.settings.discover_regions')}>
              {regions.map((region) => {
                const isSaved = savedNames.has(region.toLowerCase());
                return (
                  <li key={region} className={styles.chip} data-selected={normalize(draft.value('scope')) === region || undefined}>
                    <button type="button" className={styles.chipText} disabled={off} onClick={() => draft.set('scope', region)} title={t('meshcore.scope.use_region', 'Use "{{region}}" as the default scope', { region })}>
                      {region}
                    </button>
                    <button
                      type="button"
                      className={styles.chipX}
                      disabled={isSaved || savingRegion}
                      aria-label={isSaved ? t('meshcore.regions.already_saved', 'Already in saved regions') : t('meshcore.regions.save_this', 'Save "{{region}}" to your regions list', { region })}
                      onClick={() => void saveRegion(region)}
                    >
                      <UiIcon name={isSaved ? 'check' : 'plus'} size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.path_scope')}
        sends={t('workspace.meshcore.settings.sends_device_setting')}
        saveLabel={t('common.save', 'Save')}
        saving={saving}
        blocked={off}
        error={failed}
        onSave={() => void save()}
        onDiscard={() => {
          draft.discard();
          setFailed(null);
        }}
      />
    </McPage>
  );
}

const toLines = (names: string[]) => names.join('\n');
/** One name per non-blank line, trimmed and de-duplicated (today's). */
const parseLines = (text: string): string[] => {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const n = normalizeSenderName(line);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
};

export function SenderNamesCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const { getSenderNamePolicy, setSenderNamePolicy } = d.actions;
  const [saved, setSaved] = useState<SenderNamePolicy>({ enabled: false, allowedNames: [] });
  const draft = useDraft({ enabled: saved.enabled, names: toLines(saved.allowedNames) });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!d.connected) return;
    void getSenderNamePolicy().then((p) => p && setSaved(p));
  }, [d.connected, getSenderNamePolicy]);
  const names = parseLines(draft.value('names'));
  const namesChanged = toLines(names) !== toLines(saved.allowedNames);
  const off = !d.canWriteConfig || !d.connected || d.loading || saving;
  const changes = [
    ...(draft.isChanged('enabled') ? [t('meshcore.sender_names.enable', 'Allow API callers to send under these names')] : []),
    ...(namesChanged ? [t('meshcore.sender_names.names_label', 'Allowed names, one per line')] : []),
  ];
  const save = async () => {
    if (names.length > SENDER_NAME_ALLOWLIST_MAX) return showToast(t('meshcore.sender_names.too_many', 'At most 16 names are allowed'), 'error');
    const bad = names.find((n) => !validateMeshcoreSenderName(n).ok);
    if (bad) return showToast(t('meshcore.sender_names.invalid', 'Invalid name: {{name}}', { name: bad }), 'error');
    setSaving(true);
    try {
      const r = await setSenderNamePolicy({ enabled: draft.value('enabled'), allowedNames: names });
      if (!r) return showToast(t('meshcore.sender_names.save_failed', 'Failed to save sender names'), 'error');
      setSaved(r);
      draft.discard();
      showToast(t('meshcore.sender_names.saved', 'Sender names saved'), 'success');
    } finally {
      setSaving(false);
    }
  };
  return (
    <McPage>
      <DeviceNotes />
      <p className={styles.lead}>{t('meshcore.sender_names.hint')}</p>
      <SettingGroup>
        <SettingRow id="meshcore.senderNamesEnabled" label={t('meshcore.sender_names.enable')}>
          <SettingToggle checked={draft.value('enabled')} readOnly={off} onChange={(v) => draft.set('enabled', v)} />
        </SettingRow>
        <SettingRow
          id="meshcore.senderNames"
          label={t('meshcore.sender_names.names_label', 'Allowed names, one per line')}
          help={t('meshcore.sender_names.names_hint', 'Up to 16 names, 1 to 31 bytes each. No colon, no control characters, no leading #.')}
          stacked
        >
          <NamesField value={draft.value('names')} off={off} onChange={(v) => draft.set('names', v)} />
        </SettingRow>
      </SettingGroup>
      <Warn>{t('meshcore.sender_names.warning')}</Warn>
      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.sender_names')}
        sends={t('workspace.meshcore.settings.sends_device_setting')}
        saveLabel={t('meshcore.sender_names.save', 'Save sender names')}
        saving={saving}
        blocked={off}
        onSave={() => void save()}
        onDiscard={draft.discard}
      />
    </McPage>
  );
}

function NamesField({ value, off, onChange }: { value: string; off: boolean; onChange(v: string): void }) {
  const { t } = useTranslation();
  const row = useSettingRow();
  return (
    <textarea
      id={row?.inputId}
      aria-describedby={row?.helpId}
      className={styles.textarea}
      rows={4}
      value={value}
      placeholder={t('meshcore.sender_names.names_placeholder', 'Alerts Bot')}
      disabled={useReadOnly(off)}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type DiscoverMode = 'nearby' | 'repeaters' | 'sensors';

/** Today's device actions: each acts on the radio when pressed; nothing here is saved. */
export function ContactsCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const [flood, setFlood] = useState(false);
  const [mode, setMode] = useState<DiscoverMode | null>(null);
  const sweep = useSweep(sourceId);
  // The running node sweep's mode (this page's), so its button reads Discovering….
  const discovering = sweep === 'nodes' ? mode : null;
  const [found, setFound] = useState<DiscoveredNode[] | null>(null);
  const receiveOnly = d.receiveOnly ? t('meshcore.receive_only.control_tooltip') : null;
  const advertOff = !d.canWriteConnection || !d.connected || d.loading || d.receiveOnly;
  // One radio sweep at a time (today's otherSweepRunning): a region discovery holds this too.
  const discoverOff = !d.canWriteNodes || !d.connected || d.loading || sweep !== null || d.receiveOnly;
  const discover = async (m: DiscoverMode) => {
    if (sweep !== null) return;
    setMode(m);
    setFound(null);
    const r = await runSweep(sourceId, 'nodes', () => d.actions.discoverNodes(m));
    if (r) {
      setFound(r.nodes);
      showToast(t('meshcore.discover.result', { returned: r.returned, new: r.newCount }), 'success');
    } else showToast(t('meshcore.discover.failed'), 'error');
  };
  const row = (label: string, help: string, sends: string, children: React.ReactNode, blocked?: string | null) => (
    <div className={styles.cardRow}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.muted}>{help}</span>
        {blocked && <span className={styles.muted}>{blocked}</span>}
        <SendsLine>{sends}</SendsLine>
      </span>
      <span className={styles.buttons}>{children}</span>
    </div>
  );
  return (
    <McPage>
      {!d.canReadConfig && d.isCompanion && <ContactList sourceId={sourceId} />}
      <p className={styles.lead}>{t('meshcore.device_actions.group_hint', 'These act on the radio when you press them. Nothing here is a saved setting.')}</p>
      <section className={styles.section} aria-labelledby="mc-contacts-adverts">
        <h2 className={styles.heading} id="mc-contacts-adverts">{t('meshcore.device_actions.contacts_and_adverts', 'Contacts and adverts')}</h2>
        <div className={styles.card}>
          {row(
            t('workspace.meshcore.settings.refresh_title'),
            t('workspace.meshcore.settings.refresh_help'),
            t('workspace.meshcore.settings.sends_refresh'),
            <button type="button" className={styles.button} disabled={!d.canWriteNodes || !d.connected || d.loading} onClick={() => void d.actions.refreshContacts()}>
              {t('meshcore.refresh')}
            </button>,
            !d.canWriteNodes ? t('meshcore.device_actions.needs_nodes_write', 'This needs the Nodes write permission on this source.') : null,
          )}
          {row(
            t('meshcore.advert.zero_hop_button'),
            t('meshcore.settings.actions_hint'),
            t('workspace.meshcore.sends_nearby'),
            <button type="button" className={styles.button} disabled={advertOff} onClick={() => void d.actions.sendAdvert('zero_hop')}>
              {t('workspace.meshcore.settings.send_advert')}
            </button>,
            !d.canWriteConnection ? t('meshcore.device_actions.needs_connection_write', 'This needs the Connection write permission on this source.') : receiveOnly,
          )}
          {row(
            t('meshcore.advert.flood_button'),
            t('meshcore.advert.flood_title', 'Announce this node across the whole mesh. Every repeater within 8 hops forwards it.'),
            t('workspace.meshcore.sends_flood'),
            <button type="button" className={styles.button} disabled={advertOff} onClick={() => setFlood(true)}>
              {t('meshcore.advert.flood_button')}
            </button>,
          )}
        </div>
      </section>
      {d.isCompanion && (
        <section className={styles.section} aria-labelledby="mc-contacts-discover">
          <h2 className={styles.heading} id="mc-contacts-discover">{t('meshcore.discover.title')}</h2>
          <div className={styles.card}>
            <span className={styles.muted}>{t('meshcore.discover.hint')}</span>
            <SendsLine>{t('workspace.meshcore.sends_discover_nodes')}</SendsLine>
            {receiveOnly && <span className={styles.muted}>{receiveOnly}</span>}
            <span className={styles.buttons}>
              {(['nearby', 'repeaters', 'sensors'] as DiscoverMode[]).map((m) => (
                <button key={m} type="button" className={styles.button} disabled={discoverOff} onClick={() => void discover(m)}>
                  {discovering === m ? t('meshcore.discover.running') : t(`meshcore.discover.${m}`)}
                </button>
              ))}
            </span>
            {found && found.length > 0 && (
              <ul className={styles.results} aria-label={t('meshcore.discover.title')}>
                {found.map((n) => (
                  <li key={n.publicKey} className={styles.cardRow}>
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>
                        {n.name || t('meshcore.discover.unnamed')} {n.isNew && <span className={styles.tag}>{t('meshcore.discover.new_badge')}</span>}
                      </span>
                      <span className={styles.mono}>{`${n.publicKey.substring(0, 12)}…`}</span>
                    </span>
                    <span className={styles.muted}>
                      {`${n.snr !== null ? `${n.snr.toFixed(2)} dB` : '—'} · ${n.snrToNode !== null ? `${n.snrToNode.toFixed(2)} dB` : '—'}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      <ConfirmSheet
        open={flood}
        title={t('meshcore.advert.flood_confirm_title', 'Send a flood advert?')}
        body={
          <>
            <p className={styles.para}>{t('meshcore.advert.flood_confirm')}</p>
            <SendsLine>{t('workspace.meshcore.sends_flood')}</SendsLine>
          </>
        }
        confirmLabel={t('meshcore.advert.flood_confirm_button', 'Send flood advert')}
        submitOnEnter={false}
        onConfirm={() => {
          setFlood(false);
          void d.actions.sendAdvert('flood');
        }}
        onCancel={() => setFlood(false)}
      />
    </McPage>
  );
}
