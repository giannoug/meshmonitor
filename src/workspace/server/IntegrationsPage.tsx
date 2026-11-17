/**
 * Server › Integrations (boards 13-11 desktop, 13-27 phone): admins only, as
 * today's sections. Keys and connection fields keep their own Save and Test
 * (s13n1, KeyForm); every toggle and choice saves as you go in today's stored
 * format; each key is today's.
 *
 * - Message Translation: on/off, provider, both languages; the provider's
 *   fields (s13n5: LibreTranslate, OpenAI, DeepL, Google) with Test (today's
 *   check, `useTranslationTest`, Rule X) and Save.
 * - Flight matching (ADS-B): on/off and feed (OpenSky only with both
 *   credentials, as today); client ID, secret and API key with their Save.
 * - Elevation / Terrain: on/off; the source URL with Test and Save.
 * - MeshWars: on/off and source, read from today's status route; the key is
 *   never read back (Save sends it only when typed) and the URL has its Save.
 * - Feeds and overlays: ATAK / CoT (on/off, port), Virtual Node replay (on/off,
 *   excluded IPs), ducting overlay and MQTT root directory refresh.
 * On phone ADS-B, Elevation and MeshWars are pages of their own (s13n7).
 *
 * Mesh impact: none. Each integration runs on the MeshMonitor server and
 * talks to its own service (DeepL, adsb.lol, NOAA, api.meshtastic.org,
 * MeshWars); Virtual Node replay travels only the local link to the phone app.
 * Saving the CoT feed's switch or port restarts the feed, as today's Save did.
 */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useTranslationTest } from '../../components/configuration/useTranslationTest';
import apiService from '../../services/api';
import { DEFAULT_TERRARIUM_URL } from '../../types/elevation';
import { STANDARD_LANGUAGES, type TranslationProvider } from '../../types/translation';
import {
  DEFAULT_TRANSLATION_PROVIDER,
  getTranslationProviderFields,
  isTranslationProvider,
  TRANSLATION_PROVIDER_DESCRIPTORS,
  TRANSLATION_PROVIDER_IDS,
  type TranslationProviderFieldValues,
} from '../../types/translationProviders';
import { ADSB_FEED_IDS, ADSB_FEEDS, DEFAULT_ADSB_FEED, isAdsbFeed } from '../../utils/adsbFeeds';
import { logger } from '../../utils/logger';
import StateView from '../patterns/StateView';
import TwoLineRow from '../patterns/TwoLineRow';
import SettingGroup from '../settings/kit/SettingGroup';
import { AutoNumber, AutoSelect, AutoText, AutoToggle } from '../settings/categories/autosave';
import { Warn } from '../settings/categories/RowParts';
import { useServerSettings } from '../settings/useAutosaveSetting';
import { useIsPhone } from '../shell/useIsPhone';
import KeyForm, { type TestResult } from './KeyForm';
import { useRefreshSettings, useSaveSettings } from './settingsWrites';
import ServerFrame from './ServerFrame';
import { StatusSelect, StatusToggle } from './statusRows';
import pages from '../settings/categories/SettingsPages.module.css';
import prefs from '../you/preferences/Preferences.module.css';
import you from '../you/YouHome.module.css';
import styles from './Server.module.css';

const MW_KEY = ['workspace', 'meshwars', 'status'];
const ONCE = { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } as const;

const trueFalse = { parse: (raw?: string) => raw === 'true', serialize: (v: boolean) => (v ? 'true' : 'false') };
const oneZero = { parse: (raw?: string) => raw === '1' || raw === 'true', serialize: (v: boolean) => (v ? '1' : '0') };

export default function IntegrationsPage() {
  const isPhone = useIsPhone();
  return (
    <IntegrationsFrame>
      {isPhone ? (
        <>
          <TranslationGroup />
          <ServiceLinks />
          <FeedsGroup />
          <KeysNote />
        </>
      ) : (
        <div className={prefs.columns}>
          <div className={prefs.column}>
            <TranslationGroup />
            <AdsbGroup />
            <ElevationGroup />
          </div>
          <div className={prefs.column}>
            <MeshWarsGroup />
            <FeedsGroup />
            <KeysNote />
          </div>
        </div>
      )}
    </IntegrationsFrame>
  );
}

function KeysNote() {
  const { t } = useTranslation();
  return (
    <p className={styles.pageNote}>
      <UiIcon name="info" size={16} />
      <span>{t('workspace.server.keys_note')}</span>
    </p>
  );
}

export function IntegrationsFrame({ title, children, back }: { title?: string; children: ReactNode; back?: { label: string; to: string } }) {
  const { t } = useTranslation();
  return (
    <ServerFrame
      categoryId="integrations"
      title={title ?? t('workspace.server.nav.integrations')}
      scope={t('workspace.server.integrations_scope')}
      icon="package"
      gate="admin"
      back={back}
    >
      {children}
    </ServerFrame>
  );
}

/** Phone (s13n7): ADS-B, Elevation and MeshWars open their own pages. */
function ServiceLinks() {
  const { t } = useTranslation();
  const { data = {} } = useServerSettings();
  const state = (on: boolean) => (on ? t('workspace.server.on') : t('workspace.server.off'));
  const row = (to: string, icon: UiIconName, title: string, subtitle: string) => (
    <TwoLineRow
      to={`/server/integrations/${to}`}
      leading={
        <span className={styles.serviceIcon}>
          <UiIcon name={icon} size={20} />
        </span>
      }
      title={title}
      subtitle={subtitle}
      trailing={<UiIcon name="chevronRight" size={18} />}
    />
  );
  const feed = isAdsbFeed(data.adsbFeed) ? data.adsbFeed : DEFAULT_ADSB_FEED;
  return (
    <SettingGroup title={t('workspace.server.services')}>
      <div className={you.card}>
        {row('adsb', 'aircraft', t('settings.adsb_section', 'Flight matching (ADS-B)'), `${state(data.adsbMatchEnabled === 'true')} · ${ADSB_FEEDS[feed].name}`)}
        {row('elevation', 'altitude', t('settings.elevation_section', 'Elevation / Terrain'), `${state(data.elevationEnabled !== 'false')} · ${data.elevationSourceUrl || DEFAULT_TERRARIUM_URL}`)}
        {row('meshwars', 'target', t('settings.meshwars.title', 'MeshWars'), state(data.meshwarsEnabled === 'true'))}
      </div>
    </SettingGroup>
  );
}

export function TranslationGroup() {
  const { t } = useTranslation();
  const refresh = useRefreshSettings();
  return (
    <SettingGroup title={t('settings.translation_section', 'Message Translation')}>
      <AutoToggle
        k="translationEnabled"
        id="integrations.translationEnabled"
        label={t('settings.translation_enabled', 'Enable Message Translation')}
        help={t('settings.translation_section_desc', 'Configure inline on-demand translation for mesh and direct messages. When enabled, translation actions are shown on incoming and outgoing chat messages.')}
        parse={(raw) => raw === 'true' || raw === '1'}
        serialize={(v) => (v ? 'true' : 'false')}
        onSaved={refresh}
        render={(on) => on && <TranslationRows />}
      />
    </SettingGroup>
  );
}

function TranslationRows() {
  const { t } = useTranslation();
  const refresh = useRefreshSettings();
  const { data = {} } = useServerSettings();
  const provider: TranslationProvider = isTranslationProvider(data.translationProvider) ? data.translationProvider : DEFAULT_TRANSLATION_PROVIDER;
  const languages = STANDARD_LANGUAGES.map((l) => ({ value: l.code, label: `${l.name} (${l.code})` }));
  return (
    <>
      <AutoSelect
        k="translationProvider"
        id="integrations.translationProvider"
        label={t('settings.translation_provider', 'Translation Provider')}
        options={TRANSLATION_PROVIDER_IDS.map((id) => ({ value: id, label: t(TRANSLATION_PROVIDER_DESCRIPTORS[id].labelKey) }))}
        parse={(raw) => (isTranslationProvider(raw) ? raw : DEFAULT_TRANSLATION_PROVIDER)}
        onSaved={refresh}
      />
      <AutoSelect
        k="translationDefaultLanguage"
        id="integrations.translationDefaultLanguage"
        label={t('settings.translation_default_lang', 'Primary / Local Language (Incoming messages)')}
        help={t('settings.translation_default_lang_desc', 'Your language. Incoming foreign messages will be translated into this language.')}
        options={languages}
        parse={(raw) => raw || 'en'}
        onSaved={refresh}
      />
      <AutoSelect
        k="translationDefaultOutgoingLanguage"
        id="integrations.translationDefaultOutgoingLanguage"
        label={t('settings.translation_default_outgoing_lang', 'Default Foreign Language (Outgoing composer)')}
        help={t('settings.translation_default_outgoing_lang_desc', 'When translating an outgoing message in the composer, this language will be selected by default.')}
        options={languages}
        parse={(raw) => raw || 'ja'}
        onSaved={refresh}
      />
      <ProviderKeys key={provider} provider={provider} stored={data} incoming={data.translationDefaultLanguage ?? ''} outgoing={data.translationDefaultOutgoingLanguage ?? ''} />
    </>
  );
}

/** The provider's fields with today's Test and their own Save. */
function ProviderKeys({ provider, stored, incoming, outgoing }: { provider: TranslationProvider; stored: Record<string, string>; incoming: string; outgoing: string }) {
  const { t } = useTranslation();
  const fields = getTranslationProviderFields(provider);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const values = { ...stored, ...typed } as TranslationProviderFieldValues;
  const { testing, testResult, handleTest } = useTranslationTest(provider, values, incoming, outgoing);
  const result: TestResult | null = testResult && {
    ok: testResult.success,
    message: testResult.success
      ? `${t('settings.translation_test_success')} ${t('workspace.server.translation_sample', { text: testResult.sample ?? '' })}`
      : testResult.message,
  };
  return (
    <KeyForm
      name={t(TRANSLATION_PROVIDER_DESCRIPTORS[provider].labelKey)}
      fields={fields.map((f) => ({
        k: f.settingKey,
        label: t(f.labelKey),
        required: f.required,
        help: 'hintKey' in f ? t(f.hintKey) : undefined,
        placeholder: 'placeholderKey' in f ? t(f.placeholderKey) : f.placeholder,
        secret: f.kind === 'secret',
      }))}
      onValues={setTyped}
      test={() => handleTest()}
      testLabel={testing ? t('settings.translation_testing', 'Testing...') : t('settings.translation_test_btn', 'Test Connection')}
      result={result}
    />
  );
}

export function AdsbGroup() {
  const { t } = useTranslation();
  const refresh = useRefreshSettings();
  const { data = {} } = useServerSettings();
  const on = data.adsbMatchEnabled === 'true';
  const feed = isAdsbFeed(data.adsbFeed) ? data.adsbFeed : DEFAULT_ADSB_FEED;
  // OpenSky has no anonymous mode (#5877): selectable once both credentials are stored.
  const openSkyCredsSet = !!data.adsb_opensky_client_id?.trim() && !!data.adsb_opensky_client_secret?.trim();
  const terms =
    feed === 'adsb.fi'
      ? t('settings.adsb_feed_terms_adsb_fi', 'adsb.fi: for personal, non-commercial use only.')
      : feed === 'opensky'
        ? t('settings.adsb_feed_terms_opensky', 'OpenSky Network: non-commercial and research use only. Matches credit "Data: The OpenSky Network". No aircraft type or registration.')
        : t('settings.adsb_feed_terms_adsb_lol', 'adsb.lol: open data under the ODbL.');
  return (
    <SettingGroup title={t('settings.adsb_section', 'Flight matching (ADS-B)')}>
      <p className={styles.cardPara}>
        {t('settings.adsb_section_description', 'When a node becomes a likely aircraft, MeshMonitor asks the selected public ADS-B feed which aircraft is at that spot. Two lookups per flagging, then up to six re-checks as the node moves. Nothing is sent over the mesh.')}
      </p>
      <AutoToggle
        k="adsbMatchEnabled"
        id="integrations.adsbMatchEnabled"
        label={t('settings.adsb_enabled_label', 'Look up likely aircraft on a public ADS-B feed')}
        help={t('settings.adsb_enabled_description', "Off by default. When on, MeshMonitor sends the flagged node's approximate position to the feed over HTTPS. A match only confirms; no match never clears the likely-aircraft flag.")}
        {...trueFalse}
        onSaved={refresh}
      />
      <AutoSelect
        k="adsbFeed"
        id="integrations.adsbFeed"
        label={t('settings.adsb_feed_label', 'Feed')}
        help={
          <>
            {terms}
            {feed === 'opensky' && !openSkyCredsSet && (
              <Warn>{t('settings.adsb_opensky_creds_missing', 'OpenSky Network needs both a client ID and a client secret. Saving will fail until both are set.')}</Warn>
            )}
          </>
        }
        options={ADSB_FEED_IDS.map((id) => ({
          value: id,
          label:
            id === 'opensky' && !openSkyCredsSet
              ? t('settings.adsb_feed_opensky_needs_creds', '{{name}} (needs client ID and secret)', { name: ADSB_FEEDS[id].name })
              : ADSB_FEEDS[id].name,
          disabled: id === 'opensky' && !openSkyCredsSet && feed !== 'opensky',
        }))}
        parse={(raw) => (isAdsbFeed(raw) ? raw : DEFAULT_ADSB_FEED)}
        disabled={!on}
        onSaved={refresh}
      />
      <KeyForm
        name={t('workspace.server.credentials')}
        disabled={!on}
        fields={[
          {
            k: 'adsb_opensky_client_id',
            label: t('settings.adsb_opensky_client_id_label', 'OpenSky client ID'),
            help: t('settings.adsb_opensky_client_id_description', 'Needed only for the OpenSky Network feed. Create an API client under your OpenSky account. Stored server-side and never shown to non-admins.'),
          },
          { k: 'adsb_opensky_client_secret', label: t('settings.adsb_opensky_client_secret_label', 'OpenSky client secret'), secret: true },
          {
            k: 'adsb_api_token',
            label: t('settings.adsb_api_key_label', 'API key (optional)'),
            help: t('settings.adsb_api_key_description', "Leave empty. Kept for adsb.lol's announced future key; sent only when set. Stored server-side and never shown to non-admins."),
            secret: true,
          },
        ]}
      />
    </SettingGroup>
  );
}

export function ElevationGroup() {
  const { t } = useTranslation();
  const refresh = useRefreshSettings();
  const [result, setResult] = useState<TestResult | null>(null);
  // Today's handleTestElevation: the URL as typed, else today's default source; one request.
  const test = async (values: Record<string, string>) => {
    setResult(null);
    const trimmed = values.elevationSourceUrl.trim();
    const usedDefault = trimmed.length === 0;
    try {
      const r = await apiService.testElevationSource(usedDefault ? DEFAULT_TERRARIUM_URL : trimmed);
      setResult(
        r.success
          ? {
              ok: true,
              message:
                t('settings.elevation_test_success', 'OK — {{type}}, {{elev}} m in {{ms}} ms', { type: r.detectedType, elev: r.sampleElevation ?? 'n/a', ms: r.latencyMs }) +
                (usedDefault ? ` ${t('settings.elevation_test_default_source_suffix', '(default source)')}` : ''),
            }
          : { ok: false, message: r.error ?? t('settings.elevation_test_failure_generic', 'Test failed') },
      );
    } catch (error) {
      logger.error('Failed to test elevation source:', error);
      setResult({ ok: false, message: error instanceof Error ? error.message : String(error) });
    }
  };
  return (
    <SettingGroup title={t('settings.elevation_section', 'Elevation / Terrain')}>
      <p className={styles.cardPara}>
        {t('settings.elevation_section_description', "Powers the Map Analysis Link Profile tool's terrain chart. Elevation samples are fetched server-side from a public AWS Terrarium DEM tile source by default; you can point it at a different source below.")}
      </p>
      <AutoToggle
        k="elevationEnabled"
        id="integrations.elevationEnabled"
        label={t('settings.elevation_enabled_label', 'Enable terrain elevation')}
        help={t('settings.elevation_enabled_description', "Turns off the Link Profile tool's terrain chart when disabled.")}
        parse={(raw) => raw !== 'false'}
        serialize={(v) => (v ? 'true' : 'false')}
        onSaved={refresh}
      />
      <KeyForm
        name={t('settings.elevation_source_url_label', 'Elevation Source URL')}
        fields={[
          {
            k: 'elevationSourceUrl',
            label: t('settings.elevation_source_url_label', 'Elevation Source URL'),
            help: t('settings.elevation_source_url_description', 'Leave empty to use the default public AWS Terrarium source.'),
            placeholder: DEFAULT_TERRARIUM_URL,
          },
        ]}
        test={test}
        result={result}
      />
    </SettingGroup>
  );
}

interface MeshWarsStatus {
  enabled: boolean;
  sourceId: string;
  baseUrl: string;
  apiKeySet: boolean;
  lastForwardAt: number | null;
  lastResult: { ok: boolean; repeaters: number; error?: string } | null;
  minForwardIntervalMs: number;
}

export function MeshWarsGroup() {
  const { t } = useTranslation();
  const title = t('settings.meshwars.title', 'MeshWars');
  const q = useQuery({ queryKey: MW_KEY, queryFn: async () => (await apiService.get<{ data: MeshWarsStatus }>('/api/settings/meshwars/status')).data, ...ONCE });
  const sources = useQuery({
    queryKey: ['workspace', 'meshwars', 'sources'],
    // Only a MeshCore radio correlates the repeaters that heard its sends.
    queryFn: async () => {
      const all = await apiService.get<Array<{ id: string; name: string; type?: string }>>('/api/sources');
      return (Array.isArray(all) ? all : []).filter((s) => s.type === 'meshcore');
    },
    ...ONCE,
  });
  const s = q.data;
  if (q.isError) return <SettingGroup title={title}><StateView kind="error" onRetry={() => void q.refetch()} /></SettingGroup>;
  if (!s) return <SettingGroup title={title}><StateView kind="loading" /></SettingGroup>;
  const cooldown = Math.round((s.minForwardIntervalMs ?? 300_000) / 60_000);
  return (
    <SettingGroup title={title}>
      <p className={styles.cardPara}>
        {t('settings.meshwars.description', "Plays MeshWars with your MeshCore radio. When repeaters re-flood a channel message you send, MeshMonitor reports your radio's position and the repeaters that heard it, the same way the MeshMapper app does. Register at MeshWars to get an API key.")}
      </p>
      <StatusToggle id="integrations.meshwarsEnabled" label={t('settings.meshwars.enable', 'Send to MeshWars')} value={s.enabled} body={(v) => ({ meshwarsEnabled: String(v) })} queryKey={MW_KEY} />
      <StatusSelect
        id="integrations.meshwarsSourceId"
        label={t('settings.meshwars.source', 'MeshCore source')}
        help={<Warn>{t('settings.meshwars.location_warning', { cooldown, defaultValue: `Sends this radio's position to MeshWars, at most once every ${cooldown} minutes. Nothing extra is sent over the mesh.` })}</Warn>}
        value={s.sourceId}
        options={[{ value: '', label: t('settings.meshwars.choose_source', 'Choose a source') }, ...(sources.data ?? []).map((src) => ({ value: src.id, label: src.name }))]}
        body={(v) => ({ meshwarsSourceId: v })}
        queryKey={MW_KEY}
        disabled={!s.enabled}
      />
      <MeshWarsKey status={s} />
      <p className={styles.cardPara}>
        {t('settings.meshwars.last_sent', 'Last sent')}: {s.lastForwardAt ? new Date(s.lastForwardAt).toLocaleString() : t('settings.meshwars.never', 'never')}
        {s.lastResult && (
          <>
            {' · '}
            {s.lastResult.ok
              ? t('settings.meshwars.last_ok', { count: s.lastResult.repeaters, defaultValue: `Accepted, ${s.lastResult.repeaters} repeater(s) heard` })
              : t('settings.meshwars.last_failed', { error: s.lastResult.error ?? '', defaultValue: `Not sent: ${s.lastResult.error ?? ''}` })}
          </>
        )}
      </p>
    </SettingGroup>
  );
}

/** Today's key and URL: the key is never read back; Save sends the URL, and the key only when one is typed. */
function MeshWarsKey({ status }: { status: MeshWarsStatus }) {
  const { t } = useTranslation();
  const save = useSaveSettings();
  const [key, setKey] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ saved: boolean; error?: string }>({ saved: false });
  const off = !status.enabled;
  const typedUrl = url ?? status.baseUrl;
  const changed = typedUrl.trim() !== status.baseUrl || key.trim() !== '';
  const onSave = async () => {
    setBusy(true);
    try {
      await save({ meshwarsBaseUrl: typedUrl.trim(), ...(key.trim() ? { meshwars_api_token: key.trim() } : {}) });
      setKey('');
      setUrl(null);
      setState({ saved: true });
    } catch (error) {
      setState({ saved: false, error: error instanceof Error && error.message ? error.message : t('settings.meshwars.save_failed', 'Failed to save') });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={pages.infoLabel}>{t('settings.meshwars.api_key', 'MeshWars API key')}</span>
        <input
          type="password"
          className={pages.keyInput}
          autoComplete="off"
          value={key}
          disabled={off}
          placeholder={status.apiKeySet ? t('settings.meshwars.key_saved', 'Saved. Enter a new key to replace it.') : ''}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={pages.infoLabel}>{t('settings.meshwars.url', 'MeshWars URL')}</span>
        <span className={pages.infoHelp}>{t('settings.meshwars.url_help', 'Change only if you play on a self-hosted MeshWars server.')}</span>
        <input type="url" className={pages.keyInput} spellCheck={false} value={typedUrl} disabled={off} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <div className={styles.formActions}>
        {state.error && (
          <span className={pages.error} role="alert">
            <UiIcon name="alert" size={14} />
            {state.error}
          </span>
        )}
        {state.saved && <span className={pages.infoHelp} role="status">{t('workspace.settings.saved')}</span>}
        <button type="button" className={`${pages.button} ${pages.primary}`} disabled={off || busy || !changed} onClick={() => void onSave()}>
          {busy ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

function FeedsGroup() {
  const { t } = useTranslation();
  const refresh = useRefreshSettings();
  return (
    <SettingGroup title={t('workspace.server.feeds')}>
      <h3 className={styles.subTitle}>{t('settings.atak_cot_section', 'ATAK / CoT Feed')}</h3>
      <AutoToggle
        k="cotFeedEnabled"
        id="integrations.cotFeedEnabled"
        label={t('settings.atak_cot_enabled_label', 'Enable CoT feed')}
        help={
          <>
            {t('settings.atak_cot_section_description', 'Streams mesh node positions and ATAK contacts to ATAK/WinTAK clients over a plaintext TCP Cursor-on-Target feed (add MeshMonitor as a network input in ATAK).')}{' '}
            {t('settings.atak_cot_enabled_description', 'No encryption or authentication — use only on a trusted network.')}
          </>
        }
        {...oneZero}
        render={(on) => (
          <AutoNumber
            k="cotFeedPort"
            id="integrations.cotFeedPort"
            label={t('settings.atak_cot_port_label', 'Feed port')}
            help={t('settings.atak_cot_port_description', 'TCP port ATAK/WinTAK clients connect to. Default 8088.')}
            min={1}
            max={65535}
            parse={(raw) => {
              const n = parseInt(raw || '8088', 10);
              return Number.isFinite(n) && n > 0 ? n : 8088;
            }}
            disabled={!on}
          />
        )}
      />
      <h3 className={styles.subTitle}>{t('settings.vn_replay_section', 'Virtual Node message replay')}</h3>
      <AutoToggle
        k="virtualNodeReplayEnabled"
        id="integrations.virtualNodeReplayEnabled"
        label={t('settings.vn_replay_enabled_label', 'Replay missed messages on reconnect')}
        help={
          <>
            {t('settings.vn_replay_section_description', 'When a phone app reconnects to a Virtual Node, re-send the text messages stored while it was asleep (since its last sign of life, minus a 10-minute overlap). The app drops duplicates by packet id, so no gaps and no duplicates. No LoRa airtime — this only travels the local link to the app. Paced 50 ms apart, up to 2000 newest messages; the first connection sends the last 24 hours.')}{' '}
            {t('settings.vn_replay_enabled_description', 'Opt-in; off by default. Applies to every Virtual Node source.')}
          </>
        }
        {...oneZero}
        render={(on) => (
          <AutoText
            k="virtualNodeReplayExcludeIps"
            id="integrations.virtualNodeReplayExcludeIps"
            label={t('settings.vn_replay_exclude_ips_label', 'Never replay to these IPs')}
            help={t('settings.vn_replay_exclude_ips_description', 'Comma-separated client IPs that never receive a replay (scripts, loggers). Localhost is always excluded. Overrides the VN_REPLAY_EXCLUDE_IPS environment variable when set.')}
            placeholder="192.168.1.50, 10.0.0.9"
            parse={(raw) => raw ?? ''}
            serialize={(v) => v.trim()}
            disabled={!on}
          />
        )}
      />
      <h3 className={styles.subTitle}>{t('settings.ducting_section', 'Tropospheric ducting overlay')}</h3>
      <AutoToggle
        k="ductingOverlayEnabled"
        id="integrations.ductingOverlayEnabled"
        label={t('settings.ducting_enabled_label', 'Enable the ducting overlay (contacts NOAA)')}
        help={
          <>
            {t('settings.ducting_section_description', 'Adds a Ducting overlay to the Map tab and the Dashboard map: a NOAA GFS forecast of where the lower atmosphere bends radio signals further than usual, now and up to 72 hours ahead. While on, anyone who can view the map can use it. Each forecast step a viewer opens that the server has not cached yet costs one HTTPS request to NOAA (at most 25 per 6-hour GFS cycle). Nothing is sent over the mesh.')}{' '}
            {t('settings.ducting_enabled_description', 'Off by default. While off, the map toggle is hidden and the server makes no NOAA requests for anyone.')}
          </>
        }
        {...trueFalse}
        onSaved={refresh}
      />
      <h3 className={styles.subTitle}>{t('settings.mqtt_root_directory_section', 'MQTT root directory refresh')}</h3>
      <AutoToggle
        k="mqttRootDirectoryRefreshEnabled"
        id="integrations.mqttRootDirectoryRefreshEnabled"
        label={t('settings.mqtt_root_directory_enabled_label', 'Refresh the community root list (contacts api.meshtastic.org)')}
        help={
          <>
            {t('settings.mqtt_root_directory_section_description', "The MQTT topic finder suggests community roots from a list bundled with MeshMonitor. While on, a topic search may also fetch the current list from api.meshtastic.org, at most once a day. The request is a plain GET with no location, broker, topic or user details, but it tells api.meshtastic.org (and Cloudflare, which serves it) this server's IP address and that someone used the finder. Nothing is sent over the mesh.")}{' '}
            {t('settings.mqtt_root_directory_enabled_description', 'Off by default. While off, the finder uses only the bundled list and the server makes no requests for it.')}
          </>
        }
        {...trueFalse}
      />
    </SettingGroup>
  );
}
