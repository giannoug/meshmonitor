/**
 * The source add/edit form (Task 6.6, Rule X): DashboardPage's `formX`
 * state, its reset on Add, its fill on Edit and its Save, moved here verbatim
 * so the Workspace's Add device flow sends exactly today's requests.
 *
 * - `startAdd()` resets what today's Add resets (the MeshCore MQTT fields are
 *   not reset, as today); `startEdit(id)` fills what today's Edit fills.
 * - `validate()` is Save's checks without the request: the first error, or
 *   null. `{ connectionOnly: true }` skips the name (the flow asks for it
 *   last).
 * - `submit()` is today's Save: POST or PUT `/api/sources`, then a broker's
 *   per-bridge rewrite PUTs. It resolves to the saved source, or null when it
 *   did not save (the reason is in `formError`). After an add, the form edits
 *   the new source, so saving again is a PUT.
 * - Secrets keep today's handling: a stored password or token is never put
 *   back into a field, and a blank one is left out so the server keeps it
 *   (`DashboardPage.maskedFields.ts` says what the form may show).
 */
import { useCallback, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNumberInputScope } from '../../components/common/numberInputScopeContext';
import { buildBridgeConfig, formFromBridgeConfig } from '../../components/MQTT/mqttBridgeConfig';
import {
  EMPTY_HOP_LIMIT_POLICY_FORM,
  formFromHopLimitConfig,
  hopLimitConfigFromForm,
  legacyHopOverrideNotice,
  type HopLimitPolicyForm,
} from '../../components/MQTT/hopLimitPolicyForm';
import { observerErrorMessageKey, observerConfigForSourceSave } from '../../components/MeshCore/observerConfig';
import { MESHCORE_DEFAULT_TCP_PORT } from '../../constants';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { hasStoredSecret, type MaskedFieldSource } from '../../pages/DashboardPage.maskedFields';
import api, { ApiError } from '../../services/api';

export type SourceType = 'meshtastic_tcp' | 'meshcore' | 'meshcore_mqtt' | 'mqtt_broker' | 'mqtt_bridge' | 'reticulum';

export type BridgeRewrite = { downlinkFrom: string; downlinkTo: string; uplinkFrom: string; uplinkTo: string };

export interface SourceFormValues {
  formType: SourceType;
  // MeshCore MQTT ingest source (#5040). One broker per source, deliberately:
  // it keeps "which broker did this come from" collapsed to "which source".
  formMcMqttBrokerUrl: string;
  formMcMqttRegion: string;
  formMcMqttUsername: string;
  formMcMqttPassword: string;
  formMcMqttRejectUnauthorized: boolean;
  formMcMqttAutoConnect: boolean;
  formName: string;
  formHost: string;
  formPort: string;
  formVnEnabled: boolean;
  formVnPort: string;
  formVnAllowAdmin: boolean;
  // MeshCore-only: serve ExportPrivateKey(23) over the virtual node port.
  // Security-sensitive, so it never defaults on and is never inherited when
  // switching a form between source types.
  formVnAllowPkiExport: boolean;
  formVnAllowPkiImport: boolean;
  // MeshCore Analyzer Observer (#4457). Edited on the source's MeshCore
  // Configuration page since #5831; this form only carries the stored block
  // through a save unchanged, so editing the source never drops it.
  formObserverStored: unknown;
  formHeartbeat: string; // seconds, 0 = disabled (issue 2609)
  // True once the user types in the heartbeat field, or when the form holds a
  // saved source. Until then, picking a MeshCore device type sets the default:
  // Repeater = 0, because its serial probe is opt-in (#5563).
  formHeartbeatTouched: boolean;
  formAutoConnect: boolean; // issue #2773
  formPassiveMode: boolean; // issue #3122 — large/fragile TCP nodes
  // Empty string = "use default 4 h". Numeric string in hours when overridden (#3122 follow-up).
  formPassiveResyncStaleHours: string;
  // MeshCore-specific (slice 4): companion-USB v1 — serial path + device type.
  // TCP transport added in v2: same Companion firmware reachable over a TCP
  // socket (e.g. esp-link, ser2net, native TCP-capable MeshCore firmware).
  formMcTransport: 'usb' | 'tcp';
  formMcSerialPort: string;
  formMcTcpHost: string;
  // MeshCore WiFi/Ethernet companion firmware opens its TCP server on 5000
  // (#5160). 4403 is Meshtastic's port, and also what MeshCore's less common
  // "native TCP" companion builds use — but the WiFi/Ethernet build is what
  // people actually add here, so it gets the default.
  formMcTcpPort: string;
  formMcDeviceType: 'companion' | 'repeater';
  // MQTT broker (mqtt_broker) form state.
  formMqttListenPort: string;
  formMqttUsername: string;
  formMqttPassword: string;
  formMqttRootTopic: string;
  // Hop-limit raise/clamp policy (#5188/#5190), successor to the #4081
  // "set hop_limit to N" override. `formMqttLegacyHopNotice` carries the
  // one-time explanation shown for a source still storing the old field.
  formMqttHopPolicy: HopLimitPolicyForm;
  formMqttLegacyHopNotice: string | null;
  // Per-bridge topic-rewrite form state, surfaced inside the broker's
  // edit modal so an operator can manage all rewrites for the bridges
  // attached to this broker in one place. Keyed by bridge source id.
  // Empty strings mean "not configured" and a partial entry (only `from` or
  // only `to` filled in) is a client-side validation error matching the
  // server-side `error_rewrite_incomplete` rule.
  formBrokerBridgeRewrites: Record<string, BridgeRewrite>;
  // Snapshot at modal-open time so onSaveSource knows which bridges
  // actually changed and skips PUTs for the rest.
  originalBrokerBridgeRewrites: Record<string, BridgeRewrite>;
  // MQTT bridge (mqtt_bridge) form state. Advanced bridge settings (mode,
  // forwarding, ok_to_mqtt, publish/subscribe filters, geofence, topic
  // rewrites) are NOT edited here — they live on the bridge's Configuration
  // page. buildBridgeConfig preserves them on save.
  formMqttBridgeBrokerId: string;
  formMqttBridgeUrl: string;
  formMqttBridgeUsername: string;
  formMqttBridgePassword: string;
  formMqttBridgeSubscriptions: string;
  // Meshtastic source ↔ embedded MQTT broker proxy link (issue #3003
  // follow-up). Empty string = unset / no proxy bridge.
  formMtMqttLinkBrokerId: string;
  // Reticulum form state (#3960 Phase 1b WP6). Mirrors `ReticulumSourceConfig`
  // (src/server/reticulumConfig.ts): 'attach' joins a shared rnsd instance's
  // RNS config directory via the bridge sidecar; 'tcp_peer' has the bridge's
  // own RNS instance dial out to a single TCPClientInterface peer.
  formRnsMode: 'attach' | 'tcp_peer';
  formRnsConfigDir: string;
  formRnsBridgeUrl: string;
  formRnsToken: string;
  formRnsAutoConnect: boolean;
  formRnsPeerHost: string;
  formRnsPeerPort: string;
}

/** What today's Add resets. The MeshCore MQTT fields are not in it, as today. */
const ADD_RESET: Omit<SourceFormValues, 'formMcMqttBrokerUrl' | 'formMcMqttRegion' | 'formMcMqttUsername' | 'formMcMqttPassword' | 'formMcMqttRejectUnauthorized' | 'formMcMqttAutoConnect'> = {
  formType: 'meshtastic_tcp',
  formName: '',
  formHost: '',
  formPort: '4403',
  formVnEnabled: false,
  formVnPort: '',
  formVnAllowAdmin: false,
  formVnAllowPkiExport: false,
  formVnAllowPkiImport: false,
  formObserverStored: undefined,
  formHeartbeat: '30',
  formHeartbeatTouched: false,
  formAutoConnect: true,
  formPassiveMode: false,
  formPassiveResyncStaleHours: '',
  formMcTransport: 'usb',
  formMcSerialPort: '',
  formMcTcpHost: '',
  formMcTcpPort: MESHCORE_DEFAULT_TCP_PORT,
  formMcDeviceType: 'companion',
  formMqttListenPort: '1883',
  formMqttUsername: '',
  formMqttPassword: '',
  formMqttRootTopic: 'msh',
  formMqttHopPolicy: EMPTY_HOP_LIMIT_POLICY_FORM,
  formMqttLegacyHopNotice: null,
  formMqttBridgeBrokerId: '',
  formMqttBridgeUrl: '',
  formMqttBridgeUsername: '',
  formMqttBridgePassword: '',
  formMqttBridgeSubscriptions: 'msh/#',
  formMtMqttLinkBrokerId: '',
  formBrokerBridgeRewrites: {},
  originalBrokerBridgeRewrites: {},
  formRnsMode: 'attach',
  formRnsConfigDir: '',
  formRnsBridgeUrl: '',
  formRnsToken: '',
  formRnsAutoConnect: true,
  formRnsPeerHost: '',
  formRnsPeerPort: '4965',
};

const INITIAL: SourceFormValues = {
  ...ADD_RESET,
  formMcMqttBrokerUrl: '',
  formMcMqttRegion: '',
  formMcMqttUsername: '',
  formMcMqttPassword: '',
  formMcMqttRejectUnauthorized: true,
  formMcMqttAutoConnect: true,
};

type Setters = { [K in keyof SourceFormValues as `set${Capitalize<K>}`]: Dispatch<SetStateAction<SourceFormValues[K]>> };

/**
 * Save's checks and today's request body, without the request. `error` is
 * what Save would show; `cfg` and `body` are what it would send.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim: today's untyped config blob
function buildSourceBody(v: SourceFormValues, editingSourceId: string | null, sources: DashboardSource[], t: TFunction, connectionOnly = false): { error: string } | { body: { name: string; type: SourceType; config: Record<string, any>; enabled: true } } {
  if (!connectionOnly && !v.formName.trim()) return { error: t('source.form.error_name_required') };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
  let cfg: Record<string, any>;
  if (v.formType === 'mqtt_broker') {
    const port = parseInt(v.formMqttListenPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) return { error: t('source.form.error_port_range') };
    if (!v.formMqttUsername.trim()) return { error: t('source.form.error_mqtt_username_required', 'Broker username is required') };
    if (!editingSourceId && !v.formMqttPassword) return { error: t('source.form.error_mqtt_password_required', 'Broker password is required') };
    // Generate a synthetic gateway identity. nodeNum bit 31 set keeps it
    // outside the legitimate Meshtastic node-id range so it can't be
    // confused with a real radio.
    const nodeNum = (Math.floor(Math.random() * 0x7fffffff) | 0x80000000) >>> 0;
    const nodeId = '!' + nodeNum.toString(16).padStart(8, '0');
    const shortName = v.formName.trim().substring(0, 4) || 'MM';
    cfg = {
      listener: { port, host: '0.0.0.0' },
      auth: { username: v.formMqttUsername.trim(), password: v.formMqttPassword },
      gateway: { nodeNum, nodeId, longName: v.formName.trim(), shortName },
      rootTopic: v.formMqttRootTopic.trim() || 'msh',
      // Write only the new `hopLimitPolicy` shape (#5188/#5190). Dropping
      // the legacy `downlinkHopLimitOverride` / `zeroHopInjection` fields is
      // intentional: the PUT replaces the whole config blob, so an edited
      // source stops carrying two representations of the same setting.
      ...hopLimitConfigFromForm(v.formMqttHopPolicy),
    };
    if (editingSourceId && !v.formMqttPassword) {
      // Empty password on edit → tell server to keep the existing one.
      // Drop the password field so the merge logic on the server preserves it.
      delete (cfg.auth as { password?: string }).password;
    }
  } else if (v.formType === 'mqtt_bridge') {
    // Serialize via the shared helper. The modal manages connection /
    // forwarding / subscribe-side fields; publish (uplink) filters and topic
    // rewrites are edited on the dedicated Configuration page, so we pass the
    // existing config as `base` to preserve them instead of clobbering.
    const base = editingSourceId
      ? (sources.find((s) => s.id === editingSourceId)?.config as Record<string, any> | undefined) // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
      : undefined;
    // Only the basics are posted from the modal; every advanced field
    // (mode, forwarding, ok_to_mqtt, downlink/uplink filters, geofence,
    // rewrites) is omitted so buildBridgeConfig preserves it from `base`.
    const result = buildBridgeConfig(
      {
        brokerId: v.formMqttBridgeBrokerId,
        url: v.formMqttBridgeUrl,
        username: v.formMqttBridgeUsername,
        password: v.formMqttBridgePassword,
        subscriptions: v.formMqttBridgeSubscriptions,
      },
      { editing: !!editingSourceId, base },
    );
    if (result.error) return { error: t(result.error.key, result.error.fallback) };
    cfg = result.config!;
  } else if (v.formType === 'meshcore') {
    // MeshCore source: USB/serial or TCP. Both transports flow through the
    // same MeshCoreManager via the Python bridge — only the connect params
    // differ. BLE remains out of scope.
    if (v.formMcTransport === 'tcp') {
      const host = v.formMcTcpHost.trim();
      if (!host) return { error: t('meshcore.form.error_tcp_host_required', 'Host is required') };
      const tcpPort = parseInt(v.formMcTcpPort, 10);
      if (isNaN(tcpPort) || tcpPort < 1 || tcpPort > 65535) return { error: t('source.form.error_port_range') };
      cfg = {
        transport: 'tcp',
        tcpHost: host,
        tcpPort,
        deviceType: v.formMcDeviceType,
        autoConnect: v.formAutoConnect,
      };
    } else {
      const port = v.formMcSerialPort.trim();
      if (!port) return { error: t('meshcore.form.error_port_required', 'Serial port is required') };
      cfg = {
        transport: 'usb',
        port,
        deviceType: v.formMcDeviceType,
        autoConnect: v.formAutoConnect,
      };
    }

    // Heartbeat / auto-reconnect (mirrors the Meshtastic setting).
    // 0 = disabled; otherwise probe + reconnect with backoff. A Companion
    // probes the native backend; a Repeater probes the serial CLI (#5563).
    const mcHeartbeat = parseInt(v.formHeartbeat, 10);
    if (isNaN(mcHeartbeat) || mcHeartbeat < 0 || mcHeartbeat > 3600) return { error: t('source.form.error_heartbeat_range') };
    if (mcHeartbeat > 0) cfg.heartbeatIntervalSeconds = mcHeartbeat;

    // Virtual Node server (opt-in): expose this MeshCore node to the MeshCore
    // mobile app over WiFi/TCP (#3535). Shares the formVn* state with the
    // Meshtastic form.
    if (v.formVnEnabled) {
      const vnPort = parseInt(v.formVnPort, 10);
      if (isNaN(vnPort) || vnPort < 1 || vnPort > 65535) return { error: t('source.form.error_vn_port_range') };
      // allowPkiExport is MeshCore-only — the Meshtastic VN has no equivalent
      // key-export command, so it is not written in the branch below.
      cfg.virtualNode = {
        enabled: true,
        port: vnPort,
        allowAdminCommands: v.formVnAllowAdmin,
        allowPkiExport: v.formVnAllowPkiExport,
        allowPkiImport: v.formVnAllowPkiImport,
      };
    }

    // Analyzer Observer (#4457): edited on the MeshCore Configuration page
    // since #5831. Carry the stored block through unchanged so this save
    // does not drop it (the server stores the config it is sent).
    const observer = observerConfigForSourceSave(v.formObserverStored, v.formMcDeviceType === 'repeater');
    if (observer) cfg.observer = observer;
  } else if (v.formType === 'meshcore_mqtt') {
    // Mirrors the server-side validation in sourceRoutes.ts: both fields are
    // structural. The subscribe topic is built from the region, so a source
    // without one would subscribe to nothing at all.
    const brokerUrl = v.formMcMqttBrokerUrl.trim();
    const region = v.formMcMqttRegion.trim();
    if (!brokerUrl) return { error: t('source.form.error_mc_mqtt_broker_required', 'Broker URL is required') };
    if (!region) return { error: t('source.form.error_mc_mqtt_region_required', 'Region is required') };
    cfg = {
      brokerUrl,
      region: region.toUpperCase(),
      rejectUnauthorized: v.formMcMqttRejectUnauthorized,
      autoConnect: v.formMcMqttAutoConnect,
    };
    const mcUser = v.formMcMqttUsername.trim();
    if (mcUser) cfg.username = mcUser;
    if (v.formMcMqttPassword) cfg.password = v.formMcMqttPassword;
  } else if (v.formType === 'reticulum') {
    // Reticulum source (#3960 Phase 1b WP6): validation mirrors
    // reticulumConfigFromSource() server-side (src/server/reticulumConfig.ts)
    // for fast client-side feedback — 'attach' needs a non-blank configDir,
    // 'tcp_peer' needs a well-formed {host, port} peer, and an explicit
    // bridgeUrl (when provided) must be ws:// or wss://.
    const bridgeUrl = v.formRnsBridgeUrl.trim();
    if (bridgeUrl && !/^wss?:\/\//i.test(bridgeUrl)) {
      return { error: t('source.form.error_reticulum_bridge_url', 'Bridge URL must start with ws:// or wss://') };
    }

    cfg = { mode: v.formRnsMode, autoConnect: v.formRnsAutoConnect };
    if (bridgeUrl) cfg.bridgeUrl = bridgeUrl;
    const token = v.formRnsToken.trim();
    if (token) cfg.token = token;

    if (v.formRnsMode === 'attach') {
      const configDir = v.formRnsConfigDir.trim();
      if (!configDir) return { error: t('source.form.error_reticulum_config_dir_required', 'Config directory is required') };
      cfg.configDir = configDir;
    } else {
      const host = v.formRnsPeerHost.trim();
      if (!host) return { error: t('source.form.error_host_required') };
      const port = parseInt(v.formRnsPeerPort, 10);
      if (isNaN(port) || port < 1 || port > 65535) return { error: t('source.form.error_port_range') };
      cfg.peers = [{ host, port }];
    }
  } else {
    if (!v.formHost.trim()) return { error: t('source.form.error_host_required') };
    const port = parseInt(v.formPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) return { error: t('source.form.error_port_range') };

    // Heartbeat interval (issue 2609): 0 = disabled, otherwise a positive
    // number of seconds. We clamp to a sane range to prevent pathological
    // configurations (sub-second floods or 24h naps that defeat the point).
    const heartbeatSeconds = parseInt(v.formHeartbeat, 10);
    if (isNaN(heartbeatSeconds) || heartbeatSeconds < 0 || heartbeatSeconds > 3600) return { error: t('source.form.error_heartbeat_range') };

    let vnConfig: { enabled: boolean; port: number; allowAdminCommands: boolean } | undefined;
    if (v.formVnEnabled) {
      const vnPort = parseInt(v.formVnPort, 10);
      if (isNaN(vnPort) || vnPort < 1 || vnPort > 65535) return { error: t('source.form.error_vn_port_range') };
      vnConfig = { enabled: true, port: vnPort, allowAdminCommands: v.formVnAllowAdmin };
    }

    cfg = { host: v.formHost.trim(), port };
    if (heartbeatSeconds > 0) cfg.heartbeatIntervalSeconds = heartbeatSeconds;
    if (vnConfig) cfg.virtualNode = vnConfig;
    // Persist autoConnect explicitly so the server can distinguish legacy
    // sources (undefined → treat as true) from ones the user opted out of.
    cfg.autoConnect = v.formAutoConnect;
    // Passive Mode (#3122): disables outbound config bursts and preserves
    // cached state across reconnects. Only persist when true so legacy
    // sources continue to send the standard handshake.
    if (v.formPassiveMode) {
      cfg.passiveMode = true;
      // Optional per-source override of the 4h default resync staleness
      // (#3122 follow-up). Stored as ms. Server clamps to [1m, 7d];
      // anything blank/invalid falls back to the default.
      const hours = parseFloat(v.formPassiveResyncStaleHours);
      if (Number.isFinite(hours) && hours > 0) {
        cfg.passiveResyncStaleMs = Math.round(hours * 60 * 60 * 1000);
      }
    }
    // MQTT proxy bridge — if set, MeshMonitor relays
    // FromRadio.mqttClientProxyMessage to/from the selected embedded
    // broker. Empty selection clears the link.
    if (v.formMtMqttLinkBrokerId) {
      cfg.mqttLink = { enabled: true, mqttBrokerSourceId: v.formMtMqttLinkBrokerId };
    } else {
      cfg.mqttLink = { enabled: false };
    }
  }

  return { body: { name: v.formName.trim(), type: v.formType, config: cfg, enabled: true } };
}

/** What today's Edit fills from a saved source (DashboardPage `onEditSource`, moved verbatim). */
function editValues(source: DashboardSource, sources: DashboardSource[]): Partial<SourceFormValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim: today's untyped config blob
  const cfg = source.config as Record<string, any> | undefined;
  if (source.type === 'meshcore_mqtt') {
    return {
      formType: 'meshcore_mqtt',
      formName: source.name,
      formMcMqttBrokerUrl: cfg?.brokerUrl ?? '',
      formMcMqttRegion: cfg?.region ?? '',
      formMcMqttUsername: cfg?.username ?? '',
      // Never seed the password back into the form — the server keeps the
      // stored value when this is left blank.
      formMcMqttPassword: '',
      formMcMqttRejectUnauthorized: cfg?.rejectUnauthorized !== false,
      formMcMqttAutoConnect: cfg?.autoConnect !== false,
    };
  }
  if (source.type === 'reticulum') {
    const rnsMode: 'attach' | 'tcp_peer' = cfg?.mode === 'tcp_peer' ? 'tcp_peer' : 'attach';
    const peer = Array.isArray(cfg?.peers) ? cfg.peers[0] : undefined;
    return {
      formType: 'reticulum',
      formName: source.name,
      formRnsMode: rnsMode,
      formRnsConfigDir: cfg?.configDir ?? '',
      formRnsBridgeUrl: cfg?.bridgeUrl ?? '',
      // Never seed the token back into the form — the server keeps the stored
      // value when this is left blank, as it does for the broker passwords.
      formRnsToken: '',
      formRnsAutoConnect: cfg?.autoConnect !== false,
      formRnsPeerHost: peer?.host ?? '',
      formRnsPeerPort: peer?.port != null ? String(peer.port) : '4965',
    };
  }
  if (source.type === 'mqtt_broker') {
    // Build the per-bridge rewrite form data from every mqtt_bridge
    // source that points at this broker. Empty rewrites are fine —
    // the UI just shows blank inputs.
    const attached = sources.filter(
      (s) => s.type === 'mqtt_bridge' && (s.config as any)?.brokerSourceId === source.id, // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
    );
    const rewrites: Record<string, BridgeRewrite> = {};
    for (const b of attached) {
      const bcfg = b.config as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
      rewrites[b.id] = {
        downlinkFrom: bcfg?.downlinkTopicRewrite?.from ?? '',
        downlinkTo: bcfg?.downlinkTopicRewrite?.to ?? '',
        uplinkFrom: bcfg?.uplinkTopicRewrite?.from ?? '',
        uplinkTo: bcfg?.uplinkTopicRewrite?.to ?? '',
      };
    }
    return {
      formType: 'mqtt_broker',
      formName: source.name,
      formMqttListenPort: String(cfg?.listener?.port ?? 1883),
      formMqttUsername: cfg?.auth?.username ?? '',
      // Non-admin GETs strip the password — leave the field empty, the
      // backend round-trips the existing value when the field stays empty.
      formMqttPassword: '',
      formMqttRootTopic: cfg?.rootTopic ?? 'msh',
      // New raise/clamp policy wins; a pre-4.17 source loads its legacy
      // "set to N" override as a clamp at N with the raise left off, plus a
      // notice explaining what saving will change.
      formMqttHopPolicy: formFromHopLimitConfig(cfg),
      formMqttLegacyHopNotice: legacyHopOverrideNotice(cfg),
      formBrokerBridgeRewrites: rewrites,
      // Deep clone for the comparison-on-save baseline. Object spread
      // would alias the nested rewrite objects and falsely report "no
      // changes" once the user edits.
      originalBrokerBridgeRewrites: JSON.parse(JSON.stringify(rewrites)),
    };
  }
  if (source.type === 'mqtt_bridge') {
    // Hydrate via the shared serializer so the modal and the dedicated
    // bridge Configuration page never drift on config shape.
    // Only the basics are edited here; advanced settings are preserved on
    // save (buildBridgeConfig merges over the existing config) and edited on
    // the Configuration page.
    const bf = formFromBridgeConfig(cfg);
    return {
      formType: 'mqtt_bridge',
      formName: source.name,
      formMqttBridgeBrokerId: bf.brokerId,
      formMqttBridgeUrl: bf.url,
      formMqttBridgeUsername: bf.username,
      formMqttBridgePassword: '',
      formMqttBridgeSubscriptions: bf.subscriptions,
    };
  }
  const vn = cfg?.virtualNode as
    | { enabled?: boolean; port?: number; allowAdminCommands?: boolean; allowPkiExport?: boolean; allowPkiImport?: boolean }
    | undefined;
  // Stored as ms; the UI works in whole hours for operator ergonomics.
  // Anything not a positive number leaves the field blank → server default.
  const staleMs = cfg?.passiveResyncStaleMs;
  const link = cfg?.mqttLink as { enabled?: boolean; mqttBrokerSourceId?: string } | undefined;
  return {
    formType: source.type === 'meshcore' ? 'meshcore' : 'meshtastic_tcp',
    formName: source.name,
    formHost: cfg?.host ?? '',
    formPort: String(cfg?.port ?? 4403),
    formVnEnabled: vn?.enabled === true,
    formVnPort: vn?.port != null ? String(vn.port) : '',
    formVnAllowAdmin: vn?.allowAdminCommands === true,
    formVnAllowPkiExport: vn?.allowPkiExport === true,
    formVnAllowPkiImport: vn?.allowPkiImport === true,
    formObserverStored: cfg?.observer,
    formHeartbeat: String(cfg?.heartbeatIntervalSeconds ?? 0),
    formHeartbeatTouched: true,
    // Default to true when unset (legacy sources pre-#2773 auto-connected).
    formAutoConnect: cfg?.autoConnect !== false,
    formPassiveMode: cfg?.passiveMode === true,
    formPassiveResyncStaleHours:
      typeof staleMs === 'number' && staleMs > 0 ? String(Math.round((staleMs / (60 * 60 * 1000)) * 100) / 100) : '',
    // MeshCore-specific config. transport=tcp is a v2 addition; legacy rows
    // with no transport field are treated as USB (the original v1 default).
    formMcTransport: cfg?.transport === 'tcp' ? 'tcp' : 'usb',
    formMcSerialPort: cfg?.serialPort ?? cfg?.port ?? '',
    formMcTcpHost: cfg?.tcpHost ?? '',
    formMcTcpPort: cfg?.tcpPort != null ? String(cfg.tcpPort) : MESHCORE_DEFAULT_TCP_PORT,
    formMcDeviceType: cfg?.deviceType === 'repeater' ? 'repeater' : 'companion',
    formMtMqttLinkBrokerId: link?.enabled && link.mqttBrokerSourceId ? link.mqttBrokerSourceId : '',
  };
}

/** Invalidate the source list so every list shows the change now (DashboardPage's `refreshSources`). */
function refreshSources(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sources'] });
}

/**
 * Today's Connect (DashboardPage `onConnectSource`, issue #2773), moved
 * verbatim: POST `/connect`, then re-poll the source's status every 1.5 s for
 * at most 20 s, stopping as soon as it reports connected. `signal` stops the
 * loop early (the Workspace flow passes one and aborts it on unmount).
 *
 * One connect per source at a time (Task 6.7): a press while one is running,
 * from any surface (Server › Devices' row, the Connection card), joins it
 * instead of sending a second POST. `useConnectInFlight` reads that state.
 */
export function connectSourceAndWait(queryClient: QueryClient, id: string, signal?: AbortSignal): Promise<void> {
  const running = connectsInFlight.get(id);
  if (running) return running;
  const connect = connectOnce(queryClient, id, signal).finally(() => {
    connectsInFlight.delete(id);
    connectListeners.forEach((l) => l());
  });
  connectsInFlight.set(id, connect);
  connectListeners.forEach((l) => l());
  return connect;
}

const connectsInFlight = new Map<string, Promise<void>>();
const connectListeners = new Set<() => void>();
const subscribeConnects = (listener: () => void) => {
  connectListeners.add(listener);
  return () => void connectListeners.delete(listener);
};

/** True while a `connectSourceAndWait` for this source is running, from any surface. */
export function useConnectInFlight(id: string): boolean {
  return useSyncExternalStore(subscribeConnects, () => connectsInFlight.has(id));
}

async function connectOnce(queryClient: QueryClient, id: string, signal?: AbortSignal): Promise<void> {
  try {
    await api.post(`/api/sources/${id}/connect`);
  } catch (err) {
    if (err instanceof ApiError) return;
    throw err;
  }

  refreshSources(queryClient);

  // Poll the per-source status endpoint up to 20s, bailing early on
  // connect success. Uses refetchQueries (not invalidate) so the loop
  // doesn't have to re-check cache state each tick — the refetched value
  // lands in the cache and fuels the next iteration's check.
  const deadlineMs = Date.now() + 20_000;
  while (Date.now() < deadlineMs && !signal?.aborted) {
    await queryClient.refetchQueries({ queryKey: ['dashboard', 'status', id], type: 'active' });
    const cached = queryClient.getQueriesData<{ connected?: boolean } | null>({ queryKey: ['dashboard', 'status', id] });
    const connected = cached.some(([, data]) => data?.connected === true);
    if (connected || signal?.aborted) break;
    // An abort ends the wait at once, so the in-flight mark clears with the surface that started it.
    await new Promise<void>((r) => {
      const onAbort = () => (clearTimeout(timer), r());
      const timer = setTimeout(() => (signal?.removeEventListener('abort', onAbort), r()), 1500);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * `editId`: start on that saved source, filled before the first render (the
 * Workspace's Edit). Classic passes none and fills on each open.
 */
export function useSourceForm(sources: DashboardSource[], editId?: string | null) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = editId ? sources.find((s) => s.id === editId) : undefined;
  const [values, setValues] = useState<SourceFormValues>(() => (editing ? { ...INITIAL, ...editValues(editing, sources) } : INITIAL));
  const [editingSourceId, setEditingSourceId] = useState<string | null>(editing ? editing.id : null);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const numbers = useNumberInputScope();

  // Stable, as the useState setters they replace (children may hold them in effect deps).
  const set = useCallback(<K extends keyof SourceFormValues>(field: K, next: SetStateAction<SourceFormValues[K]>) => {
    setValues((prev) => ({
      ...prev,
      [field]: typeof next === 'function' ? (next as (p: SourceFormValues[K]) => SourceFormValues[K])(prev[field]) : next,
    }));
  }, []);
  const setters = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(INITIAL) as Array<keyof SourceFormValues>).map((k) => [
          `set${k[0].toUpperCase()}${k.slice(1)}`,
          (next: SetStateAction<unknown>) => set(k, next as never),
        ]),
      ) as Setters,
    [set],
  );
  const patch = (p: Partial<SourceFormValues>) => setValues((prev) => ({ ...prev, ...p }));

  // The source being edited, for what the form may say about stored
  // credentials it does not show (see DashboardPage.maskedFields.ts).
  const editingSource: (MaskedFieldSource & { id: string }) | undefined = editingSourceId
    ? sources.find((s) => s.id === editingSourceId)
    : undefined;

  /** Placeholder for a password or token input: says so when a value is stored. */
  const secretPlaceholder = (path: string): string =>
    hasStoredSecret(editingSource, path)
      ? t('source.form.secret_stored_placeholder', 'Unchanged (leave blank to keep)')
      : '';

  const startAdd = () => {
    setEditingSourceId(null);
    patch(ADD_RESET);
    setFormError('');
  };

  /** Fill the form from a saved source, as today's Edit. False when it is not in the list. */
  const startEdit = (id: string): boolean => {
    const source = sources.find((s) => s.id === id);
    if (!source) return false;
    setEditingSourceId(id);
    patch(editValues(source, sources));
    setFormError('');
    return true;
  };

  const validate = ({ connectionOnly = false }: { connectionOnly?: boolean } = {}): string | null => {
    const built = buildSourceBody(values, editingSourceId, sources, t, connectionOnly);
    return 'error' in built ? built.error : null;
  };

  /** Today's Save. The saved source, or null (the reason is in `formError`). */
  const submit = async (): Promise<DashboardSource | null> => {
    // #5649: a blank or out-of-range port / interval is never saved.
    if (numbers.invalid) return null;
    const built = buildSourceBody(values, editingSourceId, sources, t);
    if ('error' in built) {
      setFormError(built.error);
      return null;
    }
    const formType = values.formType;

    setFormSaving(true);
    setFormError('');
    try {
      const body = built.body;
      let saved: DashboardSource;
      try {
        saved = editingSourceId
          ? await api.put<DashboardSource>(`/api/sources/${editingSourceId}`, body)
          : await api.post<DashboardSource>('/api/sources', body);
      } catch (err) {
        if (err instanceof ApiError) {
          const body = err.body as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
          const observerKey = observerErrorMessageKey(err.code ?? body?.code);
          setFormError(observerKey ? t(observerKey, body?.error ?? '') : (body?.error ?? t('source.form.error_save_failed')));
          return null;
        }
        throw err;
      }

      // Broker save succeeded — now push per-bridge topic-rewrite
      // changes for any bridges whose rewrite config differs from the
      // snapshot taken at modal-open. Each bridge gets its own PUT so a
      // failure on one doesn't roll back the others; we collect errors
      // and surface them at the end instead of aborting.
      if (formType === 'mqtt_broker' && editingSourceId) {
        const bridgeErrors: string[] = [];
        for (const [bridgeId, rewrites] of Object.entries(values.formBrokerBridgeRewrites)) {
          const before = values.originalBrokerBridgeRewrites[bridgeId];
          const unchanged =
            before &&
            before.downlinkFrom === rewrites.downlinkFrom &&
            before.downlinkTo === rewrites.downlinkTo &&
            before.uplinkFrom === rewrites.uplinkFrom &&
            before.uplinkTo === rewrites.uplinkTo;
          if (unchanged) continue;

          // Client-side mirror of the server's `error_rewrite_incomplete`
          // rule — both From and To are required for a direction, or
          // both must be empty.
          const dlPartial =
            (rewrites.downlinkFrom && !rewrites.downlinkTo) ||
            (!rewrites.downlinkFrom && rewrites.downlinkTo);
          const ulPartial =
            (rewrites.uplinkFrom && !rewrites.uplinkTo) ||
            (!rewrites.uplinkFrom && rewrites.uplinkTo);
          if (dlPartial || ulPartial) {
            const bridge = sources.find((s) => s.id === bridgeId);
            bridgeErrors.push(
              `${bridge?.name ?? bridgeId}: ${t(
                'source.form.error_rewrite_incomplete',
                'Both from and to are required when a topic rewrite is set',
              )}`,
            );
            continue;
          }

          const bridge = sources.find((s) => s.id === bridgeId);
          if (!bridge) continue;
          const bridgeConfig: Record<string, any> = { ...(bridge.config as any) }; // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
          if (rewrites.downlinkFrom && rewrites.downlinkTo) {
            bridgeConfig.downlinkTopicRewrite = {
              from: rewrites.downlinkFrom,
              to: rewrites.downlinkTo,
            };
          } else {
            delete bridgeConfig.downlinkTopicRewrite;
          }
          if (rewrites.uplinkFrom && rewrites.uplinkTo) {
            bridgeConfig.uplinkTopicRewrite = {
              from: rewrites.uplinkFrom,
              to: rewrites.uplinkTo,
            };
          } else {
            delete bridgeConfig.uplinkTopicRewrite;
          }
          try {
            await api.put(`/api/sources/${bridgeId}`, {
              name: bridge.name,
              type: 'mqtt_bridge',
              config: bridgeConfig,
              enabled: bridge.enabled,
            });
          } catch (e) {
            if (e instanceof ApiError) {
              bridgeErrors.push(`${bridge.name}: ${(e.body as any)?.error ?? 'save failed'}`); // eslint-disable-line @typescript-eslint/no-explicit-any -- #6365 moved verbatim
            } else {
              bridgeErrors.push(`${bridge.name}: ${(e as Error).message}`);
            }
          }
        }
        if (bridgeErrors.length > 0) {
          // Broker is saved; only the bridge updates partially failed.
          // Keep the modal open so the user can correct the issues
          // (probably partial-row validation problems above).
          setFormError(
            t(
              'source.form.bridge_rewrite_partial_error',
              'Broker saved but some bridge rewrites failed: ',
            ) + bridgeErrors.join('; '),
          );
          refreshSources(queryClient);
          return null;
        }
      }

      refreshSources(queryClient);
      // From here the form edits what it saved, so a second Save is a PUT
      // (the Workspace flow's Edit connection). Classic resets on every open.
      if (!editingSourceId && saved?.id) setEditingSourceId(saved.id);
      return saved;
    } catch {
      setFormError(t('source.form.error_network'));
      return null;
    } finally {
      setFormSaving(false);
    }
  };

  return {
    ...values,
    ...setters,
    values,
    set,
    numbers,
    editingSourceId,
    editingSource,
    secretPlaceholder,
    formError,
    formSaving,
    startAdd,
    startEdit,
    validate,
    submit,
  };
}

export type SourceForm = ReturnType<typeof useSourceForm>;
