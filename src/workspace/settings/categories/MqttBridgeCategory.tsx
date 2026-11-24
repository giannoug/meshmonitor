/**
 * In MeshMonitor › MQTT bridge (boards 12-13 / 12-24, Task 5.8): an
 * mqtt_bridge source's bridge setup on the row kit. State, requests and the
 * save are today's, shared with MqttBridgeConfigurationView through
 * useMqttBridgeConfig (Rule X); the broker preset choice through
 * useBrokerPresetChoice; Save as preset and Manage saved presets open the
 * saved broker preset sheets (17-08, BrokerPresetsSheet).
 *
 * - Desktop: Connection and Subscribe on the left; Publish, Forwarding and
 *   Topic rewrites on the right. Phone: Connection, then one summary row per
 *   group that opens it in a sheet.
 * - Its own Save, in the page's dock ("N changes · Save bridge settings"):
 *   saving is one PUT of the source and reconnects the upstream broker, so it
 *   is never saved as you go and is not on the radio queue. The page claims
 *   the dock while it has changes (D9c).
 * - The geo filter's status comes from the shell's live per-device status
 *   read (the same query), so this page adds no status request.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import BBoxMapEditor from '../../../components/BBoxMapEditor';
import { UiIcon } from '../../../components/icons';
import { MqttRootFieldError } from '../../../components/MQTT/MqttRootFieldError';
import { MqttRootFinder } from '../../../components/MQTT/MqttRootFinder';
import { applyRootToSubscriptions, defaultBridgeRegionRoot } from '../../../components/MQTT/mqttRootDefaults';
import { BROKER_DISCOVERY_LINKS, matchBridgePreset } from '../../../components/MQTT/brokerPresets';
import { BRIDGE_FORWARDING_MODES, BRIDGE_MODES, type BridgeConfigForm, type UplinkTopicMode } from '../../../components/MQTT/mqttBridgeConfig';
import { useBrokerPresetChoice } from '../../../components/MQTT/useBrokerPresetChoice';
import { GEO_KEYS, bboxFromForm, brokerGatewayClientId, useMqttBridgeConfig, type MqttBridgeConfig } from '../../../components/MQTT/useMqttBridgeConfig';
import { bboxToFormStrings } from '../../../pages/DashboardPage.bboxSeed';
import { formatRelativeTime } from '../../../utils/datetime';
import BrokerPresetsSheet from '../../misc/BrokerPresetsSheet';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingSelect from '../kit/SettingSelect';
import SettingText from '../kit/SettingText';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../kit/useFieldRegistry';
import { useClaimDock, useSettingsHeader } from '../settingsDock';
import type { CategoryProps } from '../categories';
import { SettingPassword, Warn } from './RowParts';
import pages from './SettingsPages.module.css';
import bar from '../RadioSaveBar.module.css';
import styles from './MqttBridge.module.css';

type Group = 'subscribe' | 'publish' | 'forwarding' | 'rewrites';
/** The board's compass names for the box's four edges. */
const EDGE: Record<(typeof GEO_KEYS)[number], string> = { maxLat: 'north', minLat: 'south', minLng: 'west', maxLng: 'east' };

export default function MqttBridgeCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const b = useMqttBridgeConfig(sourceId);
  const [open, setOpen] = useState<Group | null>(null);
  useSettingsHeader({
    scope: t(isPhone ? 'workspace.settings.mqtt_bridge.own_save_short' : 'workspace.settings.mqtt_bridge.own_save'),
    phoneTitle: t('workspace.settings.mqtt_bridge.phone_title'),
  });
  useClaimDock(b.hasChanges);

  if (b.loading) return <StateView kind="loading" />;
  if (b.loadError) return <StateView kind="error" detail={b.loadError} />;

  const groups: Record<Group, { title: string; summary: string; body: ReactNode; shown: boolean }> = {
    subscribe: { title: t('mqtt_bridge_config.section_subscribe', 'Subscribe (incoming)'), summary: subscribeSummary(t, b.form), body: <SubscribeRows b={b} sourceId={sourceId} />, shown: true },
    publish: { title: t('mqtt_bridge_config.section_publish', 'Publish (outgoing)'), summary: publishSummary(t, b.form), body: <PublishRows b={b} />, shown: true },
    forwarding: { title: t('mqtt_bridge_config.section_forwarding', 'Forwarding'), summary: forwardingSummary(t, b.form), body: <ForwardingRows b={b} />, shown: true },
    rewrites: { title: t('mqtt_bridge_config.section_rewrites', 'Topic rewrites'), summary: rewritesSummary(t, b.form), body: <RewriteRows b={b} />, shown: !!b.form.brokerId },
  };
  const order: Group[] = ['subscribe', 'publish', 'forwarding', 'rewrites'];

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {!b.canWrite && (
        <p className={pages.note} role="status">
          <UiIcon name="info" size={16} />
          <span>{t('mqtt_bridge_config.read_only', 'You can view this bridge setup but not change it: that needs the Sources write permission.')}</span>
        </p>
      )}
      {isPhone ? (
        <>
          <SettingGroup title={t('mqtt_bridge_config.section_connection', 'Connection')}>
            <ConnectionRows b={b} />
          </SettingGroup>
          <section className={styles.summaries}>
            {order
              .filter((g) => groups[g].shown)
              .map((g) => (
                <button key={g} type="button" className={styles.summaryRow} onClick={() => setOpen(g)}>
                  <UiIcon name="chevronRight" size={18} />
                  <span className={styles.summaryText}>
                    <span className={styles.summaryTitle}>{groups[g].title}</span>
                    <span className={styles.summarySub}>{groups[g].summary}</span>
                  </span>
                </button>
              ))}
          </section>
          <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? groups[open].title : ''} side="bottom">
            {/* The sheet portals out of the page's <main data-phone>, so it says phone itself (D8). */}
            <div className={styles.sheetBody} data-phone="">
              {open && groups[open].body}
            </div>
          </Sheet>
        </>
      ) : (
        <div className={styles.columns}>
          <div className={styles.column}>
            <SettingGroup title={t('mqtt_bridge_config.section_connection', 'Connection')}>
              <ConnectionRows b={b} />
            </SettingGroup>
            <SettingGroup title={groups.subscribe.title}>{groups.subscribe.body}</SettingGroup>
          </div>
          <div className={styles.column}>
            <SettingGroup title={groups.publish.title}>{groups.publish.body}</SettingGroup>
            <SettingGroup title={groups.forwarding.title}>{groups.forwarding.body}</SettingGroup>
            {groups.rewrites.shown && <SettingGroup title={groups.rewrites.title}>{groups.rewrites.body}</SettingGroup>}
          </div>
        </div>
      )}
      <Dock b={b} />
    </div>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function subscribeSummary(t: T, f: BridgeConfigForm): string {
  const topics = f.subscriptions.split('\n').map((x) => x.trim()).filter(Boolean);
  const blocked = f.useTopicBlock ? f.topicBlock.split('\n').map((x) => x.trim()).filter(Boolean).length : 0;
  return [
    topics[0] ?? t('workspace.settings.mqtt_bridge.no_topics'),
    blocked > 0 && t('workspace.settings.mqtt_bridge.blocked', { count: blocked }),
    f.useGeo && t('workspace.settings.mqtt_bridge.geo_on'),
  ]
    .filter(Boolean)
    .join(' · ');
}

function publishSummary(t: T, f: BridgeConfigForm): string {
  const channels = f.uplinkChannels ?? [];
  const mode = f.uplinkTopicMode ?? 'off';
  return [
    channels.length ? t('workspace.settings.mqtt_bridge.uplink_channels', { names: channels.join(', ') }) : t('workspace.settings.mqtt_bridge.uplink_all'),
    mode !== 'off' && t(`workspace.settings.mqtt_bridge.topic_${mode}`),
  ]
    .filter(Boolean)
    .join(' · ');
}

function forwardingSummary(t: T, f: BridgeConfigForm): string {
  const on = [f.ignoreOkToMqtt, f.skipRaise, f.relayOtherBridges, f.dropAutomationUplinks].filter(Boolean).length;
  return [
    t(`source.form.mqtt_bridge_mode_${f.mode}`, f.mode),
    f.dropAutomationUplinks && t('workspace.settings.mqtt_bridge.drops_automation'),
    t('workspace.settings.mqtt_bridge.switches_on', { count: on }),
  ]
    .filter(Boolean)
    .join(' · ');
}

function rewritesSummary(t: T, f: BridgeConfigForm): string {
  const pairs = [f.downlinkRewrite, f.uplinkRewrite].filter((r) => r && (r.from || r.to)) as Array<{ from: string; to: string }>;
  if (pairs.length === 0) return t('workspace.settings.mqtt_bridge.rewrites_off');
  return pairs.map((r) => t('workspace.settings.mqtt_bridge.rewrite', { from: r.from, to: r.to })).join(' · ');
}

/** A multi-line field at the kit's metrics, named by its row. */
function SettingArea({ value, onChange, placeholder }: { value: string; onChange(v: string): void; placeholder?: string }) {
  const row = useSettingRow();
  return (
    <textarea
      id={row?.inputId}
      aria-describedby={row?.helpId}
      className={styles.textarea}
      rows={3}
      spellCheck={false}
      value={value}
      placeholder={placeholder}
      disabled={useReadOnly()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function ConnectionRows({ b }: { b: MqttBridgeConfig }) {
  const { t } = useTranslation();
  const presets = useBrokerPresetChoice({
    matchPreset: (candidates) => matchBridgePreset(b.form.url, candidates),
    onApplyPreset: b.applyBrokerPreset,
    getDraft: b.getPresetDraft,
  });
  const f = b.form;
  const gateway = brokerGatewayClientId(b.brokers.find((x) => x.id === f.brokerId));
  const keptPreset = presets.keptPreset;
  return (
    <>
      <SettingRow stacked
        id="mqtt-bridge.brokerPreset"
        label={t('mqtt_presets.label', 'Broker preset')}
        help={
          <>
            <span className={pages.block}>
              {t('mqtt_presets.description', 'Fills in the broker address, TLS and login. Nothing is sent until you save.')}
            </span>
            {presets.keptKey && keptPreset && (
              <span className={pages.block} role="status" data-testid="broker-preset-kept">
                {t(presets.keptKey, presets.keptFallbacks[presets.keptKey], {
                  username: keptPreset.username,
                  password: keptPreset.password,
                  name: keptPreset.label ?? keptPreset.labelFallback,
                })}
              </span>
            )}
            <span className={pages.block}>
              {t('mqtt_presets.discovery', 'Want a regional broker? Local groups publish their own. Find yours:')}{' '}
              <a className={pages.link} href={BROKER_DISCOVERY_LINKS.localGroups} target="_blank" rel="noopener noreferrer">
                {t('mqtt_presets.discovery_local_groups', 'Meshtastic Local Groups')}
              </a>
              {' · '}
              <a className={pages.link} href={BROKER_DISCOVERY_LINKS.siteGallery} target="_blank" rel="noopener noreferrer">
                {t('mqtt_presets.discovery_site_gallery', 'MeshMonitor Site Gallery')}
              </a>
            </span>
            <Warn tone="note">
              {t('mqtt_presets.privacy', 'Channels with uplink on publish their traffic to this broker. On a public broker, anyone on the internet can read it.')}
            </Warn>
          </>
        }
      >
        <SettingSelect
          value={presets.value}
          options={[...presets.options, ...presets.savedOptions].map((o) => ({ value: o.id, label: o.label, help: 'title' in o ? String(o.title) : undefined }))}
          onChange={presets.handleChange}
          readOnly={!b.canWrite || undefined}
        />
      </SettingRow>
      {presets.canManage && (
        <div className={pages.infoRow}>
          <span className={pages.infoText}>
            <span className={pages.infoHelp}>{t('mqtt_presets.saved.label', 'My saved presets')}</span>
          </span>
          <button
            type="button"
            className={pages.button}
            disabled={!b.canWrite || presets.currentDraft === null}
            title={presets.currentDraft === null ? t('mqtt_presets.saved.save_needs_host', 'Enter a broker address first.') : undefined}
            onClick={() => presets.setSaveDraft(presets.currentDraft)}
          >
            <UiIcon name="download" size={16} />
            {t('mqtt_presets.saved.save_as', 'Save as preset')}
          </button>
          <button type="button" className={pages.button} disabled={!b.canWrite} onClick={() => presets.setManageOpen(true)}>
            <UiIcon name="settings" size={16} />
            {t('mqtt_presets.saved.manage', 'Manage saved presets')}
          </button>
          <BrokerPresetsSheet
            saveDraft={presets.saveDraft}
            onCloseSave={() => presets.setSaveDraft(null)}
            passwordNotIncluded={b.passwordStored && f.password === ''}
            manageOpen={presets.manageOpen}
            onCloseManage={() => presets.setManageOpen(false)}
            presets={presets.savedRows}
          />
        </div>
      )}
      <SettingRow stacked
        id="mqtt-bridge.brokerId"
        label={t('source.form.mqtt_bridge_broker', 'Parent broker (optional)')}
        help={t(
          'source.form.mqtt_bridge_broker_help',
          'With a parent broker, the bridge also republishes upstream traffic to local devices and forwards their packets upstream. Without one, it runs as a pure MQTT client — useful for monitoring or as a client-proxy target for a Meshtastic source.',
        )}
      >
        <SettingSelect
          value={f.brokerId}
          options={[
            { value: '', label: t('source.form.mqtt_bridge_broker_none', 'None — standalone client proxy') },
            ...b.brokers.map((x) => ({ value: x.id, label: x.name })),
          ]}
          onChange={(v) => b.patch('brokerId', v)}
        />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.url" label={t('source.form.mqtt_upstream_url', 'Upstream URL')}>
        <SettingText mono value={f.url} onChange={(v) => b.patch('url', v)} placeholder="mqtt://mqtt.meshtastic.org:1883" />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.username" label={t('source.form.mqtt_username', 'Username')}>
        <SettingText value={f.username} onChange={(v) => b.patch('username', v)} />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.password" label={t('source.form.mqtt_password', 'Password')} help={t('mqtt_bridge_config.password_help', 'Leave blank to keep the stored password.')}>
        <SettingPassword value={f.password} onChange={(v) => b.patch('password', v)} />
      </SettingRow>
      <SettingRow stacked
        id="mqtt-bridge.mode"
        label={t('source.form.mqtt_bridge_mode', 'Mode')}
        help={t(
          'source.form.mqtt_bridge_mode_help',
          'Bidirectional brings the upstream server\'s traffic down to the parent broker (and from there to any radios with Downlink Enabled) and sends local traffic up. "Publish only" sends up and brings nothing down; use it for servers that reject SUBSCRIBE. "Subscribe only" brings traffic down and never sends anything up, for read-only monitoring.',
        )}
      >
        <SettingSelect
          value={f.mode}
          options={BRIDGE_MODES.map((m) => ({ value: m, label: t(`source.form.mqtt_bridge_mode_${m}`, m) }))}
          onChange={(v) => b.patch('mode', v as BridgeConfigForm['mode'])}
        />
      </SettingRow>
      <SettingRow stacked
        id="mqtt-bridge.forwardingMode"
        label={t('source.form.mqtt_bridge_forwarding_mode', 'Upstream identity')}
        help={
          <>
            {t(
              'source.form.mqtt_bridge_forwarding_help',
              'Per-gateway lets each local node publish upstream under its own !<hex> Client ID — required for community brokers that filter CONNECT on Client ID. Switch to Single only if the upstream broker has tight per-username connection caps.',
            )}
            {b.sharedUpstreamWarning && f.forwardingMode === 'per_gateway' && (
              <Warn>
                {t(
                  'source.form.mqtt_bridge_shared_upstream_warning',
                  'Another bridge source uses the same parent broker and upstream URL in per_gateway mode. Both connect with the same Client IDs, so the upstream broker will keep evicting one for the other. Keep one bridge per broker and upstream, or switch one to Single.',
                )}
              </Warn>
            )}
          </>
        }
      >
        <SettingSelect
          value={f.forwardingMode}
          options={BRIDGE_FORWARDING_MODES.map((m) => ({ value: m, label: t(`source.form.mqtt_bridge_forwarding_${m}`, m) }))}
          onChange={(v) => b.patch('forwardingMode', v as BridgeConfigForm['forwardingMode'])}
        />
      </SettingRow>
      {f.forwardingMode === 'single' && (
        <SettingRow stacked
          id="mqtt-bridge.clientId"
          label={t('source.form.mqtt_bridge_client_id', 'Upstream Client ID (optional)')}
          help={t('source.form.mqtt_bridge_client_id_help')}
        >
          <SettingText mono value={f.clientId ?? ''} onChange={(v) => b.patch('clientId', v)} placeholder={gateway ?? '!a1b2c3d4'} />
          {gateway && (
            <button type="button" className={pages.button} disabled={!b.canWrite || f.clientId === gateway} onClick={() => b.patch('clientId', gateway)}>
              {t('source.form.mqtt_bridge_client_id_use_gateway', "Use the parent broker's gateway ID")}
            </button>
          )}
        </SettingRow>
      )}
    </>
  );
}

function SubscribeRows({ b, sourceId }: { b: MqttBridgeConfig; sourceId: string }) {
  const { t } = useTranslation();
  const f = b.form;
  return (
    <>
      <SettingRow stacked id="mqtt-bridge.subscriptions" label={t('source.form.mqtt_subscriptions', 'Upstream topics (one per line)')}>
        <SettingArea value={f.subscriptions} onChange={(v) => b.patch('subscriptions', v)} />
      </SettingRow>
      <div className={pages.embedded}>
        {f.subscriptions
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.endsWith('/#') && !l.includes('+'))
          .map((l) => (
            <MqttRootFieldError key={l} warn value={l.slice(0, -2)} />
          ))}
        <MqttRootFinder
          context="bridge"
          sourceId={sourceId}
          disabled={!b.canWrite}
          currentRoot={f.subscriptions.split('\n')[0]?.trim() ?? ''}
          defaultRegionRoot={defaultBridgeRegionRoot(f.subscriptions)}
          getTarget={() =>
            f.url.trim()
              ? {
                  broker: { url: f.url },
                  username: f.username,
                  password: f.password,
                  brokerPresetId:
                    b.serverFillPreset?.savedId !== undefined && matchBridgePreset(f.url, [b.serverFillPreset]) ? b.serverFillPreset.savedId : null,
                }
              : null
          }
          onPickRoot={(root) => b.patch('subscriptions', applyRootToSubscriptions(f.subscriptions, root))}
        />
      </div>
      <SettingRow id="mqtt-bridge.useTopicBlock" label={t('source.form.mqtt_topic_block_enable', 'Block specific topics')}>
        <SettingToggle checked={f.useTopicBlock} onChange={(v) => b.patch('useTopicBlock', v)} />
      </SettingRow>
      {f.useTopicBlock && (
        <SettingRow stacked id="mqtt-bridge.topicBlock" label={t('source.form.mqtt_topic_block_label', 'Topics to drop (one per line, MQTT wildcards allowed)')}>
          <SettingArea value={f.topicBlock} onChange={(v) => b.patch('topicBlock', v)} placeholder="msh/CA/QC/#" />
        </SettingRow>
      )}
      <SettingRow id="mqtt-bridge.useGeo" label={t('source.form.mqtt_geo_enable', 'Restrict to geographic bounding box')}>
        <SettingToggle checked={f.useGeo} onChange={(v) => b.patch('useGeo', v)} />
      </SettingRow>
      {f.useGeo && (
        <>
          <div className={pages.embedded}>
            <BBoxMapEditor
              bbox={bboxFromForm(f.geo)}
              onChange={(next) => b.patch('geo', next ? bboxToFormStrings(next) : { minLat: '', maxLat: '', minLng: '', maxLng: '' })}
            />
          </div>
          {(['maxLat', 'minLat', 'minLng', 'maxLng'] as const).map((k) => (
            <SettingRow stacked key={k} id={`mqtt-bridge.geo.${k}`} label={t(`workspace.settings.mqtt_bridge.${EDGE[k]}`)}>
              <SettingText mono value={f.geo[k]} onChange={(v) => b.patch('geo', { ...f.geo, [k]: v })} />
            </SettingRow>
          ))}
        </>
      )}
      <div className={pages.infoRow}>
        <span className={pages.infoText}>
          <span className={pages.infoLabel}>{t('mqtt_bridge_config.geo_status.title', 'Geo filter status')}</span>
          <span className={pages.infoHelp}>
            {b.lastGeoSweep
              ? t('mqtt_bridge_config.geo_status.last_sweep', {
                  time: formatRelativeTime(b.lastGeoSweep.timestamp),
                  scanned: b.lastGeoSweep.scanned,
                  ignored: b.lastGeoSweep.ignored,
                  purged: b.lastGeoSweep.purged,
                  lifted: b.lastGeoSweep.lifted,
                  duration: b.lastGeoSweep.durationMs,
                })
              : t('mqtt_bridge_config.geo_status.no_sweep', 'No sweep has run yet.')}
          </span>
          <span className={pages.infoHelp}>
            {t('mqtt_bridge_config.geo_status.dropped_summary', { downlink: b.downlinkGeoDrops, uplink: b.uplinkGeoDrops })}
          </span>
          <span className={pages.infoHelp}>{t('mqtt_bridge_config.geo_status.dropped_note')}</span>
        </span>
      </div>
    </>
  );
}

function PublishRows({ b }: { b: MqttBridgeConfig }) {
  const { t } = useTranslation();
  const readOnly = useReadOnly();
  const f = b.form;
  const mode = f.uplinkTopicMode ?? 'off';
  return (
    <>
      <div className={styles.chipsHead} data-setting-id="mqtt-bridge.uplinkChannels">
        <span className={pages.infoLabel}>{t('source.form.mqtt_uplink_channels_label', 'Uplink only these channels')}</span>
        <span className={pages.infoHelp}>
          {t(
            'source.form.mqtt_uplink_channels_help',
            'Leave all unchecked to uplink every channel. Matched on the decoded channel name, regardless of MQTT topic format — the reliable way to uplink only specific channels (e.g. LongFast) while still receiving everything locally.',
          )}
        </span>
      </div>
      <div className={styles.chips} role="group" aria-label={t('source.form.mqtt_uplink_channels_label', 'Uplink only these channels')}>
        {b.channelOptions.length === 0 && (
          <span className={pages.infoHelp}>
            {t(
              'source.form.mqtt_uplink_channels_empty',
              'No channels known yet — they appear here as the bridge sees traffic. Add one manually below, or use the Advanced topic filter.',
            )}
          </span>
        )}
        {b.channelOptions.map((name) => {
          const on = b.selectedChannels.includes(name);
          return (
            <button
              key={name}
              type="button"
              className={styles.chip}
              aria-pressed={on}
              disabled={readOnly}
              onClick={() => b.toggleChannel(name, !on)}
            >
              {name}
              {on && <UiIcon name="close" size={14} />}
            </button>
          );
        })}
        <input
          type="text"
          className={styles.chipInput}
          aria-label={t('source.form.mqtt_uplink_channels_add', 'Add channel name…')}
          placeholder={t('source.form.mqtt_uplink_channels_add', 'Add channel name…')}
          value={b.customChannel}
          disabled={readOnly}
          onChange={(e) => b.setCustomChannel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              b.addCustomChannel();
            }
          }}
        />
        <button type="button" className={pages.button} disabled={readOnly || !b.customChannel.trim()} onClick={b.addCustomChannel}>
          {t('common.add', 'Add')}
        </button>
      </div>
      <SettingRow stacked
        id="mqtt-bridge.uplinkTopicMode"
        label={t('source.form.mqtt_uplink_topic_mode', 'Publish topic filter')}
        help={t(
          'source.form.mqtt_uplink_topic_help',
          'Raw topic-pattern filter on the outgoing publish topic (MQTT wildcards). Composes with the channel selection above — both must pass. Only needed for filtering by something other than channel.',
        )}
      >
        <SettingSelect
          value={mode}
          options={[
            { value: 'off', label: t('source.form.mqtt_uplink_topic_mode_off', 'Off — publish all subscribed topics') },
            { value: 'allow', label: t('source.form.mqtt_uplink_topic_mode_allow', 'Allow list — only publish matching topics') },
            { value: 'block', label: t('source.form.mqtt_uplink_topic_mode_block', 'Block list — publish all except matching topics') },
          ]}
          onChange={(v) => b.patch('uplinkTopicMode', v as UplinkTopicMode)}
        />
      </SettingRow>
      {mode !== 'off' && (
        <SettingRow stacked id="mqtt-bridge.uplinkTopics" label={t('source.form.mqtt_uplink_topics_label', 'Publish topics (one per line, MQTT wildcards allowed)')}>
          <SettingArea value={f.uplinkTopics ?? ''} onChange={(v) => b.patch('uplinkTopics', v)} placeholder="msh/US/FL/+/+/LongFast/#" />
        </SettingRow>
      )}
    </>
  );
}

function ForwardingRows({ b }: { b: MqttBridgeConfig }) {
  const { t } = useTranslation();
  const f = b.form;
  const toggle = (key: 'ignoreOkToMqtt' | 'skipRaise' | 'relayOtherBridges' | 'dropAutomationUplinks', label: string, help: ReactNode) => (
    <SettingRow id={`mqtt-bridge.${key}`} label={label} help={help}>
      <SettingToggle checked={f[key]} onChange={(v) => b.patch(key, v)} />
    </SettingRow>
  );
  return (
    <>
      {toggle(
        'ignoreOkToMqtt',
        t('source.form.mqtt_bridge_ignore_ok_to_mqtt', 'Uplink all packets (ignore ok_to_mqtt bit)'),
        <Warn>
          {t(
            'source.form.mqtt_bridge_ignore_ok_to_mqtt_help',
            'Overrides the originating node\'s "ok_to_mqtt" preference. Only enable for private bridges where every gateway has consented.',
          )}
        </Warn>,
      )}
      {toggle('skipRaise', t('source.form.mqtt_bridge_skip_raise'), t('source.form.mqtt_bridge_skip_raise_help'))}
      {toggle(
        'relayOtherBridges',
        t('source.form.mqtt_bridge_relay_other_bridges'),
        <>
          {t('source.form.mqtt_bridge_relay_other_bridges_help')}
          <span className={pages.block}>{t('source.form.mqtt_bridge_relay_drops', { count: b.uplinkBridgeRelayDrops })}</span>
        </>,
      )}
      {toggle(
        'dropAutomationUplinks',
        t('source.form.mqtt_bridge_drop_automation_uplinks'),
        <>
          {t('source.form.mqtt_bridge_drop_automation_uplinks_help')}
          <span className={pages.block}>
            {t('source.form.mqtt_bridge_uplink_policy_drops', { automation: b.uplinkAutomationDrops, okToMqtt: b.uplinkOkToMqttDrops })}
          </span>
          <span className={pages.block}>{t('source.form.mqtt_bridge_disconnected_drops', { count: b.uplinkDisconnectedDrops })}</span>
        </>,
      )}
    </>
  );
}

function RewriteRows({ b }: { b: MqttBridgeConfig }) {
  const { t } = useTranslation();
  const f = b.form;
  const down = f.downlinkRewrite ?? { from: '', to: '' };
  const up = f.uplinkRewrite ?? { from: '', to: '' };
  return (
    <>
      <p className={pages.groupNote}>
        {t(
          'mqtt_bridge_config.rewrites_help',
          'Literal prefix replacement applied to topics as they cross the bridge. Leave both fields blank to disable a rewrite. MQTT wildcards (+, #) are not allowed.',
        )}
      </p>
      <SettingRow stacked id="mqtt-bridge.downlinkFrom" label={t('mqtt_bridge_config.downlink_rewrite_from', 'Downlink from')}>
        <SettingText mono value={down.from} onChange={(v) => b.patch('downlinkRewrite', { ...down, from: v })} placeholder="msh/US" />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.downlinkTo" label={t('mqtt_bridge_config.downlink_rewrite_to', 'Downlink to')}>
        <SettingText mono value={down.to} onChange={(v) => b.patch('downlinkRewrite', { ...down, to: v })} placeholder="msh/local" />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.uplinkFrom" label={t('mqtt_bridge_config.uplink_rewrite_from', 'Uplink from')}>
        <SettingText mono value={up.from} onChange={(v) => b.patch('uplinkRewrite', { ...up, from: v })} placeholder="msh/local" />
      </SettingRow>
      <SettingRow stacked id="mqtt-bridge.uplinkTo" label={t('mqtt_bridge_config.uplink_rewrite_to', 'Uplink to')}>
        <SettingText mono value={up.to} onChange={(v) => b.patch('uplinkRewrite', { ...up, to: v })} placeholder="msh/US" />
      </SettingRow>
    </>
  );
}

/** The page's dock: "N changes · Save bridge settings", Discard and Save (one PUT; reconnects). */
function Dock({ b }: { b: MqttBridgeConfig }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  if (!b.hasChanges && !b.saveError && !b.saved) return null;
  const changes = (Object.keys(b.form) as Array<keyof BridgeConfigForm>).filter((k) => JSON.stringify(b.form[k]) !== JSON.stringify(b.savedForm[k])).length;
  const buttons = (
    <>
      <button type="button" className={bar.plain} onClick={b.handleDismiss} disabled={b.saving || !b.hasChanges}>
        {t('workspace.settings.savebar.discard')}
      </button>
      <button type="button" className={bar.save} onClick={() => void b.handleSave()} disabled={b.saving || !b.hasChanges} aria-busy={b.saving || undefined}>
        {b.saving ? t('common.saving') : t('common.save')}
      </button>
    </>
  );
  return (
    <>
      {isPhone && <div className={bar.spacer} aria-hidden="true" />}
      <section className={bar.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.mqtt_bridge.dock_label')}>
        <div className={bar.row}>
          <div className={bar.text}>
            <span className={bar.title}>
              {b.hasChanges ? t('workspace.settings.mqtt_bridge.dock_title', { count: changes }) : t('workspace.settings.saved')}
            </span>
            <span className={bar.sub}>{t('workspace.settings.mqtt_bridge.dock_sub')}</span>
          </div>
          {!isPhone && buttons}
        </div>
        {isPhone && <div className={bar.buttons}>{buttons}</div>}
        {b.saveError && (
          <p className={bar.error} role="alert">
            {b.saveError}
          </p>
        )}
      </section>
    </>
  );
}
