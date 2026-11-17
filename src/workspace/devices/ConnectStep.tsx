/**
 * Add device, step 3 (h3, i3): the name and today's auto-connect (and, for a
 * Meshtastic node, today's virtual node, MQTT link and passive mode), then
 * what Save found.
 *
 * Save is today's add: the server starts the device's manager (when it
 * connects on startup) and answers once the first connect attempt is over.
 * The result then reads the device's status once (`GET /api/sources/:id/
 * status`, the key the shell's device poll fills, with no timer of its own),
 * and a Meshtastic node's channel list once it is connected. Nothing is sent
 * to the radio beyond what today's add starts.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useIsPhone } from '../shell/useIsPhone';
import { Advanced, Check, Field, PassiveMode } from './ConnectionStep';
import { autoConnectOf, type ConnectPhase, type useConnectResult } from './connectResult';
import { endpointOf } from './deviceInfo';
import type { SourceForm } from './useSourceForm';
import styles from './Devices.module.css';

export function NameFields({ form: f, sources, locked }: { form: SourceForm; sources: DashboardSource[]; locked: boolean }) {
  const { t } = useTranslation();
  const auto = autoConnectOf(f);
  const brokers = sources.filter((s) => s.type === 'mqtt_broker');
  return (
    <fieldset className={styles.fieldset} disabled={locked}>
      <Field label={t('source.form.name')} help={t('workspace.devices.name_help')}>
        <input className={styles.input} type="text" value={f.formName} onChange={(e) => f.setFormName(e.target.value)} placeholder={t('source.form.name_placeholder')} />
      </Field>
      {auto && <Check label={t('source.form.auto_connect')} help={t('source.form.auto_connect_help')} checked={auto.checked} onChange={auto.set} />}
      {f.formType === 'meshtastic_tcp' && (
        <Advanced label={t('workspace.devices.advanced_name')}>
          <Check label={t('source.form.enable_virtual_node')} checked={f.formVnEnabled} onChange={f.setFormVnEnabled} />
          {f.formVnEnabled && (
            <>
              <Field label={t('source.form.virtual_node_port')}>
                <NumberInput
                  className={styles.input}
                  integer
                  min={1}
                  max={65535}
                  value={f.formVnPort.trim() === '' ? null : Number(f.formVnPort)}
                  onChange={(v) => f.setFormVnPort(String(v))}
                  placeholder="4403"
                />
              </Field>
              <Check label={t('source.form.allow_admin_commands')} help={t('source.form.allow_admin_help')} checked={f.formVnAllowAdmin} onChange={f.setFormVnAllowAdmin} />
            </>
          )}
          {brokers.length > 0 && (
            <Field
              label={t('source.form.mqtt_proxy_link', 'Bridge MQTT proxy to')}
              help={t('source.form.mqtt_proxy_link_help', 'When set, MeshMonitor relays the device’s MQTT traffic to the selected embedded broker and feeds broker traffic back to it. Requires Proxy to Client on in the device’s MQTT module. To link the device straight to a bridge instead, use Quick configure on its Device Configuration → MQTT Module page.')}
            >
              <select className={styles.input} value={f.formMtMqttLinkBrokerId} onChange={(e) => f.setFormMtMqttLinkBrokerId(e.target.value)}>
                <option value="">{t('source.form.mqtt_proxy_none', 'None — device handles MQTT directly')}</option>
                {brokers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <PassiveMode form={f} />
        </Advanced>
      )}
    </fieldset>
  );
}

type RowState = 'done' | 'pending' | 'fail';
const ROW_ICON: Record<RowState, UiIconName> = { done: 'securityCheck', pending: 'refresh', fail: 'alert' };

function Row({ state, label, detail }: { state: RowState; label: string; detail?: string | number | null }) {
  return (
    <li className={styles.resultRow} data-state={state}>
      <UiIcon name={ROW_ICON[state]} size={18} />
      <span className={styles.resultLabel}>{label}</span>
      {detail != null && detail !== '' && <span className={styles.resultDetail}>{detail}</span>}
    </li>
  );
}

export function ConnectResult({
  saved,
  result,
  retrying,
}: {
  saved: DashboardSource;
  result: ReturnType<typeof useConnectResult>;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { phase, live, channelCount } = result;
  const endpoint = endpointOf(saved.type, saved.config, (port) => t('workspace.devices.port', { port }));
  const shown: ConnectPhase = retrying ? 'pending' : phase;
  const meshtastic = saved.type === 'meshtastic_tcp';
  const reason = typeof live?.permissionMessage === 'string' && live.permissionMessage
    ? live.permissionMessage
    : t(meshtastic ? 'workspace.devices.failed_meshtastic' : 'workspace.devices.failed_other');
  return (
    <section className={styles.result} data-phone={isPhone || undefined} aria-live="polite">
      <h3 className={styles.resultHead}>{t('workspace.devices.connecting')}</h3>
      <ul className={styles.resultList}>
        <Row
          state={shown === 'connected' ? 'done' : shown === 'failed' ? 'fail' : 'pending'}
          label={t('workspace.devices.reached', { endpoint })}
        />
        {shown !== 'failed' && shown !== 'idle' && (
          <>
            {meshtastic && (
              <>
                <Row state={live?.nodeNum != null || live?.nodeId ? 'done' : 'pending'} label={t('workspace.devices.node_info')} detail={typeof live?.nodeId === 'string' ? live.nodeId : null} />
                <Row state={channelCount != null ? 'done' : 'pending'} label={t('workspace.devices.channels')} detail={channelCount} />
              </>
            )}
            <Row state="pending" label={t('workspace.devices.node_db')} detail={shown === 'connected' ? live?.nodeCount ?? null : null} />
          </>
        )}
      </ul>
      {shown === 'connected' && (
        <p className={styles.success} role="status">
          <UiIcon name="securityCheck" size={16} />
          <span>{t('workspace.devices.connected')}</span>
        </p>
      )}
      {shown === 'idle' && (
        <p className={styles.info}>
          <UiIcon name="info" size={16} />
          <span>
            <strong>{t('source.status_idle')}.</strong> {t('source.connect_help')}
          </span>
        </p>
      )}
      {shown === 'failed' && (
        <p className={styles.failure} role="alert">
          <UiIcon name="alert" size={16} />
          <span>
            <strong>{t('workspace.devices.failed')}</strong> {reason}
          </span>
        </p>
      )}
    </section>
  );
}
