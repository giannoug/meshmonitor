/**
 * The one category still drawn by today's section (Task 5.2, decision 1):
 * Modules › MQTT keeps MQTTConfigSection (Ruling 5.6: its save also writes the
 * broker preset and the MQTT link), fed from the frame's one device-config
 * instance (Ruling DG) and saving through today's handler and SaveBar.
 * Lazily loaded by `categories.ts`.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ModuleAvailabilityGate from '../../components/configuration/ModuleAvailabilityGate';
import MQTTConfigSection from '../../components/configuration/MQTTConfigSection';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { useSharedDeviceConfig, type SharedDeviceConfig } from './sharedDeviceConfig';
import '../../styles/settings.css';
import styles from './ClassicCategories.module.css';
import { useRemoteTarget } from './remote/useRemoteTarget';
import RemoteMqttCategory from './remote/RemoteMqttCategory';

type Stripped<T, P extends string> = {
  [K in keyof T as K extends `${P}${infer R}`
    ? R extends '' ? never : Uncapitalize<R>
    : K extends `set${Capitalize<P>}${infer R}` ? R extends '' ? never : `set${R}` : never]: T[K];
};

/**
 * A module's values and setters under the names its section takes:
 * `extNotifEnabled` / `setExtNotifEnabled` → `enabled` / `setEnabled`.
 */
function strip<P extends string>(state: DeviceConfigState, prefix: P): Stripped<DeviceConfigState, P> {
  const setter = `set${prefix[0].toUpperCase()}${prefix.slice(1)}`;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    if (k.startsWith(setter) && k.length > setter.length) out[`set${k.slice(setter.length)}`] = v;
    else if (k.startsWith(prefix) && k.length > prefix.length && /[A-Z0-9]/.test(k[prefix.length])) {
      out[k[prefix.length].toLowerCase() + k.slice(prefix.length + 1)] = v;
    }
  }
  return out as Stripped<DeviceConfigState, P>;
}

/** Today's section once the device's configuration has loaded. */
function Radio({ render }: { render: (c: SharedDeviceConfig) => ReactNode }) {
  const { t } = useTranslation();
  const config = useSharedDeviceConfig();
  if (!config || config.state.loading) return <p className={styles.loading}>{t('config.loading')}</p>;
  return <div className={styles.sections}>{render(config)}</div>;
}

// MQTT reads configuration:write for this source itself, as today. A remote node's MQTT is drawn on the kit (Task 5.9).
export function MqttCategory() {
  const remote = useRemoteTarget();
  if (remote) return <RemoteMqttCategory />;
  return (
    <Radio
      render={({ state, saves }) => (
        <ModuleAvailabilityGate available={state.supportedModules?.mqtt} moduleName="MQTT">
          <MQTTConfigSection {...state} {...strip(state, 'mqtt')} loraRegion={state.region} onSave={saves.mqtt} />
        </ModuleAvailabilityGate>
      )}
    />
  );
}
