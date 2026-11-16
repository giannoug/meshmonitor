/**
 * Each category's page until Tasks 5.3–5.8 build it on the row kit: today's
 * section for it, rendered with the props it takes today (Task 5.2, decision
 * 1), so every control a power user uses is still there (spec §2).
 *
 * - On the radio: MQTT's section (Ruling 5.6: its save also writes the broker
 *   preset and the MQTT link), fed from the frame's one device-config instance
 *   (Ruling DG) and saving through today's handler and SaveBar.
 * - In MeshMonitor: today's source Settings page (SettingsTab, as App mounts
 *   it), scrolled to the category's section; Notifications adds today's tab
 *   above it; the self-contained sections (bridge setup, PKI DMs, Reliable
 *   PKI, coverage recording) render alone.
 *
 * Each export is lazily loaded by `categories.ts`.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { SaveBarGroup } from '../../contexts/SaveBarContext';
import { appBasename } from '../../init';
import ModuleAvailabilityGate from '../../components/configuration/ModuleAvailabilityGate';
import MQTTConfigSection from '../../components/configuration/MQTTConfigSection';
import PkiDmDecryptionSection from '../../components/configuration/PkiDmDecryptionSection';
import SettingsTab from '../../components/SettingsTab';
import NotificationsTab from '../../components/NotificationsTab';
import ReliablePkiSection from '../../components/settings/ReliablePkiSection';
import CoverageMqttRecordingSection from '../../components/settings/CoverageMqttRecordingSection';
import MqttBridgeConfigurationView from '../../components/MQTT/MqttBridgeConfigurationView';
import { useSource } from '../../contexts/SourceContext';
import { canOpenSourceSettings } from '../../components/nav/sourceSettingsAccess';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { useHashTarget } from '../rehost/useHashTarget';
import { Redirect } from '../rehost/pages';
import { firstSectionOf, type CategoryProps } from './categories';
import { useSettingsCategory } from './kit/useFieldRegistry';
import { useSharedDeviceConfig, type SharedDeviceConfig } from './sharedDeviceConfig';
import '../../styles/settings.css';
import styles from './ClassicCategories.module.css';

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

// MQTT reads configuration:write for this source itself, as today.
export function MqttCategory() {
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

/** Today's source Settings page (as App mounts it), scrolled to this category's section. */
export function SourceSettingsCategory({ scroll = true }: { scroll?: boolean }) {
  const s = useSettings();
  const categoryId = useSettingsCategory()?.categoryId ?? '';
  const section = firstSectionOf(categoryId);
  const to = useHashTarget(scroll && section ? `#${section}` : '');
  return (
    <Redirect to={to}>
      <SaveBarGroup id="settings">
        <SettingsTab
          mode="source"
          maxNodeAgeHours={s.maxNodeAgeHours}
          inactiveNodeThresholdHours={s.inactiveNodeThresholdHours}
          inactiveNodeCheckIntervalMinutes={s.inactiveNodeCheckIntervalMinutes}
          inactiveNodeCooldownHours={s.inactiveNodeCooldownHours}
          temperatureUnit={s.temperatureUnit}
          distanceUnit={s.distanceUnit}
          positionHistoryLineStyle={s.positionHistoryLineStyle}
          telemetryVisualizationHours={s.telemetryVisualizationHours}
          favoriteTelemetryStorageDays={s.favoriteTelemetryStorageDays}
          preferredSortField={s.preferredSortField}
          preferredSortDirection={s.preferredSortDirection}
          timeFormat={s.timeFormat}
          dateFormat={s.dateFormat}
          mapTilesetLight={s.mapTilesetLight}
          mapTilesetDark={s.mapTilesetDark}
          mapPinStyle={s.mapPinStyle}
          mapPinColorMode={s.mapPinColorMode}
          nodeListStyle={s.nodeListStyle}
          iconStyle={s.iconStyle}
          theme={s.theme}
          language={s.language}
          solarMonitoringEnabled={s.solarMonitoringEnabled}
          solarMonitoringLatitude={s.solarMonitoringLatitude}
          solarMonitoringLongitude={s.solarMonitoringLongitude}
          solarMonitoringAzimuth={s.solarMonitoringAzimuth}
          solarMonitoringDeclination={s.solarMonitoringDeclination}
          currentNodeId=""
          nodes={[]}
          baseUrl={appBasename}
          onMaxNodeAgeChange={s.setMaxNodeAgeHours}
          onInactiveNodeThresholdHoursChange={s.setInactiveNodeThresholdHours}
          onInactiveNodeCheckIntervalMinutesChange={s.setInactiveNodeCheckIntervalMinutes}
          onInactiveNodeCooldownHoursChange={s.setInactiveNodeCooldownHours}
          onTemperatureUnitChange={s.setTemperatureUnit}
          onDistanceUnitChange={s.setDistanceUnit}
          onPositionHistoryLineStyleChange={s.setPositionHistoryLineStyle}
          onTelemetryVisualizationChange={s.setTelemetryVisualizationHours}
          onFavoriteTelemetryStorageDaysChange={s.setFavoriteTelemetryStorageDays}
          onPreferredSortFieldChange={s.setPreferredSortField}
          onPreferredSortDirectionChange={s.setPreferredSortDirection}
          onTimeFormatChange={s.setTimeFormat}
          onDateFormatChange={s.setDateFormat}
          onMapTilesetsChange={s.setMapTilesets}
          onMapPinStyleChange={s.setMapPinStyle}
          onMapPinColorModeChange={s.setMapPinColorMode}
          onNodeListStyleChange={s.setNodeListStyle}
          onIconStyleChange={s.setIconStyle}
          onLanguageChange={s.setLanguage}
          onSolarMonitoringEnabledChange={s.setSolarMonitoringEnabled}
          onSolarMonitoringLatitudeChange={s.setSolarMonitoringLatitude}
          onSolarMonitoringLongitudeChange={s.setSolarMonitoringLongitude}
          onSolarMonitoringAzimuthChange={s.setSolarMonitoringAzimuth}
          onSolarMonitoringDeclinationChange={s.setSolarMonitoringDeclination}
        />
      </SaveBarGroup>
    </Redirect>
  );
}

/**
 * Today's Notifications tab, then the Settings page that holds Notifications
 * & Security, which only a viewer who may open today's Settings tab sees
 * (canOpenSourceSettings): the tab is open to every signed-in user, the page is not.
 */
export function NotificationsCategory() {
  const { authStatus, hasPermission } = useAuth();
  const { sourceType } = useSource();
  return (
    <>
      <NotificationsTab isAdmin={authStatus?.user?.isAdmin ?? false} />
      {canOpenSourceSettings(hasPermission, sourceType) && <SourceSettingsCategory scroll={false} />}
    </>
  );
}

export function MqttBridgeCategory({ sourceId }: CategoryProps) {
  return <MqttBridgeConfigurationView sourceId={sourceId} />;
}

export function PkiDmCategory({ sourceId }: CategoryProps) {
  const { hasPermission } = useAuth();
  return <PkiDmDecryptionSection sectionId="settings-pki-dm" canWrite={hasPermission('configuration', 'write', { sourceId })} />;
}

export function ReliablePkiCategory({ sourceId }: CategoryProps) {
  return <ReliablePkiSection scope="source" sourceId={sourceId} />;
}

export function CoverageRecordingCategory({ sourceId }: CategoryProps) {
  const { sourceType } = useSource();
  const { hasPermission } = useAuth();
  return (
    <CoverageMqttRecordingSection
      baseUrl={appBasename}
      sourceId={sourceId}
      canWrite={hasPermission('settings', 'write', { sourceId })}
      sourceType={sourceType}
    />
  );
}
