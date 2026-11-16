/**
 * Bridge setup for an mqtt_bridge source: a section of that source's Settings
 * page (`SettingsTab mode="source"`, see App.tsx).
 *
 * It was a page of its own under a satellite "Configuration" nav entry until
 * the #5683 follow-up. Nothing here is sent to a device: every field is
 * MeshMonitor's own connection and filter setup, stored in the source row. So
 * it belongs with the source's Settings, and the satellite keeps one meaning.
 *
 * Loads the source config via GET /api/sources/:id, presents the full set of
 * bridge options in collapsible sections, and saves the reassembled config via
 * PUT /api/sources/:id. Both routes check `sources`, not `settings`: the
 * section gates itself on `sources:write`, whatever grant opened the page.
 *
 * Saving: the section's own Save button, or the page's shared save bar, where
 * it registers as one section. Either way the PUT is sent only for a form the
 * user changed and then chose to save.
 *
 * Centralizes options that previously only lived in the cramped create/edit
 * modal, and adds the per-bridge **publish (uplink) topic filter** (#3294).
 * All config (de)serialization is shared with that modal via
 * `./mqttBridgeConfig` so the two editors can never drift.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { CollapsibleSection } from '../MeshCore/CollapsibleSection';
import BBoxMapEditor from '../BBoxMapEditor';
import { bboxToFormStrings } from '../../pages/DashboardPage.bboxSeed';
import { formatRelativeTime } from '../../utils/datetime';
import { UiIcon } from '../icons';
import { PasswordField } from '../shared/config/PasswordField';
import { useSaveBar } from '../../hooks/useSaveBar';
import { MQTT_BRIDGE_SETTINGS_HASH } from '../../utils/tabHashRedirect';
import styles from './MqttBridgeConfigurationView.module.css';
import { MqttDocsLinks } from './MqttDocsLinks';
import {
  BRIDGE_MODES,
  BRIDGE_FORWARDING_MODES,
  type BridgeConfigForm,
  type UplinkTopicMode,
} from './mqttBridgeConfig';
import BrokerPresetSelector from './BrokerPresetSelector';
import { MqttRootFinder } from './MqttRootFinder';
import { MqttRootFieldError } from './MqttRootFieldError';
import { applyRootToSubscriptions, defaultBridgeRegionRoot } from './mqttRootDefaults';
import { matchBridgePreset } from './brokerPresets';
import { GEO_KEYS, bboxFromForm, brokerGatewayClientId, useMqttBridgeConfig } from './useMqttBridgeConfig';

interface MqttBridgeConfigurationViewProps {
  /** Source UUID of the bridge being configured. */
  sourceId: string;
}

/** The section's id: the Settings nav chip and `#settings-mqtt-bridge` deep links. */
export const MQTT_BRIDGE_SETTINGS_SECTION_ID = MQTT_BRIDGE_SETTINGS_HASH;

/** #5893: help text under the single-mode Client ID input. */
const CLIENT_ID_HELP =
  "Leave blank for the default mm-bridge-… ID. Strict community brokers accept only !xxxxxxxx (8 hex digits); set one here so the broker sees a single connection from MeshMonitor. It must not match an ID another client uses on that broker: your radio's own MQTT module, another MeshMonitor, or another bridge source. A duplicate makes the broker evict one of them, and after 5 evictions in 10 minutes this bridge stops reconnecting.";

const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--color-text-subtle)', marginTop: 4 };

export const MqttBridgeConfigurationView: React.FC<MqttBridgeConfigurationViewProps> = ({
  sourceId,
}) => {
  const { t } = useTranslation();
  // State, requests and save live in useMqttBridgeConfig (Rule X), shared with the Workspace page.
  const {
    canWrite,
    downlinkGeoDrops,
    uplinkGeoDrops,
    lastGeoSweep,
    uplinkOkToMqttDrops,
    uplinkAutomationDrops,
    uplinkBridgeRelayDrops,
    uplinkDisconnectedDrops,
    sharedUpstreamWarning,
    form,
    brokers,
    customChannel,
    setCustomChannel,
    loading,
    loadError,
    saving,
    saveError,
    saved,
    passwordStored,
    serverFillPreset,
    patch,
    handleSave,
    hasChanges,
    handleDismiss,
    applyBrokerPreset,
    getPresetDraft,
    selectedChannels,
    toggleChannel,
    addCustomChannel,
    channelOptions,
  } = useMqttBridgeConfig(sourceId);

  // One section of the page's shared save bar. `hasChanges` is false until the
  // user edits a field, so opening the page or saving another section never
  // sends this form.
  useSaveBar({
    id: 'mqtt-bridge-settings',
    sectionName: t('mqtt_bridge_config.title', 'MQTT Bridge Configuration'),
    hasChanges,
    isSaving: saving,
    onSave: handleSave,
    onDismiss: handleDismiss,
  });

  const heading = (
    <>
      <h3>{t('mqtt_bridge_config.title', 'MQTT Bridge Configuration')}</h3>
      <p className="setting-description">
        {t(
          'mqtt_bridge_config.section_description',
          "MeshMonitor's own connection and filter setup for this bridge. It is stored with the source; nothing here is sent to a device.",
        )}
      </p>
    </>
  );
  const sectionClass = `settings-section mqtt-bridge-config ${styles.section}`;

  if (loading) {
    return (
      <div id={MQTT_BRIDGE_SETTINGS_SECTION_ID} className={sectionClass}>
        {heading}
        {t('common.loading', 'Loading…')}
      </div>
    );
  }

  if (loadError) {
    return (
      <div id={MQTT_BRIDGE_SETTINGS_SECTION_ID} className={sectionClass}>
        {heading}
        <p className={styles.error} role="alert">{loadError}</p>
      </div>
    );
  }

  const attached = !!form.brokerId;
  const parentGatewayClientId = brokerGatewayClientId(brokers.find((b) => b.id === form.brokerId));

  return (
    <div id={MQTT_BRIDGE_SETTINGS_SECTION_ID} className={sectionClass}>
      {heading}
      <MqttDocsLinks />
      {!canWrite && (
        <p className={styles.readOnly} role="status">
          {t(
            'mqtt_bridge_config.read_only',
            'You can view this bridge setup but not change it: that needs the Sources write permission.',
          )}
        </p>
      )}
      <div className={styles.form}>

      {/* --- Connection --- */}
      <CollapsibleSection title={t('mqtt_bridge_config.section_connection', 'Connection')}>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">
            {t('source.form.mqtt_bridge_broker', 'Parent broker (optional)')}
          </span>
          <select
            className="dashboard-form-input"
            value={form.brokerId}
            disabled={!canWrite}
            onChange={(e) => patch('brokerId', e.target.value)}
          >
            <option value="">
              {t('source.form.mqtt_bridge_broker_none', 'None — standalone client proxy')}
            </option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span style={labelStyle}>
            {t(
              'source.form.mqtt_bridge_broker_help',
              'With a parent broker, the bridge also republishes upstream traffic to local devices and forwards their packets upstream. Without one, it runs as a pure MQTT client — useful for monitoring or as a client-proxy target for a Meshtastic source.',
            )}
          </span>
        </label>
        <BrokerPresetSelector
          id="mqttBridgeBrokerPreset"
          layout="dashboard"
          disabled={!canWrite}
          matchPreset={(candidates) => matchBridgePreset(form.url, candidates)}
          onApplyPreset={applyBrokerPreset}
          getDraft={getPresetDraft}
          draftPasswordNotIncluded={passwordStored && form.password === ''}
        />
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">{t('source.form.mqtt_upstream_url', 'Upstream URL')}</span>
          <input
            className="dashboard-form-input"
            type="text"
            value={form.url}
            disabled={!canWrite}
            onChange={(e) => patch('url', e.target.value)}
            placeholder="mqtt://mqtt.meshtastic.org:1883"
          />
        </label>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">{t('source.form.mqtt_username', 'Username')}</span>
          <input
            className="dashboard-form-input"
            type="text"
            value={form.username}
            disabled={!canWrite}
            onChange={(e) => patch('username', e.target.value)}
          />
        </label>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">{t('source.form.mqtt_password', 'Password')}</span>
          <PasswordField
            className="dashboard-form-input"
            value={form.password}
            disabled={!canWrite}
            onChange={(e) => patch('password', e.target.value)}
            placeholder="••••••••"
          />
          <span style={labelStyle}>
            {t('mqtt_bridge_config.password_help', 'Leave blank to keep the stored password.')}
          </span>
        </label>
      </CollapsibleSection>

      {/* --- Forwarding --- */}
      <CollapsibleSection title={t('mqtt_bridge_config.section_forwarding', 'Forwarding')}>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">{t('source.form.mqtt_bridge_mode', 'Mode')}</span>
          <select
            className="dashboard-form-input"
            value={form.mode}
            disabled={!canWrite}
            onChange={(e) => patch('mode', e.target.value as BridgeConfigForm['mode'])}
          >
            {BRIDGE_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`source.form.mqtt_bridge_mode_${m}`, m)}
              </option>
            ))}
          </select>
          <span style={labelStyle}>
            {t(
              'source.form.mqtt_bridge_mode_help',
              'Bidirectional brings the upstream server\'s traffic down to the parent broker (and from there to any radios with Downlink Enabled) and sends local traffic up. "Publish only" sends up and brings nothing down; use it for servers that reject SUBSCRIBE. "Subscribe only" brings traffic down and never sends anything up, for read-only monitoring.',
            )}
          </span>
        </label>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">
            {t('source.form.mqtt_bridge_forwarding_mode', 'Upstream identity')}
          </span>
          <select
            className="dashboard-form-input"
            value={form.forwardingMode}
            disabled={!canWrite}
            onChange={(e) =>
              patch('forwardingMode', e.target.value as BridgeConfigForm['forwardingMode'])
            }
          >
            {BRIDGE_FORWARDING_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`source.form.mqtt_bridge_forwarding_${m}`, m)}
              </option>
            ))}
          </select>
          <span style={labelStyle}>
            {t(
              'source.form.mqtt_bridge_forwarding_help',
              'Per-gateway lets each local node publish upstream under its own !<hex> Client ID — required for community brokers that filter CONNECT on Client ID. Switch to Single only if the upstream broker has tight per-username connection caps.',
            )}
          </span>
        </label>
        {sharedUpstreamWarning && form.forwardingMode === 'per_gateway' && (
          <p className={styles.warning} role="status">
            <UiIcon name="alert" size={14} />{' '}
            {t(
              'source.form.mqtt_bridge_shared_upstream_warning',
              'Another bridge source uses the same parent broker and upstream URL in per_gateway mode. Both connect with the same Client IDs, so the upstream broker will keep evicting one for the other. Keep one bridge per broker and upstream, or switch one to Single.',
            )}
          </p>
        )}
        {form.forwardingMode === 'single' && (
          <div className="dashboard-form-field">
            <label className="dashboard-form-label" htmlFor="mqttBridgeClientId">
              {t('source.form.mqtt_bridge_client_id', 'Upstream Client ID (optional)')}
            </label>
            <div className={styles.clientIdRow}>
              <input
                id="mqttBridgeClientId"
                className={`dashboard-form-input ${styles.clientIdInput}`}
                type="text"
                value={form.clientId ?? ''}
                disabled={!canWrite}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => patch('clientId', e.target.value)}
                placeholder={parentGatewayClientId ?? '!a1b2c3d4'}
              />
              {parentGatewayClientId && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canWrite || form.clientId === parentGatewayClientId}
                  onClick={() => patch('clientId', parentGatewayClientId)}
                >
                  {t('source.form.mqtt_bridge_client_id_use_gateway', "Use the parent broker's gateway ID")}
                </button>
              )}
            </div>
            <span style={labelStyle}>
              {t(
                'source.form.mqtt_bridge_client_id_help',
                CLIENT_ID_HELP,
              )}
            </span>
          </div>
        )}
        <label className="dashboard-form-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.ignoreOkToMqtt}
            disabled={!canWrite}
            onChange={(e) => patch('ignoreOkToMqtt', e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span className="dashboard-form-label" style={{ display: 'block' }}>
              {t('source.form.mqtt_bridge_ignore_ok_to_mqtt', 'Uplink all packets (ignore ok_to_mqtt bit)')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-warning)' }}>
              {t(
                'source.form.mqtt_bridge_ignore_ok_to_mqtt_help',
                'Overrides the originating node\'s "ok_to_mqtt" preference. Only enable for private bridges where every gateway has consented.',
              )}
            </span>
          </span>
        </label>
        <label className="dashboard-form-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.dropAutomationUplinks}
            disabled={!canWrite}
            onChange={(e) => patch('dropAutomationUplinks', e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span className="dashboard-form-label" style={{ display: 'block' }}>
              {t('source.form.mqtt_bridge_drop_automation_uplinks', "Don't uplink MeshMonitor automation traffic")}
            </span>
            <span style={labelStyle}>
              {t(
                'source.form.mqtt_bridge_drop_automation_uplinks_help',
                'Keeps packets sent by MeshMonitor automations (auto-acknowledge tapbacks, auto-responder, auto-announce, auto-welcome, timers, geofences, Automation Engine actions, auto-ping, scheduled requests) off the upstream broker. They still go out over LoRa and to the local broker; messages you send by hand are not affected. Only covers this bridge: a node whose own MQTT module publishes straight to the upstream broker still uplinks them (firmware behaviour by design, meshtastic/firmware#11994).',
              )}
            </span>
            <span style={{ ...labelStyle, display: 'block' }}>
              {t(
                'source.form.mqtt_bridge_uplink_policy_drops',
                'Dropped so far: {{automation}} automation · {{okToMqtt}} ok_to_mqtt',
                { automation: uplinkAutomationDrops, okToMqtt: uplinkOkToMqttDrops },
              )}
            </span>
            <span style={{ ...labelStyle, display: 'block' }}>
              {t(
                'source.form.mqtt_bridge_disconnected_drops',
                'Dropped while the upstream connection was down: {{count}}',
                { count: uplinkDisconnectedDrops },
              )}
            </span>
          </span>
        </label>
        <label className="dashboard-form-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.skipRaise}
            disabled={!canWrite}
            onChange={(e) => patch('skipRaise', e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span className="dashboard-form-label" style={{ display: 'block' }}>
              {t('source.form.mqtt_bridge_skip_raise', 'Skip raise on packets from this bridge')}
            </span>
            <span style={labelStyle}>
              {t(
                'source.form.mqtt_bridge_skip_raise_help',
                "The parent broker's \"Raise hop count for backhaul\" never raises packets this bridge brings in; its clamp still applies. Use it for an upstream such as mqtt.meshtastic.org that you want to watch but not re-flood on your local mesh.",
              )}
            </span>
          </span>
        </label>
        <label className="dashboard-form-field" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <input
            type="checkbox"
            checked={form.relayOtherBridges}
            disabled={!canWrite}
            onChange={(e) => patch('relayOtherBridges', e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            <span className="dashboard-form-label" style={{ display: 'block' }}>
              {t('source.form.mqtt_bridge_relay_other_bridges', 'Relay traffic from other bridges')}
            </span>
            <span style={labelStyle}>
              {t(
                'source.form.mqtt_bridge_relay_other_bridges_help',
                'Off: this bridge uplinks only traffic that started on your side (your nodes and local MQTT clients). Packets another bridge on the same broker brought down from its upstream are not sent to this upstream. Turn on only to relay one upstream broker into another on purpose.',
              )}
            </span>
            <span style={{ ...labelStyle, display: 'block' }}>
              {t('source.form.mqtt_bridge_relay_drops', 'Not relayed so far: {{count}}', { count: uplinkBridgeRelayDrops })}
            </span>
          </span>
        </label>
      </CollapsibleSection>

      {/* --- Subscribe (downlink) --- */}
      <CollapsibleSection title={t('mqtt_bridge_config.section_subscribe', 'Subscribe (incoming)')}>
        <label className="dashboard-form-field">
          <span className="dashboard-form-label">
            {t('source.form.mqtt_subscriptions', 'Upstream topics (one per line)')}
          </span>
          <textarea
            className="dashboard-form-input"
            rows={3}
            value={form.subscriptions}
            disabled={!canWrite}
            onChange={(e) => patch('subscriptions', e.target.value)}
          />
        </label>
        {form.subscriptions
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.endsWith('/#') && !l.includes('+'))
          .map((l) => (
            <MqttRootFieldError key={l} warn value={l.slice(0, -2)} />
          ))}
        <MqttRootFinder
          context="bridge"
          sourceId={sourceId}
          disabled={!canWrite}
          currentRoot={form.subscriptions.split('\n')[0]?.trim() ?? ''}
          defaultRegionRoot={defaultBridgeRegionRoot(form.subscriptions)}
          getTarget={() =>
            form.url.trim()
              ? {
                  broker: { url: form.url },
                  username: form.username,
                  password: form.password,
                  brokerPresetId:
                    serverFillPreset?.savedId !== undefined && matchBridgePreset(form.url, [serverFillPreset])
                      ? serverFillPreset.savedId
                      : null,
                }
              : null
          }
          onPickRoot={(root) => patch('subscriptions', applyRootToSubscriptions(form.subscriptions, root))}
        />
        <fieldset style={{ border: '1px solid var(--color-surface-hover)', borderRadius: 6, padding: '8px 12px 12px', margin: '8px 0' }}>
          <legend style={{ fontSize: 12, padding: '0 6px', color: 'var(--color-text-subtle)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.useTopicBlock}
                disabled={!canWrite}
                onChange={(e) => patch('useTopicBlock', e.target.checked)}
              />
              {t('source.form.mqtt_topic_block_enable', 'Block specific topics')}
            </label>
          </legend>
          {form.useTopicBlock && (
            <label className="dashboard-form-field" style={{ marginTop: 4 }}>
              <span className="dashboard-form-label">
                {t('source.form.mqtt_topic_block_label', 'Topics to drop (one per line, MQTT wildcards allowed)')}
              </span>
              <textarea
                className="dashboard-form-input"
                rows={3}
                value={form.topicBlock}
                disabled={!canWrite}
                onChange={(e) => patch('topicBlock', e.target.value)}
                placeholder="msh/CA/QC/#"
              />
            </label>
          )}
        </fieldset>
        <fieldset style={{ border: '1px solid var(--color-surface-hover)', borderRadius: 6, padding: '8px 12px 12px', margin: '8px 0' }}>
          <legend style={{ fontSize: 12, padding: '0 6px', color: 'var(--color-text-subtle)' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.useGeo}
                disabled={!canWrite}
                onChange={(e) => patch('useGeo', e.target.checked)}
              />
              {t('source.form.mqtt_geo_enable', 'Restrict to geographic bounding box')}
            </label>
          </legend>
          {form.useGeo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <BBoxMapEditor
                bbox={bboxFromForm(form.geo)}
                onChange={(next) =>
                  patch(
                    'geo',
                    next
                      ? bboxToFormStrings(next)
                      : { minLat: '', maxLat: '', minLng: '', maxLng: '' },
                  )
                }
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {GEO_KEYS.map((k) => (
                  <label className="dashboard-form-field" key={k}>
                    <span className="dashboard-form-label">{k}</span>
                    <input
                      className="dashboard-form-input"
                      value={form.geo[k]}
                      disabled={!canWrite}
                      onChange={(e) => patch('geo', { ...form.geo, [k]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </CollapsibleSection>

      {/* --- Geo filter status (read-only observability, Phase 4 WP2) --- */}
      <CollapsibleSection title={t('mqtt_bridge_config.geo_status.title', 'Geo filter status')}>
        <div style={{ fontSize: 13, color: 'var(--color-text)' }}>
          {t(
            'mqtt_bridge_config.geo_status.dropped_summary',
            'Out-of-bbox positions dropped — downlink: {{downlink}} · uplink: {{uplink}}',
            { downlink: downlinkGeoDrops, uplink: uplinkGeoDrops },
          )}
        </div>
        <span style={{ ...labelStyle, display: 'block', marginTop: 4 }}>
          {t(
            'mqtt_bridge_config.geo_status.dropped_note',
            'Counts plaintext positions only — encrypted positions are evaluated after decryption and are not counted here.',
          )}
        </span>
        <div style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 12 }}>
          {lastGeoSweep ? (
            t(
              'mqtt_bridge_config.geo_status.last_sweep',
              'Last sweep {{time}}: scanned {{scanned}} · ignored {{ignored}} · purged {{purged}} · lifted {{lifted}} ({{duration}} ms)',
              {
                time: formatRelativeTime(lastGeoSweep.timestamp),
                scanned: lastGeoSweep.scanned,
                ignored: lastGeoSweep.ignored,
                purged: lastGeoSweep.purged,
                lifted: lastGeoSweep.lifted,
                duration: lastGeoSweep.durationMs,
              },
            )
          ) : (
            t('mqtt_bridge_config.geo_status.no_sweep', 'No sweep has run yet.')
          )}
        </div>
      </CollapsibleSection>

      {/* --- Publish (uplink) filters — #3294. Channel multiselect is primary;
              the raw topic filter is tucked into an Advanced subsection. --- */}
      <CollapsibleSection title={t('mqtt_bridge_config.section_publish', 'Publish (outgoing)')}>
        <span className="dashboard-form-label" style={{ display: 'block' }}>
          {t('source.form.mqtt_uplink_channels_label', 'Uplink only these channels')}
        </span>
        <span style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>
          {t(
            'source.form.mqtt_uplink_channels_help',
            'Leave all unchecked to uplink every channel. Matched on the decoded channel name, regardless of MQTT topic format — the reliable way to uplink only specific channels (e.g. LongFast) while still receiving everything locally.',
          )}
        </span>
        {channelOptions.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 4,
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid var(--color-surface-hover)',
              borderRadius: 6,
              padding: '8px 12px',
            }}
          >
            {channelOptions.map((name) => (
              <label
                key={name}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(name)}
                  disabled={!canWrite}
                  onChange={(e) => toggleChannel(name, e.target.checked)}
                />
                {name}
              </label>
            ))}
          </div>
        ) : (
          <span style={{ ...labelStyle, display: 'block' }}>
            {t(
              'source.form.mqtt_uplink_channels_empty',
              'No channels known yet — they appear here as the bridge sees traffic. Add one manually below, or use the Advanced topic filter.',
            )}
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            className="dashboard-form-input"
            style={{ flex: 1 }}
            type="text"
            value={customChannel}
            disabled={!canWrite}
            placeholder={t('source.form.mqtt_uplink_channels_add', 'Add channel name…')}
            onChange={(e) => setCustomChannel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomChannel();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={addCustomChannel}
            disabled={!canWrite || !customChannel.trim()}
          >
            {t('common.add', 'Add')}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <CollapsibleSection
            title={t('mqtt_bridge_config.section_publish_advanced', 'Advanced: topic filter')}
            defaultExpanded={false}
          >
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">
                {t('source.form.mqtt_uplink_topic_mode', 'Publish topic filter')}
              </span>
              <select
                className="dashboard-form-input"
                value={form.uplinkTopicMode ?? 'off'}
                disabled={!canWrite}
                onChange={(e) => patch('uplinkTopicMode', e.target.value as UplinkTopicMode)}
              >
                <option value="off">
                  {t('source.form.mqtt_uplink_topic_mode_off', 'Off — publish all subscribed topics')}
                </option>
                <option value="allow">
                  {t('source.form.mqtt_uplink_topic_mode_allow', 'Allow list — only publish matching topics')}
                </option>
                <option value="block">
                  {t('source.form.mqtt_uplink_topic_mode_block', 'Block list — publish all except matching topics')}
                </option>
              </select>
              <span style={labelStyle}>
                {t(
                  'source.form.mqtt_uplink_topic_help',
                  'Raw topic-pattern filter on the outgoing publish topic (MQTT wildcards). Composes with the channel selection above — both must pass. Only needed for filtering by something other than channel.',
                )}
              </span>
            </label>
            {form.uplinkTopicMode && form.uplinkTopicMode !== 'off' && (
              <label className="dashboard-form-field" style={{ marginTop: 4 }}>
                <span className="dashboard-form-label">
                  {t('source.form.mqtt_uplink_topics_label', 'Publish topics (one per line, MQTT wildcards allowed)')}
                </span>
                <textarea
                  className="dashboard-form-input"
                  rows={3}
                  value={form.uplinkTopics ?? ''}
                  disabled={!canWrite}
                  onChange={(e) => patch('uplinkTopics', e.target.value)}
                  placeholder="msh/US/FL/+/+/LongFast/#"
                />
              </label>
            )}
          </CollapsibleSection>
        </div>
      </CollapsibleSection>

      {/* --- Topic rewrites (only meaningful with a parent broker) --- */}
      {attached && (
        <CollapsibleSection
          title={t('mqtt_bridge_config.section_rewrites', 'Topic rewrites')}
          defaultExpanded={false}
        >
          <span style={{ ...labelStyle, display: 'block', marginBottom: 8 }}>
            {t(
              'mqtt_bridge_config.rewrites_help',
              'Literal prefix replacement applied to topics as they cross the bridge. Leave both fields blank to disable a rewrite. MQTT wildcards (+, #) are not allowed.',
            )}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">
                {t('mqtt_bridge_config.downlink_rewrite_from', 'Downlink from')}
              </span>
              <input
                className="dashboard-form-input"
                value={form.downlinkRewrite?.from ?? ''}
                disabled={!canWrite}
                onChange={(e) =>
                  patch('downlinkRewrite', { from: e.target.value, to: form.downlinkRewrite?.to ?? '' })
                }
                placeholder="msh/US"
              />
            </label>
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">
                {t('mqtt_bridge_config.downlink_rewrite_to', 'Downlink to')}
              </span>
              <input
                className="dashboard-form-input"
                value={form.downlinkRewrite?.to ?? ''}
                disabled={!canWrite}
                onChange={(e) =>
                  patch('downlinkRewrite', { from: form.downlinkRewrite?.from ?? '', to: e.target.value })
                }
                placeholder="msh/local"
              />
            </label>
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">
                {t('mqtt_bridge_config.uplink_rewrite_from', 'Uplink from')}
              </span>
              <input
                className="dashboard-form-input"
                value={form.uplinkRewrite?.from ?? ''}
                disabled={!canWrite}
                onChange={(e) =>
                  patch('uplinkRewrite', { from: e.target.value, to: form.uplinkRewrite?.to ?? '' })
                }
                placeholder="msh/local"
              />
            </label>
            <label className="dashboard-form-field">
              <span className="dashboard-form-label">
                {t('mqtt_bridge_config.uplink_rewrite_to', 'Uplink to')}
              </span>
              <input
                className="dashboard-form-input"
                value={form.uplinkRewrite?.to ?? ''}
                disabled={!canWrite}
                onChange={(e) =>
                  patch('uplinkRewrite', { from: form.uplinkRewrite?.from ?? '', to: e.target.value })
                }
                placeholder="msh/US"
              />
            </label>
          </div>
        </CollapsibleSection>
      )}

      {/* --- Save --- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={!canWrite || saving}
        >
          {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
        </button>
        {saved && <span style={{ color: 'var(--color-success)' }}><UiIcon name="check" size={14} /> {t('common.saved', 'Saved')}</span>}
        {saveError && <span style={{ color: 'var(--color-error)' }}>{saveError}</span>}
      </div>
      </div>
    </div>
  );
};

export default MqttBridgeConfigurationView;
