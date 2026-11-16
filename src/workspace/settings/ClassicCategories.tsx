/**
 * Each category's page until Tasks 5.3–5.8 build it on the row kit: today's
 * section for it, rendered with the props it takes today (Task 5.2, decision
 * 1), so every control a power user uses is still there (spec §2).
 *
 * - On the radio: MQTT's section (Ruling 5.6: its save also writes the broker
 *   preset and the MQTT link), fed from the frame's one device-config instance
 *   (Ruling DG) and saving through today's handler and SaveBar. Import/Export
 *   and the danger zone keep today's JSX.
 * - In MeshMonitor: today's source Settings page (SettingsTab, as App mounts
 *   it), scrolled to the category's section; Notifications adds today's tab
 *   above it; the self-contained sections (bridge setup, PKI DMs, Reliable
 *   PKI, coverage recording) render alone.
 *
 * Each export is lazily loaded by `categories.ts`.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { SaveBarGroup } from '../../contexts/SaveBarContext';
import { usePoll } from '../../hooks/usePoll';
import { appBasename } from '../../init';
import { buildAdminCommandsPath } from '../../utils/adminDeepLink';
import ModuleAvailabilityGate from '../../components/configuration/ModuleAvailabilityGate';
import MQTTConfigSection from '../../components/configuration/MQTTConfigSection';
import PkiDmDecryptionSection from '../../components/configuration/PkiDmDecryptionSection';
import FirmwareUpdateSection from '../../components/configuration/FirmwareUpdateSection';
import BackupManagementSection from '../../components/configuration/BackupManagementSection';
import { ImportConfigModal } from '../../components/configuration/ImportConfigModal';
import { ExportConfigModal } from '../../components/configuration/ExportConfigModal';
import { ConfirmDialog } from '../../components/shared/automation/ConfirmDialog';
import { ConfigSection } from '../../components/shared/config/ConfigSection';
import { TypedConfirmDialog } from '../../components/common/TypedConfirmDialog';
import { MovedSettingNote } from '../../components/common/MovedSettingNote';
import { DangerZone, DangerZoneActions, DangerZoneButton } from '../../components/shared/config/DangerZone';
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
// Today's Import/Export classes, so the reload button and warning look as on Device Configuration.
import classic from '../../components/ConfigurationTab.module.css';

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

/** Today's Import/Export section (reload, import, export, what changed) and the device backups. */
export function BackupCategory({ readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [modal, setModal] = useState<'import' | 'export' | null>(null);
  // Export shares the device's channels, which today's page had from App's poll.
  const { data, refetch } = usePoll();
  return (
    <Radio
      render={({ state, saves }) => (
        <>
          <ConfigSection
            id="config-import-export"
            title={t('config.import_export_title')}
            description={t('config.import_export_description')}
            headerActions={
              <button type="button" className={classic.reloadButton} onClick={() => void saves.reload()} disabled={state.isReloading}>
                {state.isReloading ? (
                  <>
                    <span className={classic.spin}><UiIcon name="refresh" /></span>
                    {' '}{t('config.reloading')}
                  </>
                ) : (
                  <><UiIcon name="refresh" /> {t('config.reload_config')}</>
                )}
              </button>
            }
            notice={
              <p className={classic.pageWarning} role="note">
                <UiIcon name="alert" /> <span>{t('config.warning_text')}</span>
              </p>
            }
          >
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={() => setModal('import')} disabled={readOnly}>
                <UiIcon name="import" /> {t('config.import_config')}
              </button>
              <button type="button" className={styles.button} onClick={() => setModal('export')}>
                <UiIcon name="upload" /> {t('config.export_config')}
              </button>
            </div>
            {state.configChanges.length > 0 && (
              <div className={styles.changes}>
                <button type="button" className={styles.button} onClick={() => state.setShowChanges(!state.showChanges)}>
                  <span><UiIcon name={state.showChanges ? 'chevronDown' : 'forward'} /></span>
                  {t('config.changes_detected', { count: state.configChanges.length })}
                </button>
                {state.showChanges && (
                  <table>
                    <thead>
                      <tr>
                        <th>{t('config.field')}</th>
                        <th>{t('config.old_value')}</th>
                        <th>{t('config.new_value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.configChanges.map((change, idx) => (
                        <tr key={idx}>
                          <td>{change.field}</td>
                          <td className={styles.old}>{change.oldValue}</td>
                          <td className={styles.new}>{change.newValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </ConfigSection>
          <BackupManagementSection protocol="meshtastic" canWrite={!readOnly} />
          <ImportConfigModal
            isOpen={modal === 'import'}
            onClose={() => setModal(null)}
            onImportSuccess={() => {
              showToast(t('config.import_success'), 'success');
              void refetch();
            }}
          />
          <ExportConfigModal
            isOpen={modal === 'export'}
            onClose={() => setModal(null)}
            channels={data?.channels ?? []}
            deviceConfig={{ lora: { usePreset: state.usePreset, modemPreset: state.modemPreset, region: state.region, hopLimit: state.hopLimit } }}
          />
        </>
      )}
    />
  );
}

export function FirmwareCategory() {
  return <FirmwareUpdateSection baseUrl={appBasename} />;
}

/** Today's danger zone: reboot (asks plainly) and purge (types PURGE). */
export function DangerCategory({ readOnly, sourceId }: CategoryProps) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const [confirm, setConfirm] = useState<'reboot' | 'purge' | null>(null);
  return (
    <Radio
      render={({ state, saves }) => (
        <>
          <DangerZone
            id="config-danger"
            canWrite={!readOnly}
            description={t('config.danger_zone_description', 'These actions restart the node or erase data. They cannot be undone.')}
            footer={
              authStatus?.user?.isAdmin ? (
                <MovedSettingNote
                  testId="danger-admin-commands-link"
                  text={t('config.danger_zone_admin_note', 'Shutdown, DFU mode and factory reset are on Admin Commands.')}
                  linkLabel={t('config.danger_zone_admin_link', 'Open Admin Commands')}
                  to={buildAdminCommandsPath(sourceId)}
                />
              ) : undefined
            }
          >
            <DangerZoneActions>
              <DangerZoneButton onClick={() => setConfirm('reboot')} disabled={state.isSaving || readOnly} data-testid="config-reboot-button">
                <UiIcon name="refresh" /> {t('config.reboot_device')}
              </DangerZoneButton>
              <DangerZoneButton onClick={() => setConfirm('purge')} disabled={state.isSaving || readOnly} data-testid="config-purge-button">
                <UiIcon name="delete" /> {t('config.purge_node_db')}
              </DangerZoneButton>
            </DangerZoneActions>
          </DangerZone>
          {confirm === 'reboot' && (
            <ConfirmDialog
              title={t('config.reboot_dialog_title', 'Reboot the device?')}
              message={t('config.reboot_dialog_message', 'The device restarts and is offline for about 30 to 60 seconds.')}
              confirmLabel={t('config.reboot_device')}
              cancelLabel={t('common.cancel')}
              onConfirm={() => {
                setConfirm(null);
                void saves.reboot();
              }}
              onCancel={() => setConfirm(null)}
            />
          )}
          <TypedConfirmDialog
            isOpen={confirm === 'purge'}
            title={t('config.purge_dialog_title', 'Purge the node database?')}
            confirmWord="PURGE"
            confirmLabel={t('config.purge_node_db')}
            danger
            busy={state.isSaving}
            onConfirm={() => {
              setConfirm(null);
              void saves.purgeNodeDb();
            }}
            onCancel={() => setConfirm(null)}
          >
            <p>
              {t(
                'config.purge_dialog_body',
                "This deletes every stored node from the device and from MeshMonitor's database for this source. It cannot be undone. The device rebuilds its list as it hears nodes on the mesh.",
              )}
            </p>
          </TypedConfirmDialog>
        </>
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
