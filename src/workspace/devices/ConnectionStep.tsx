/**
 * Add device, step 2 (h2, i2, 18-09, 18-10): today's per-type connection
 * fields from the source form, bound to `useSourceForm`, so what is saved is
 * what today's form saves. The less used fields sit under an Advanced
 * disclosure; nothing of today's form is dropped.
 *
 * Secrets: password and token fields are today's `PasswordField` with
 * today's placeholder for a stored value, which is never put back in the
 * field (`DashboardPage.maskedFields`).
 */
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { PasswordField } from '../../components/shared/config/PasswordField';
import { DroppedSecretNote, HiddenUrlPartsNote } from '../../components/Dashboard/StoredSecretNotes';
import HopLimitPolicyFields from '../../components/MQTT/HopLimitPolicyFields';
import { MqttDocsLinks } from '../../components/MQTT/MqttDocsLinks';
import { MqttRootFinder } from '../../components/MQTT/MqttRootFinder';
import { applyRootToSubscriptions, defaultBridgeRegionRoot } from '../../components/MQTT/mqttRootDefaults';
import { MESHCORE_DEFAULT_TCP_PORT } from '../../constants';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { hasHiddenUrlParts, storedSecretWillBeDropped } from '../../pages/DashboardPage.maskedFields';
import SettingSegmented from '../settings/kit/SettingSegmented';
import RowSwitch from '../server/RowSwitch';
import { useIsPhone } from '../shell/useIsPhone';
import { typeInfo } from './deviceInfo';
import type { SourceForm } from './useSourceForm';
import styles from './Devices.module.css';

/** The bridge URL a Reticulum source uses when the field is left blank (DashboardPage). */
const RETICULUM_DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:8765';

export function Field({ label, help, children }: { label: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        <span>{label}</span>
        {children}
      </label>
      {help && <p className={styles.help}>{help}</p>}
    </div>
  );
}

/**
 * A labelled choice that is not a form input (a segmented control): no <label> around it, which
 * would make a click on the label text press the first option and lend it the label as its name.
 */
function Choice({ label, help, value, options, onChange }: { label: string; help?: ReactNode; value: string; options: ReadonlyArray<{ value: string; label: string }>; onChange(v: string): void }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>
        <span id={id}>{label}</span>
        <SettingSegmented labelledBy={id} value={value} options={options} onChange={onChange} />
      </div>
      {help && <p className={styles.help}>{help}</p>}
    </div>
  );
}

export function Check({ label, help, checked, onChange }: { label: string; help?: ReactNode; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className={styles.field}>
      <label className={styles.check}>
        <RowSwitch label={label} checked={checked} onChange={onChange} />
        <span>{label}</span>
      </label>
      {help && <p className={styles.help}>{help}</p>}
    </div>
  );
}

/** A collapsed group, as the boards' "Advanced · …" lines. */
export function Advanced({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className={styles.advanced}>
      <summary className={styles.advancedSummary}>
        <UiIcon name="chevronRight" size={16} />
        <span>{label}</span>
      </summary>
      <div className={styles.advancedBody}>{children}</div>
    </details>
  );
}

/** An integer field in today's range, in the form's number scope. */
function Num({ value, onChange, min, max, placeholder, label }: { value: string; onChange(v: string): void; min: number; max: number; placeholder: string; label?: string }) {
  return (
    <NumberInput
      className={styles.input}
      integer
      min={min}
      max={max}
      aria-label={label}
      value={value.trim() === '' ? null : Number(value)}
      onChange={(v) => onChange(String(v))}
      placeholder={placeholder}
    />
  );
}

function Head({ type, title, lead }: { type: string; title: string; lead?: string }) {
  const info = typeInfo(type);
  return (
    <div className={styles.head}>
      <span className={styles.typeIcon} style={{ background: `var(--device-${info?.tone ?? 1})` }}>
        <UiIcon name={info?.icon ?? 'radio'} size={22} />
      </span>
      <span className={styles.typeText}>
        <span className={styles.headTitle}>{title}</span>
        {lead && <span className={styles.typeDesc}>{lead}</span>}
      </span>
    </div>
  );
}

export default function ConnectionStep({ form, sources }: { form: SourceForm; sources: DashboardSource[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const f = form;
  const editingSource = f.editingSource;
  const brokers = sources.filter((s) => s.type === 'mqtt_broker');

  let body: ReactNode;
  if (f.formType === 'meshtastic_tcp') {
    body = (
      <>
        <Head type="meshtastic_tcp" title={t('workspace.devices.meshtastic_title')} lead={t('workspace.devices.meshtastic_lead')} />
        <div className={styles.pair} data-phone={isPhone || undefined}>
          <Field label={t('source.form.host')}>
            <input className={styles.input} type="text" value={f.formHost} onChange={(e) => f.setFormHost(e.target.value)} placeholder={t('source.form.host_placeholder')} />
          </Field>
          <Field label={t('source.form.tcp_port')}>
            <Num value={f.formPort} onChange={f.setFormPort} min={1} max={65535} placeholder="4403" />
          </Field>
        </div>
        <p className={styles.info}>
          <UiIcon name="info" size={16} />
          <span>{t('workspace.devices.bluetooth_note')}</span>
        </p>
        <Advanced label={t('workspace.devices.advanced_meshtastic')}>
          <Field label={t('source.form.heartbeat')} help={t('source.form.heartbeat_help')}>
            <NumberInput
              className={styles.input}
              integer
              min={0}
              max={3600}
              value={f.formHeartbeat.trim() === '' ? null : Number(f.formHeartbeat)}
              onChange={(v) => { f.setFormHeartbeat(String(v)); f.setFormHeartbeatTouched(true); }}
              placeholder="0"
            />
          </Field>
          <PassiveMode form={f} />
        </Advanced>
      </>
    );
  } else if (f.formType === 'meshcore') {
    body = (
      <>
        <Head type="meshcore" title={t('workspace.devices.type.meshcore')} />
        <Choice
          label={t('workspace.devices.connected_by')}
          value={f.formMcTransport}
          options={[
            { value: 'usb', label: t('workspace.devices.usb') },
            { value: 'tcp', label: t('workspace.devices.network') },
          ]}
          onChange={(v) => f.setFormMcTransport(v === 'tcp' ? 'tcp' : 'usb')}
        />
        {f.formMcTransport === 'tcp' ? (
          <div className={styles.pair} data-phone={isPhone || undefined}>
            <Field label={t('source.form.host')} help={t('meshcore.form.tcp_host_help', 'Hostname or IP of the MeshCore companion reachable over TCP (e.g. esp-link, ser2net, or native TCP firmware).')}>
              <input className={styles.input} type="text" value={f.formMcTcpHost} onChange={(e) => f.setFormMcTcpHost(e.target.value)} placeholder={t('source.form.host_placeholder')} />
            </Field>
            <Field label={t('source.form.tcp_port')}>
              <Num value={f.formMcTcpPort} onChange={f.setFormMcTcpPort} min={1} max={65535} placeholder={MESHCORE_DEFAULT_TCP_PORT} />
            </Field>
          </div>
        ) : (
          <Field label={t('workspace.devices.serial_port')} help={t('meshcore.form.serial_port_help', 'OS path of the USB-connected MeshCore companion (e.g. /dev/ttyACM0, COM3).')}>
            <input className={styles.input} type="text" value={f.formMcSerialPort} onChange={(e) => f.setFormMcSerialPort(e.target.value)} placeholder="/dev/ttyACM0" />
          </Field>
        )}
        <Choice
          label={t('workspace.devices.firmware')}
          help={t('workspace.devices.repeater_note')}
          value={f.formMcDeviceType}
          options={[
            { value: 'companion', label: t('meshcore.device_type.companion', 'Companion') },
            { value: 'repeater', label: t('meshcore.device_type.repeater', 'Repeater') },
          ]}
          onChange={(v) => {
            const next = v === 'repeater' ? 'repeater' : 'companion';
            f.setFormMcDeviceType(next);
            // New source, field untouched: the Repeater probe stays off until the user sets it (#5563).
            if (!f.editingSourceId && !f.formHeartbeatTouched) f.setFormHeartbeat(next === 'repeater' ? '0' : '30');
          }}
        />
        <Advanced label={t('workspace.devices.advanced_meshcore')}>
          <Field label={t('source.form.heartbeat')} help={t('meshcore.form.heartbeat_help', 'Seconds between health probes (0 = disabled). After three failed probes the source reconnects on its own, with backoff. Works for Companion and Repeater devices. The probe stays on the local link and sends nothing over the radio.')}>
            <NumberInput
              className={styles.input}
              integer
              min={0}
              max={3600}
              value={f.formHeartbeat.trim() === '' ? null : Number(f.formHeartbeat)}
              onChange={(v) => { f.setFormHeartbeat(String(v)); f.setFormHeartbeatTouched(true); }}
              placeholder="0"
            />
          </Field>
          <Check label={t('meshcore.form.enable_virtual_node', 'Expose this node to the MeshCore app over WiFi')} checked={f.formVnEnabled} onChange={f.setFormVnEnabled} />
          {f.formVnEnabled && (
            <>
              <Field label={t('source.form.virtual_node_port')} help={t('meshcore.form.virtual_node_help', 'TCP port the MeshCore mobile app connects to. Point the app at this host and port over WiFi.')}>
                <Num value={f.formVnPort} onChange={f.setFormVnPort} min={1} max={65535} placeholder="5000" />
              </Field>
              <Check label={t('meshcore.form.allow_admin_commands', 'Allow admin commands')} help={t('meshcore.form.allow_admin_help', 'Third-party clients connected to the virtual node can send config/admin commands to your MeshCore node. Leave off unless you trust the clients.')} checked={f.formVnAllowAdmin} onChange={f.setFormVnAllowAdmin} />
              <Check label={t('meshcore.form.allow_pki_export', 'Allow PKI export')} help={t('meshcore.form.allow_pki_export_help', 'Let connected clients read your node\'s private key. Some tools (e.g. Remote-Terminal\'s community MQTT) require it to authenticate as your node. The virtual node port has no client authentication, so anyone who can reach it can copy your node identity. Leave off unless you need it. Requires node firmware built with ENABLE_PRIVATE_KEY_EXPORT.')} checked={f.formVnAllowPkiExport} onChange={f.setFormVnAllowPkiExport} />
              <Check label={t('meshcore.form.allow_pki_import', 'Allow PKI import')} help={<span className={styles.warn}>{t('meshcore.form.allow_pki_import_help', 'Danger: lets any connected client permanently replace your node\'s identity with a key it chooses. The virtual node port has no client authentication, so anyone who can reach it could take over your node\'s identity, and the old identity is lost unless you exported it first. Leave off unless you are restoring a backed-up key right now, then turn it off again. Requires node firmware built with ENABLE_PRIVATE_KEY_IMPORT.')}</span>} checked={f.formVnAllowPkiImport} onChange={f.setFormVnAllowPkiImport} />
            </>
          )}
          <p className={styles.help}>
            {f.formMcDeviceType === 'repeater'
              ? t('meshcore.form.observer_repeater_note', 'The Analyzer Observer requires a Companion device — a repeater cannot export the signing key it needs.')
              : f.editingSourceId
                ? t('meshcore.form.observer_moved', "Turn the Analyzer Observer on, choose its brokers and set their logins on this source's MeshCore → Configuration page.")
                : t('meshcore.form.observer_moved_new', 'Save the source first. Then turn the Analyzer Observer on and choose its brokers on its MeshCore → Configuration page.')}
          </p>
        </Advanced>
      </>
    );
  } else if (f.formType === 'meshcore_mqtt') {
    body = (
      <>
        <Head type="meshcore_mqtt" title={t('workspace.devices.type.meshcore_mqtt')} lead={t('source.form.mc_mqtt_intro', 'Reads a MeshCore Analyzer region feed over MQTT. This source has no radio: it can never transmit, and shows no device, contacts, or remote-admin pages.')} />
        <Field label={t('source.form.mc_mqtt_broker_url', 'Broker URL')} help={<>
          <HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'brokerUrl')} />
          {t('source.form.mc_mqtt_broker_url_help', 'One broker per source. Accepts ws://, wss://, mqtt://, mqtts://, or host:port. Add a second source for a second broker.')}
        </>}>
          <input className={styles.input} type="text" value={f.formMcMqttBrokerUrl} onChange={(e) => f.setFormMcMqttBrokerUrl(e.target.value)} placeholder="wss://mqtt.meshmapper.net:443" />
        </Field>
        <Field label={t('source.form.mc_mqtt_region', 'Region (IATA)')} help={t('source.form.mc_mqtt_region_help', 'The region segment of the topic this source subscribes to. Uppercased on save.')}>
          <input className={styles.input} type="text" value={f.formMcMqttRegion} onChange={(e) => f.setFormMcMqttRegion(e.target.value)} placeholder="MCO" />
        </Field>
        <MqttRootFinder
          protocol="meshcore"
          context="meshcore_mqtt"
          sourceId={editingSource?.id ?? null}
          currentRoot={f.formMcMqttRegion.trim().toUpperCase()}
          defaultRegionRoot=""
          getTarget={() =>
            f.formMcMqttBrokerUrl.trim()
              ? { broker: { url: f.formMcMqttBrokerUrl.trim() }, username: f.formMcMqttUsername, password: f.formMcMqttPassword, rejectUnauthorized: f.formMcMqttRejectUnauthorized }
              : null
          }
          onPickRoot={(code) => f.setFormMcMqttRegion(code.toUpperCase())}
        />
        <div className={styles.pair} data-phone={isPhone || undefined}>
          <Field label={t('source.form.mc_mqtt_username', 'Username (optional)')}>
            <input className={styles.input} type="text" value={f.formMcMqttUsername} onChange={(e) => f.setFormMcMqttUsername(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={t('source.form.mc_mqtt_password', 'Password (optional)')} help={<>
            <DroppedSecretNote dropped={storedSecretWillBeDropped(editingSource, 'password', f.formMcMqttPassword, String(editingSource?.config?.brokerUrl ?? ''), f.formMcMqttBrokerUrl)} />
            {t('source.form.mc_mqtt_password_help', 'Only for brokers using fixed MQTT credentials. Leave both blank for an open broker.')}
          </>}>
            <PasswordField className={styles.input} value={f.formMcMqttPassword} onChange={(e) => f.setFormMcMqttPassword(e.target.value)} autoComplete="new-password" placeholder={f.secretPlaceholder('password')} />
          </Field>
        </div>
        <Check label={t('source.form.mc_mqtt_reject_unauthorized', 'Verify TLS certificate')} checked={f.formMcMqttRejectUnauthorized} onChange={f.setFormMcMqttRejectUnauthorized} />
      </>
    );
  } else if (f.formType === 'mqtt_broker') {
    body = (
      <>
        <Head type="mqtt_broker" title={t('workspace.devices.type.mqtt_broker')} lead={t('workspace.devices.type.mqtt_broker_desc')} />
        <MqttDocsLinks />
        <Field label={t('source.form.mqtt_listen_port', 'Listen port')} help={t('source.form.mqtt_listen_port_help', 'Devices configure their MQTT module to point at this port on the MeshMonitor host.')}>
          <Num value={f.formMqttListenPort} onChange={f.setFormMqttListenPort} min={1} max={65535} placeholder="1883" />
        </Field>
        <div className={styles.pair} data-phone={isPhone || undefined}>
          <Field label={t('source.form.mqtt_username', 'Username')}>
            <input className={styles.input} type="text" value={f.formMqttUsername} onChange={(e) => f.setFormMqttUsername(e.target.value)} />
          </Field>
          <Field label={t('source.form.mqtt_password', 'Password')}>
            <PasswordField className={styles.input} value={f.formMqttPassword} onChange={(e) => f.setFormMqttPassword(e.target.value)} autoComplete="new-password" placeholder={f.secretPlaceholder('auth.password')} />
          </Field>
        </div>
        <Field label={t('source.form.mqtt_root_topic', 'Root topic')}>
          <input className={styles.input} type="text" value={f.formMqttRootTopic} onChange={(e) => f.setFormMqttRootTopic(e.target.value)} placeholder="msh" />
        </Field>
        <HopLimitPolicyFields value={f.formMqttHopPolicy} onChange={f.setFormMqttHopPolicy} legacyNotice={f.formMqttLegacyHopNotice} />
      </>
    );
  } else if (f.formType === 'mqtt_bridge') {
    body = (
      <>
        <Head type="mqtt_bridge" title={t('workspace.devices.type.mqtt_bridge')} lead={t('workspace.devices.type.mqtt_bridge_desc')} />
        <MqttDocsLinks />
        <Field label={t('source.form.mqtt_bridge_broker', 'Parent broker (optional)')} help={t('source.form.mqtt_bridge_broker_help', 'With a parent broker, the bridge also republishes upstream traffic to local devices and forwards their packets upstream. Without one, it runs as a pure MQTT client — useful for monitoring or as a client-proxy target for a Meshtastic source.')}>
          <select className={styles.input} value={f.formMqttBridgeBrokerId} onChange={(e) => f.setFormMqttBridgeBrokerId(e.target.value)}>
            <option value="">{t('source.form.mqtt_bridge_broker_none', 'None — standalone client proxy')}</option>
            {brokers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label={t('source.form.mqtt_upstream_url', 'Upstream URL')} help={<HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'upstream.url')} />}>
          <input className={styles.input} type="text" value={f.formMqttBridgeUrl} onChange={(e) => f.setFormMqttBridgeUrl(e.target.value)} placeholder="mqtt://mqtt.meshtastic.org:1883" />
        </Field>
        <div className={styles.pair} data-phone={isPhone || undefined}>
          <Field label={t('source.form.mqtt_username', 'Username')}>
            <input className={styles.input} type="text" value={f.formMqttBridgeUsername} onChange={(e) => f.setFormMqttBridgeUsername(e.target.value)} />
          </Field>
          <Field label={t('source.form.mqtt_password', 'Password')} help={
            <DroppedSecretNote
              dropped={storedSecretWillBeDropped(
                editingSource,
                'upstream.password',
                f.formMqttBridgePassword,
                String((editingSource?.config as { upstream?: { url?: unknown } } | undefined)?.upstream?.url ?? ''),
                f.formMqttBridgeUrl,
              )}
            />
          }>
            <PasswordField className={styles.input} value={f.formMqttBridgePassword} onChange={(e) => f.setFormMqttBridgePassword(e.target.value)} autoComplete="new-password" placeholder={f.secretPlaceholder('upstream.password')} />
          </Field>
        </div>
        <Field label={t('source.form.mqtt_subscriptions', 'Upstream topics (one per line)')}>
          <textarea className={styles.input} rows={3} value={f.formMqttBridgeSubscriptions} onChange={(e) => f.setFormMqttBridgeSubscriptions(e.target.value)} />
        </Field>
        <MqttRootFinder
          context="bridge"
          sourceId={editingSource?.id ?? null}
          currentRoot={f.formMqttBridgeSubscriptions.split('\n')[0]?.trim() ?? ''}
          defaultRegionRoot={defaultBridgeRegionRoot(f.formMqttBridgeSubscriptions)}
          getTarget={() =>
            f.formMqttBridgeUrl.trim()
              ? { broker: { url: f.formMqttBridgeUrl }, username: f.formMqttBridgeUsername, password: f.formMqttBridgePassword }
              : null
          }
          onPickRoot={(root) => f.setFormMqttBridgeSubscriptions(applyRootToSubscriptions(f.formMqttBridgeSubscriptions, root))}
        />
        <p className={styles.help}>{t('source.form.mqtt_bridge_advanced_hint', 'Mode, forwarding, publish/subscribe filters, geofence, and topic rewrites are on the bridge’s Configuration page.')}</p>
      </>
    );
  } else {
    body = (
      <>
        <Head type="reticulum" title={t('workspace.devices.type.reticulum')} lead={t('workspace.devices.reticulum_lead')} />
        <Choice
          label={t('reticulum.form.mode', 'Mode')}
          help={f.formRnsMode === 'attach'
            ? t('reticulum.form.mode_attach_help', 'The bridge sidecar joins a shared rnsd instance by reading its RNS config directory.')
            : t('reticulum.form.mode_tcp_peer_help', 'The bridge sidecar runs its own RNS instance and dials out to a single TCPClientInterface peer — no local rnsd or config directory needed.')}
          value={f.formRnsMode}
          options={[
            { value: 'attach', label: t('reticulum.form.mode_attach', 'Attach to shared rnsd') },
            { value: 'tcp_peer', label: t('reticulum.form.mode_tcp_peer', 'TCP peer') },
          ]}
          onChange={(v) => f.setFormRnsMode(v === 'tcp_peer' ? 'tcp_peer' : 'attach')}
        />
        {f.formRnsMode === 'attach' ? (
          <Field label={t('reticulum.form.config_dir', 'Config directory')} help={t('reticulum.form.config_dir_help', "Directory of the shared rnsd instance's RNS config, as seen by the bridge sidecar's container/host.")}>
            <input className={styles.input} type="text" value={f.formRnsConfigDir} onChange={(e) => f.setFormRnsConfigDir(e.target.value)} placeholder="/rns" />
          </Field>
        ) : (
          <>
            <Field label={t('source.form.host')}>
              <input className={styles.input} type="text" value={f.formRnsPeerHost} onChange={(e) => f.setFormRnsPeerHost(e.target.value)} placeholder="amsterdam.connect.reticulum.network" />
            </Field>
            <div className={styles.short}>
              <Field label={t('source.form.tcp_port')}>
                <Num value={f.formRnsPeerPort} onChange={f.setFormRnsPeerPort} min={1} max={65535} placeholder="4965" />
              </Field>
            </div>
          </>
        )}
        <div className={styles.pair} data-phone={isPhone || undefined}>
          <Field label={t('reticulum.form.bridge_url', 'Bridge URL')} help={<>
            <HiddenUrlPartsNote hidden={hasHiddenUrlParts(editingSource, 'bridgeUrl')} />
            {t('reticulum.form.bridge_url_help', 'WebSocket URL of the meshmonitor-rns-bridge sidecar. Defaults to ws://127.0.0.1:8765 when left blank.')}
          </>}>
            <input className={styles.input} type="text" value={f.formRnsBridgeUrl} onChange={(e) => f.setFormRnsBridgeUrl(e.target.value)} placeholder={RETICULUM_DEFAULT_BRIDGE_URL} />
          </Field>
          <Field label={t('reticulum.form.token', 'Bridge token')} help={<>
            <DroppedSecretNote
              dropped={storedSecretWillBeDropped(
                editingSource,
                'token',
                f.formRnsToken,
                String(editingSource?.config?.bridgeUrl ?? '') || RETICULUM_DEFAULT_BRIDGE_URL,
                f.formRnsBridgeUrl.trim() || RETICULUM_DEFAULT_BRIDGE_URL,
              )}
            />
            {t('reticulum.form.token_help', "Shared secret for the bridge's hello handshake — must match the bridge sidecar's BRIDGE_TOKEN.")}
          </>}>
            <PasswordField className={styles.input} aria-label={t('reticulum.form.token', 'Bridge token')} value={f.formRnsToken} onChange={(e) => f.setFormRnsToken(e.target.value)} autoComplete="new-password" placeholder={f.secretPlaceholder('token')} />
          </Field>
        </div>
      </>
    );
  }
  return <div className={styles.step}>{body}</div>;
}

/** Today's Passive Mode and its resync window (Meshtastic only). */
export function PassiveMode({ form: f }: { form: SourceForm }) {
  const { t } = useTranslation();
  return (
    <>
      <Check
        label={t('source.form.passive_mode', 'Passive Mode')}
        help={t('source.form.passive_mode_help', 'Reduces outbound requests to large or fragile TCP nodes. Preserves cached config across reconnects and skips post-config device requests. Recommended for router-class nodes with large NodeDBs.')}
        checked={f.formPassiveMode}
        onChange={f.setFormPassiveMode}
      />
      {f.formPassiveMode && (
        <Field
          label={t('source.form.passive_resync_stale_hours', 'Resync staleness window (hours)')}
          help={t('source.form.passive_resync_stale_help', 'How long the cached config stays valid after a disconnect before the next reconnect forces a full sync. Leave blank for 4 hours (default). Range: 1 minute – 7 days.')}
        >
          <NumberInput
            className={styles.input}
            allowEmpty
            min={0.0167}
            max={168}
            step={0.5}
            value={f.formPassiveResyncStaleHours.trim() === '' ? null : Number(f.formPassiveResyncStaleHours)}
            onChange={(v) => f.setFormPassiveResyncStaleHours(v === null ? '' : String(v))}
            placeholder={t('source.form.passive_resync_stale_default', '4 (default)')}
          />
        </Field>
      )}
    </>
  );
}
