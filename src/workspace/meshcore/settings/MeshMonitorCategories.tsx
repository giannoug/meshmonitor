/**
 * A MeshCore device's In MeshMonitor pages on the row kit (note s8n4):
 * Connection (connect / disconnect, the local node and Answer discovery
 * requests), Receive-only (strict), Regions (the saved regions), Reactions,
 * Required repeaters (Any/All) and Notifications (audio). Each sends today's
 * request(s): the switches that saved as you go today still do (Answer
 * discovery, Receive-only, a region added or removed); Reactions, Required
 * repeaters and Notifications save from the page's own bar (s8n4), sending
 * today's one request per changed setting, once per press.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { MeshCoreReceiveOnlyNote } from '../../../components/MeshCore/MeshCoreReceiveOnlyNote';
import type { SavedRegion } from '../../../components/MeshCore/hooks/useMeshCore';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import ChannelSoundPicker from '../../../components/ChannelSoundPicker';
import { useSettings } from '../../../contexts/SettingsContext';
import apiService from '../../../services/api';
import type { MeshCoreContact } from '../../../utils/meshcoreHelpers';
import { RELAY_ADV_TYPES, readRequiredRepeaters, type RequiredRepeaterMode } from '../../../utils/meshcoreHeardBy';
import { MC_REACTION_FORMAT_VERSION } from '../../../utils/meshcoreReactions';
import { MESHCORE_REACTIONS_OUTBOUND_DEFAULT, resolveReactionsOutbound } from '../../../utils/meshcoreReactionTarget';
import SettingSelect from '../../settings/kit/SettingSelect';
import { useDraft } from './useDraft';
import { appBasename } from '../../../init';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly } from '../../settings/kit/useFieldRegistry';
import { McDock, McPage } from './mcShared';
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

const isOn = (v: unknown): boolean => v === true || v === 'true' || v === '1';
type ReactionKey = 'meshcoreReactionsInboundEnabled' | 'meshcoreReactionsOutboundEnabled' | 'meshcoreReactionsAckOnReceive';

/** Today's MeshCoreReactionsSection: two keys of this source, Auto-Acknowledge's for every MeshCore source. */
export function ReactionsCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const off = useReadOnly(readOnly);
  const { showToast } = useToast();
  const [saved, setSaved] = useState<Record<ReactionKey, boolean>>({
    meshcoreReactionsInboundEnabled: true,
    meshcoreReactionsOutboundEnabled: MESHCORE_REACTIONS_OUTBOUND_DEFAULT,
    meshcoreReactionsAckOnReceive: false,
  });
  const draft = useDraft(saved);
  const [saving, setSaving] = useState(false);
  const sourceUrl = `/api/settings?sourceId=${encodeURIComponent(sourceId)}`;
  useEffect(() => {
    let cancelled = false;
    apiService
      .get<Record<string, unknown>>(sourceUrl)
      .then((v) => {
        if (cancelled || !v) return;
        const inbound = v.meshcoreReactionsInboundEnabled;
        setSaved({
          meshcoreReactionsInboundEnabled: !(inbound === false || inbound === 'false' || inbound === '0'),
          meshcoreReactionsOutboundEnabled: resolveReactionsOutbound(v.meshcoreReactionsOutboundEnabled),
          meshcoreReactionsAckOnReceive: isOn(v.meshcoreReactionsAckOnReceive),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);
  const labels: Record<ReactionKey, string> = {
    meshcoreReactionsInboundEnabled: t('meshcore.reactions.settings.inbound_label', 'Show MeshCore reactions'),
    meshcoreReactionsOutboundEnabled: t('meshcore.reactions.settings.outbound_label', 'Send reactions from MeshMonitor'),
    meshcoreReactionsAckOnReceive: t('meshcore.reactions.settings.ack_label', 'Auto-Acknowledge may answer reactions (all MeshCore sources)'),
  };
  // Today: one request per setting; Auto-Acknowledge's is global.
  const save = async () => {
    setSaving(true);
    const failed: string[] = [];
    for (const k of draft.changed) {
      const ok = await apiService.post(k === 'meshcoreReactionsAckOnReceive' ? '/api/settings' : sourceUrl, { [k]: draft.value(k) }).then(() => true, () => false);
      if (!ok) {
        failed.push(labels[k]);
        continue;
      }
      setSaved((s) => ({ ...s, [k]: draft.value(k) }));
      draft.settle([k]);
      if (k === 'meshcoreReactionsOutboundEnabled') void d.actions.refreshStatus();
    }
    setSaving(false);
    if (failed.length) showToast(t('meshcore.reactions.settings.save_failed', 'Failed to save the reaction setting'), 'error');
  };
  const toggle = (k: ReactionKey, help: React.ReactNode) => (
    <SettingRow id={`meshcore.${k}`} label={labels[k]} help={help} was={draft.isChanged(k) ? t(saved[k] ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off') : undefined}>
      <SettingToggle checked={draft.value(k)} readOnly={off || saving} onChange={(v) => draft.set(k, v)} />
    </SettingRow>
  );
  return (
    <McPage>
      <SettingGroup>
        {toggle('meshcoreReactionsInboundEnabled', t('meshcore.reactions.settings.inbound_help', 'Reactions from MeshCore One and meshcore-open show as chips under the message. Turn this off to keep them as plain text lines.'))}
        {toggle(
          'meshcoreReactionsOutboundEnabled',
          <>
            {t('meshcore.reactions.settings.outbound_help', 'Adds a react button to MeshCore messages on this source and lets automations send reactions. Sent in MeshCore One format.')}
            <SendsLine>{t('meshcore.reactions.settings.outbound_warning', 'Each reaction is one short packet. On a channel, every repeater in range sends it again.')}</SendsLine>
          </>,
        )}
        {toggle(
          'meshcoreReactionsAckOnReceive',
          <SendsLine>{t('meshcore.reactions.settings.ack_warning', 'A reaction is one tap for the sender. With this on, each one can trigger an Auto-Acknowledge reply on the air. Leave it off on busy channels.')}</SendsLine>,
        )}
      </SettingGroup>
      <p className={styles.lead}>{t('meshcore.reactions.settings.format_note', 'Wire format v{{version}} (MeshCore One 1.4.1 and later).', { version: MC_REACTION_FORMAT_VERSION })}</p>
      <McDock
        changes={draft.changed.map((k) => labels[k])}
        page={t('workspace.meshcore.settings.reactions')}
        sends={t('workspace.settings.savebar.sends_nothing')}
        saveLabel={t('common.save', 'Save')}
        saving={saving}
        blocked={off}
        onSave={() => void save()}
        onDiscard={draft.discard}
      />
    </McPage>
  );
}

const relayLabel = (c: MeshCoreContact) => c.advName || c.name || `${c.publicKey.slice(0, 12)}…`;

/** Today's MeshCoreRequiredRepeaterSection: Any/All and the direct relays, one save of this source's keys. */
export function RequiredRepeatersCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const off = useReadOnly(readOnly);
  const { showToast } = useToast();
  const sourceUrl = `/api/settings?sourceId=${encodeURIComponent(sourceId)}`;
  const [saved, setSaved] = useState<{ keys: string[]; mode: RequiredRepeaterMode }>({ keys: [], mode: 'any' });
  const draft = useDraft(saved);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiService
      .get<Record<string, unknown>>(sourceUrl)
      .then((v) => {
        if (cancelled || !v) return;
        setSaved(readRequiredRepeaters(v));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);
  const contacts = d.meshCore.contacts;
  // Direct relays only (a zero-hop cached route), as today.
  const direct = useMemo(() => {
    const byKey = new Map<string, MeshCoreContact>();
    for (const c of contacts) {
      if (!c.publicKey || c.advType == null || !RELAY_ADV_TYPES.has(c.advType) || c.pathLen !== 0) continue;
      if (!byKey.has(c.publicKey)) byKey.set(c.publicKey, c);
    }
    return [...byKey.values()].sort((a, b) => relayLabel(a).localeCompare(relayLabel(b)));
  }, [contacts]);
  const keys = draft.value('keys');
  const directKeys = new Set(direct.map((r) => r.publicKey));
  const flagged = keys.filter((k) => !directKeys.has(k));
  const toggleKey = (k: string) => draft.set('keys', keys.includes(k) ? keys.filter((x) => x !== k) : [...keys, k]);
  const save = async () => {
    setSaving(true);
    try {
      await apiService.post(sourceUrl, {
        meshcoreRequiredRepeaters: JSON.stringify(keys),
        meshcoreRequiredRepeaterMode: draft.value('mode'),
        // Clear the legacy single key so an empty list never falls back to it.
        meshcoreRequiredRepeater: '',
      });
      setSaved({ keys, mode: draft.value('mode') });
      draft.discard();
    } catch {
      showToast(t('meshcore.required_repeater.save_failed', 'Failed to save the required repeater'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const changes = [
    ...(draft.isChanged('mode') ? [t('meshcore.required_repeater.mode_label', 'Match mode')] : []),
    ...(draft.isChanged('keys') ? [t('meshcore.required_repeater.title', 'Required repeaters')] : []),
  ];
  const check = (k: string, label: string, flag?: string) => (
    <label key={k} className={styles.cardRow}>
      <span className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {flag && <span className={styles.muted}>{flag}</span>}
      </span>
      <input type="checkbox" className={styles.switch} checked={keys.includes(k)} disabled={off || saving} onChange={() => toggleKey(k)} />
    </label>
  );
  return (
    <McPage>
      <SettingGroup>
        <SettingRow id="meshcore.requiredRepeaterMode" label={t('meshcore.required_repeater.mode_label', 'Match mode')} was={draft.isChanged('mode') ? saved.mode : undefined}>
          <SettingSelect
            value={draft.value('mode')}
            readOnly={off || saving}
            options={[
              { value: 'any', label: t('meshcore.required_repeater.mode_any', 'Any — resend stops once one relays') },
              { value: 'all', label: t('meshcore.required_repeater.mode_all', 'All — resend stops once every one relays') },
            ]}
            onChange={(v) => draft.set('mode', v === 'all' ? 'all' : 'any')}
          />
        </SettingRow>
      </SettingGroup>
      <section className={styles.section} aria-labelledby="mc-required-list">
        <h2 className={styles.heading} id="mc-required-list">{t('meshcore.required_repeater.title', 'Required repeaters')}</h2>
        <div className={styles.card}>
          {direct.map((r) => check(r.publicKey, relayLabel(r)))}
          {flagged.map((k) => {
            const c = contacts.find((x) => x.publicKey === k);
            return check(
              k,
              c ? relayLabel(c) : `${k.slice(0, 12)}…`,
              c ? t('meshcore.required_repeater.not_direct', 'no longer direct') : t('meshcore.required_repeater.saved_unknown', 'saved — not a known relay'),
            );
          })}
          {direct.length === 0 && flagged.length === 0 && (
            <span className={styles.muted}>{t('meshcore.required_repeater.none_direct', 'No direct repeaters yet. A relay must be heard with a zero-hop path to appear here.')}</span>
          )}
          <span className={styles.muted}>
            {t('meshcore.required_repeater.list_help', 'Pick the direct repeaters this source should hear relay a channel message. Until the match mode is met, the message keeps its Resend button. Leave empty to resend as soon as any repeater relays it.')}
          </span>
        </div>
      </section>
      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.required_repeaters')}
        sends={t('workspace.settings.savebar.sends_nothing')}
        saveLabel={t('common.save', 'Save')}
        saving={saving}
        blocked={off}
        onSave={() => void save()}
        onDiscard={draft.discard}
      />
    </McPage>
  );
}

/** Today's Audio notifications: this browser's switch (SettingsContext) and the per-channel sounds. */
export function NotificationsCategory({ readOnly: _readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const s = useSettings();
  const draft = useDraft({ audio: s.enableAudioNotifications });
  const label = t('settings.enable_audio_notifications');
  return (
    <McPage>
      <SettingGroup>
        <SettingRow id="meshcore.audio" label={label} help={t('settings.enable_audio_notifications_description')}>
          <SettingToggle checked={draft.value('audio')} onChange={(v) => draft.set('audio', v)} />
        </SettingRow>
      </SettingGroup>
      {s.enableAudioNotifications && (
        <section className={styles.section} aria-labelledby="mc-sounds">
          <h2 className={styles.heading} id="mc-sounds">{t('settings.channel_sounds_label', 'Per-channel notification sound')}</h2>
          <div className={styles.card}>
            <span className={styles.muted}>{t('settings.channel_sounds_description')}</span>
            <ChannelSoundPicker meshcoreDeviceType={d.status?.deviceType} />
          </div>
        </section>
      )}
      <McDock
        changes={draft.changed.length ? [label] : []}
        page={t('nav.notifications')}
        sends={t('workspace.settings.savebar.sends_nothing')}
        saveLabel={t('common.save', 'Save')}
        saving={false}
        blocked={false}
        onSave={() => {
          s.setEnableAudioNotifications(draft.value('audio'));
          draft.discard();
        }}
        onDiscard={draft.discard}
      />
    </McPage>
  );
}
