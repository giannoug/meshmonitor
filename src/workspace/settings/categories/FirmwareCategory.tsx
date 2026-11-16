/**
 * Maintenance › Firmware (boards 12-09 / 12-19, Task 5.7): today's OTA update
 * (useFirmwareUpdate, extracted from FirmwareUpdateSection) drawn as the board:
 * THIS RADIO (installed version, release channel as a segmented control,
 * Check Now), the releases as cards, and the wizard in the shared docked Sheet.
 * Every request and safety rail is today's: the custom-URL and local-upload
 * flows with their warnings and the upload acknowledgement, the sibling-build
 * warning, half-flash recovery, the unsupported-board card, and the gate (an
 * admin, OTA on; categories.ts). Escape closes the sheet only; the update
 * keeps running and "Show the update" brings it back.
 *
 * FirmwareCard is the Maintenance page's link here, from the same releases query.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../../components/icons';
import FirmwareUpdateUnsupportedCard from '../../../components/configuration/FirmwareUpdateUnsupportedCard';
import {
  STEP_ORDER,
  firmwareReleasesQuery,
  formatFirmwareSize,
  useFirmwareUpdate,
  type FirmwareBackup,
  type FirmwareChannel,
  type UpdateStatus,
} from '../../../components/configuration/useFirmwareUpdate';
import { useSource } from '../../../contexts/SourceContext';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { appBasename } from '../../../init';
import { getHardwareModelName } from '../../../utils/hardwareModel';
import { compareVersions } from '../../../utils/scriptSource';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import { useIsPhone } from '../../shell/useIsPhone';
import SettingGroup from '../kit/SettingGroup';
import { useReadOnly } from '../kit/useFieldRegistry';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import type { CategoryProps } from '../categories';
import { ActionRow, MaintenancePage } from './maintenanceShared';
import pages from './SettingsPages.module.css';
import styles from './Maintenance.module.css';

/** Today's channels and their labels (the section's select). */
const CHANNELS: Array<[FirmwareChannel, string, string]> = [
  ['stable', 'firmware.channel_stable', 'Stable'],
  ['alpha', 'firmware.channel_alpha', 'Alpha (Pre-release)'],
  ['nightly', 'firmware.channel_nightly', 'Nightly (Develop)'],
  ['custom', 'firmware.channel_custom', 'Custom URL'],
  ['local', 'firmware.channel_local', 'Local File (Upload)'],
];

export default function FirmwareCategory({ sourceId }: CategoryProps) {
  const { t } = useTranslation();
  return (
    // The phone bar fits "Firmware" beside "‹ Maintenance" (12-19); today's "Firmware Updates" does not.
    <MaintenancePage child={{ sourceId, scope: t('workspace.settings.maintenance.firmware_scope'), phoneTitle: t('workspace.settings.maintenance.firmware') }}>
      <FirmwarePage />
    </MaintenancePage>
  );
}

function FirmwarePage() {
  const { t } = useTranslation();
  const { sourceName } = useSource();
  const readOnly = useReadOnly();
  const fw = useFirmwareUpdate(appBasename);
  const { gatewayInfo, isOtaSupported, effectiveStatus, unsupportedHardware, isUpdateActive, isOtherSourceUpdate } = fw;
  const [restore, setRestore] = useState<FirmwareBackup | null>(null);
  const board = gatewayInfo.hwModel > 0 ? getHardwareModelName(gatewayInfo.hwModel) : t('firmware.unknown_board', 'this board');
  const saved = fw.statusData;
  const channelDirty = !!saved && (fw.channel !== saved.channel || (fw.channel === 'custom' && fw.customUrl !== (saved.customUrl ?? '')));
  const otaReason = !isOtaSupported
    ? gatewayInfo.isBridged
      ? t('firmware.ota_unavailable_bridged_tooltip', 'This bridged node cannot be flashed over the air. Update it directly via USB.')
      : t('firmware.ota_unavailable_tooltip', 'OTA firmware update requires a TCP source with a configured host.')
    : undefined;
  const wizardOpen = !!isUpdateActive && !!effectiveStatus && !isOtherSourceUpdate;
  const channelLabel = (c: FirmwareChannel) => {
    const [, key, fallback] = CHANNELS.find(([id]) => id === c)!;
    return t(key, fallback);
  };

  return (
    <>
      <SettingGroup title={t('workspace.settings.maintenance.this_radio')}>
        <ActionRow
          id="maintenance.firmware.installed"
          label={t('firmware.current_version', 'Current Firmware')}
          help={
            <>
              {[sourceName, gatewayInfo.hwModel > 0 ? getHardwareModelName(gatewayInfo.hwModel) : null, gatewayInfo.gatewayIp || null].filter(Boolean).join(' · ')}
              <span className={pages.block}>
                {t('firmware.last_checked', 'Last Checked')}: {fw.formatTimestamp(fw.lastChecked)}
              </span>
            </>
          }
        >
          <span className={styles.versions}>{gatewayInfo.firmwareVersion}</span>
        </ActionRow>

        {/* #2981: why this source cannot be flashed over IP; the hardware card says it instead (#5677). */}
        {!isOtaSupported && !unsupportedHardware && (
          <p className={styles.notice} role="note">
            <UiIcon name="alert" size={16} />
            <span>
              {gatewayInfo.isBridged
                ? t('firmware.ota_unavailable_bridged', 'This node is reached through a serial/BLE-to-TCP bridge (it reports no native WiFi or Ethernet), so it cannot be flashed over the air. Update it directly via USB instead.')
                : gatewayInfo.sourceType && gatewayInfo.sourceType !== 'meshtastic_tcp'
                  ? t('firmware.ota_unavailable_non_tcp', 'OTA firmware update is only available for TCP sources. The active source ({{type}}) cannot be flashed from MeshMonitor.', { type: gatewayInfo.sourceType })
                  : t('firmware.ota_unavailable_no_host', 'No node IP is configured for this source. Configure the TCP host before starting an OTA update.')}
            </span>
          </p>
        )}

        {unsupportedHardware ? (
          <div className={styles.embedded}>
            <FirmwareUpdateUnsupportedCard support={unsupportedHardware} hwModel={gatewayInfo.hwModel} />
          </div>
        ) : (
          <>
            <ActionRow
              id="maintenance.firmware.channel"
              label={t('firmware.channel', 'Release Channel')}
              help={t('workspace.settings.maintenance.channel_help')}
            >
              <span className={styles.segmented} role="radiogroup" aria-label={t('firmware.channel', 'Release Channel')}>
                {CHANNELS.map(([id]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={fw.channel === id}
                    className={styles.segment}
                    disabled={readOnly}
                    onClick={() => fw.setChannel(id)}
                  >
                    {channelLabel(id)}
                  </button>
                ))}
              </span>
              {channelDirty && (
                <button type="button" className={`${pages.button} ${pages.primary}`} onClick={() => void fw.handleSaveChannel()} disabled={fw.isSavingChannel || readOnly}>
                  {fw.isSavingChannel ? '...' : t('firmware.save_channel', 'Save')}
                </button>
              )}
              <button type="button" className={pages.button} onClick={() => void fw.handleCheckNow()} disabled={fw.isChecking}>
                <UiIcon name="refresh" size={16} /> {fw.isChecking ? t('firmware.checking', 'Checking...') : t('firmware.check_now', 'Check Now')}
              </button>
            </ActionRow>

            {fw.channel === 'nightly' && (
              <p className={styles.notice} role="alert">
                <UiIcon name="alert" size={16} />
                <span>{t('firmware.channel_nightly_warning')}</span>
              </p>
            )}

            {/* Custom URL (#5011): Install fetches what the server has saved, so it waits for Save. */}
            {fw.channel === 'custom' && (
              <div className={styles.embedded}>
                <label className={pages.field}>
                  <span>{t('firmware.channel_custom', 'Custom URL')}</span>
                  <input
                    type="url"
                    className={pages.keyInput}
                    value={fw.customUrl}
                    onChange={(e) => fw.setCustomUrl(e.target.value)}
                    placeholder={t('firmware.custom_url_placeholder', 'https://example.com/firmware.bin')}
                    disabled={readOnly}
                  />
                  <span className={pages.infoHelp}>{t('firmware.custom_url_hint')}</span>
                </label>
                <p className={styles.notice} role="alert">
                  <UiIcon name="alert" size={16} />
                  <span>
                    {t('firmware.custom_url_warning')} <strong>{board}</strong>
                  </span>
                </p>
                <button
                  type="button"
                  className={`${pages.button} ${pages.primary}`}
                  onClick={() => void fw.handleInstallCustomUrl()}
                  disabled={!isOtaSupported || !fw.savedCustomUrl || isUpdateActive || readOnly}
                  title={fw.savedCustomUrl ? otaReason : t('firmware.custom_url_save_first', 'Press Save first to store the URL')}
                >
                  {t('firmware.install_from_url', 'Install from URL')}
                </button>
              </div>
            )}

            {/* Local file (#5249): MeshMonitor cannot check the file, so Install waits for the acknowledgement. */}
            {fw.channel === 'local' && (
              <div className={styles.embedded}>
                <p className={styles.notice} role="alert">
                  <UiIcon name="alert" size={16} />
                  <span>
                    {t('firmware.local_warning')} <strong>{board}</strong>
                  </span>
                </p>
                <input
                  ref={fw.fileInputRef}
                  type="file"
                  accept=".bin,application/octet-stream"
                  onChange={(e) => void fw.handleFileSelected(e)}
                  className={pages.visuallyHidden}
                  tabIndex={-1}
                  aria-hidden="true"
                  data-testid="firmware-file-input"
                />
                <div className={styles.actions}>
                  <button type="button" className={pages.button} onClick={() => fw.fileInputRef.current?.click()} disabled={fw.isUploading || readOnly}>
                    {fw.isUploading
                      ? t('firmware.uploading', 'Uploading...')
                      : fw.stagedUpload
                        ? t('firmware.choose_different_file', 'Choose a different file')
                        : t('firmware.choose_file', 'Choose .bin file')}
                  </button>
                  {fw.stagedUpload && (
                    <>
                      <span className={styles.file}>
                        {fw.stagedUpload.originalName} ({formatFirmwareSize(fw.stagedUpload.size)})
                      </span>
                      <button type="button" className={pages.button} onClick={() => void fw.handleDiscardUpload()} disabled={readOnly}>
                        {t('firmware.discard_upload', 'Discard')}
                      </button>
                    </>
                  )}
                </div>
                {fw.stagedUpload && (
                  <>
                    <label className={pages.check}>
                      <input
                        type="checkbox"
                        checked={fw.acknowledgedRisk}
                        onChange={(e) => fw.setAcknowledgedRisk(e.target.checked)}
                        disabled={readOnly}
                        data-testid="firmware-ack-risk"
                      />
                      <span className={pages.checkText}>{t('firmware.local_ack')}</span>
                    </label>
                    <button
                      type="button"
                      className={`${pages.button} ${pages.primary}`}
                      onClick={() => void fw.handleInstallUpload()}
                      disabled={!fw.acknowledgedRisk || !isOtaSupported || isUpdateActive || readOnly}
                      title={otaReason}
                    >
                      {t('firmware.install_uploaded', 'Install uploaded firmware')}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </SettingGroup>

      {isOtherSourceUpdate && (
        <p className={styles.notice} role="status">
          <UiIcon name="info" size={16} />
          <span>{t('firmware.update_on_other_source', 'A firmware update is running on another source. Only one update can run at a time; open that source to follow or cancel it.')}</span>
        </p>
      )}

      {!unsupportedHardware && (
        <SettingGroup title={t('workspace.settings.maintenance.releases_heading', { channel: channelLabel(saved?.channel ?? fw.channel) })}>
          {fw.releases.length === 0 ? (
            <p className={styles.empty}>{t('firmware.no_releases')}</p>
          ) : (
            <ul className={styles.backups} aria-label={t('workspace.settings.maintenance.releases_list')}>
              {fw.releases.map((release, i) => {
                const date = new Date(release.publishedAt);
                return (
                  <li key={release.tagName} className={styles.backup}>
                    <span className={styles.backupText}>
                      <span className={pages.inline}>
                        <span className={styles.versions}>{release.version}</span>
                        {i === 0 && <span className={styles.tag}>{t('workspace.settings.maintenance.latest')}</span>}
                        {release.prerelease && (
                          <span className={styles.badge}>{release.isNightly ? t('firmware.badge_nightly', 'nightly') : 'alpha'}</span>
                        )}
                        {/* Nightly builds carry no publish date. */}
                        <span className={pages.counter}>{release.publishedAt && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—'}</span>
                      </span>
                      <a className={pages.link} href={release.htmlUrl} target="_blank" rel="noopener noreferrer">
                        {t('firmware.release_notes', 'Release Notes')}
                      </a>
                    </span>
                    <button
                      type="button"
                      className={i === 0 ? `${pages.button} ${pages.primary}` : pages.button}
                      onClick={() => void fw.handleInstall(release)}
                      disabled={!isOtaSupported || isUpdateActive || readOnly}
                      title={otaReason}
                    >
                      {t('firmware.install', 'Install')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.footnote}>
            <SendsLine>{t('workspace.settings.maintenance.wizard_sends', { device: sourceName })}</SendsLine>
          </div>
        </SettingGroup>
      )}

      <SettingGroup title={t('firmware.backups_title', 'Configuration Backups')}>
        {fw.backups.length === 0 ? (
          <p className={styles.empty}>{t('firmware.no_backups', 'No configuration backups found.')}</p>
        ) : (
          <ul className={styles.backups} aria-label={t('firmware.backups_title', 'Configuration Backups')}>
            {fw.backups.map((backup) => (
              <li key={backup.filename} className={styles.backup}>
                <span className={styles.backupText}>
                  <span>{new Date(backup.timestamp).toLocaleString()}</span>
                  <span className={styles.file}>{`${backup.filename} · ${fw.formatBytes(backup.size)}`}</span>
                </span>
                <button type="button" className={pages.button} onClick={() => setRestore(backup)} disabled={isUpdateActive || readOnly}>
                  {t('firmware.restore_backup', 'Restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingGroup>

      {wizardOpen && <Wizard fw={fw} status={effectiveStatus!} device={sourceName ?? ''} />}

      <ConfirmSheet
        open={restore !== null}
        title={t('workspace.settings.maintenance.firmware_restore_title', { filename: restore?.filename ?? '' })}
        body={
          <>
            <p className={pages.para}>{t('workspace.settings.maintenance.firmware_restore_body')}</p>
            <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
          </>
        }
        confirmLabel={t('firmware.restore_backup', 'Restore')}
        submitOnEnter={false}
        onConfirm={() => {
          const backup = restore!;
          setRestore(null);
          void fw.restoreBackup(backup);
        }}
        onCancel={() => setRestore(null)}
      />
    </>
  );
}

type Firmware = ReturnType<typeof useFirmwareUpdate>;

/** The wizard as today's, in the docked Sheet: steps, notes, logs, and today's buttons for each state. */
function Wizard({ fw, status, device }: { fw: Firmware; status: UpdateStatus; device: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  // Escape, the backdrop and Close only hide the sheet (Ruling CR); the update runs on. A new step shows it again.
  const [hidden, setHidden] = useState(false);
  const stepKey = `${status.state}:${status.step}`;
  useEffect(() => setHidden(false), [stepKey]);
  const currentIdx = STEP_ORDER.findIndex((x) => x.key === status.step);
  const failed = status.state === 'error';
  const button = (cls = '') => `${pages.button} ${styles.wizardButton} ${cls}`;

  return (
    <>
      {hidden && (
        <p className={styles.notice} role="status">
          <UiIcon name="info" size={16} />
          <span>{t('workspace.settings.maintenance.update_hidden')}</span>
          <button type="button" className={pages.button} onClick={() => setHidden(false)}>
            {t('workspace.settings.maintenance.show_update')}
          </button>
        </p>
      )}
      <Sheet
        open={!hidden}
        onClose={() => setHidden(true)}
        title={status.targetVersion ? t('workspace.settings.maintenance.install_title', { version: status.targetVersion }) : t('firmware.update_wizard', 'Firmware Update')}
      >
        <div className={styles.wizard} data-phone={isPhone || undefined}>
          <SendsLine>{t('workspace.settings.maintenance.wizard_sends', { device })}</SendsLine>

          <ol className={styles.steps}>
            {STEP_ORDER.map((s, i) => {
              const current = s.key === status.step;
              const done = status.state === 'success' || (currentIdx >= 0 && i < currentIdx);
              const state = current && failed ? 'failed' : done ? 'done' : current ? 'now' : undefined;
              return (
                <li key={s.key} className={styles.step} data-state={state} aria-current={current ? 'step' : undefined}>
                  <span className={styles.stepDot} aria-hidden="true">
                    {state === 'done' && <UiIcon name="check" size={14} />}
                    {state === 'failed' && <UiIcon name="close" size={14} />}
                  </span>
                  <span className={styles.backupText}>
                    <span>{s.label}</span>
                    {current && (
                      <span className={pages.infoHelp}>
                        {fw.getStepTitle(status.step)}
                        {status.message ? ` · ${status.message}` : ''}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          {status.progress !== undefined && status.progress > 0 && (
            <div className={styles.progress}>
              <span className={pages.inline}>
                <span>{t('firmware.uploading', 'Uploading firmware...')}</span>
                <span className={pages.counter}>{Math.min(status.progress, 100)}%</span>
              </span>
              <progress className={styles.bar} data-failed={failed || undefined} max={100} value={Math.min(status.progress, 100)} />
            </div>
          )}

          {/* #5423: the board shares its hw model with other builds; shown at every confirm. */}
          {status.state === 'awaiting-confirm' && status.warnings && status.warnings.length > 0 && (
            <div className={styles.alert} role="alert" data-testid="ota-sibling-warning">
              <strong>{t('firmware.sibling_build_title', 'Check which firmware build your node runs')}</strong>
              <ul className={pages.list}>
                {status.warnings.map((w) => (
                  <li key={w.sibling}>
                    {t('firmware.sibling_build_warning', { board: w.boardLabel, siblingLabel: w.siblingLabel, sibling: w.sibling })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status.preflightInfo && (
            <dl className={styles.facts}>
              <dt>{t('firmware.current_version', 'Current Firmware')}</dt>
              <dd>{status.preflightInfo.currentVersion}</dd>
              <dt>{t('firmware.version', 'Version')}</dt>
              <dd>{status.preflightInfo.targetVersion}</dd>
              <dt>Gateway IP</dt>
              <dd>{status.preflightInfo.gatewayIp}</dd>
              <dt>{t('firmware.hardware_model', 'Hardware Model')}</dt>
              <dd>{status.preflightInfo.hwModel}</dd>
              <dt>Board</dt>
              <dd>{status.preflightInfo.boardName}</dd>
              <dt>Platform</dt>
              <dd>{status.preflightInfo.platform}</dd>
            </dl>
          )}

          {status.step === 'preflight' && status.state === 'awaiting-confirm' && (
            <p className={styles.notice}>
              <UiIcon name="alert" size={16} />
              <span>
                {t('firmware.ota_bootloader_warning')}{' '}
                <a className={pages.link} href="https://meshmonitor.org/firmware-ota-prerequisites" target="_blank" rel="noopener noreferrer">
                  {t('firmware.ota_bootloader_learn_more', 'Learn More')}
                </a>
              </span>
            </p>
          )}

          {status.matchedFile && (
            <p className={pages.para}>
              <strong>{t('firmware.matched_file', 'Selected Firmware')}:</strong> <code className={pages.code}>{status.matchedFile}</code>
            </p>
          )}

          {status.rejectedFiles && status.rejectedFiles.length > 0 && (
            <div>
              <button type="button" className={styles.changesToggle} aria-expanded={fw.showRejectedFiles} onClick={() => fw.setShowRejectedFiles(!fw.showRejectedFiles)}>
                <UiIcon name={fw.showRejectedFiles ? 'chevronDown' : 'chevronRight'} size={14} />
                {t('firmware.rejected_files', 'Rejected Files')} ({status.rejectedFiles.length})
              </button>
              {fw.showRejectedFiles && (
                <ul className={pages.list}>
                  {status.rejectedFiles.map((f) => (
                    <li key={f.name}>
                      <code className={pages.code}>{f.name}</code> — {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {status.logs && status.logs.length > 0 && (
            <pre ref={fw.logRef} className={pages.preview}>
              <code>{status.logs.join('\n')}</code>
            </pre>
          )}

          {failed && status.error && (
            <p className={styles.alert} role="alert">
              <UiIcon name="alert" size={16} /> {status.error}
            </p>
          )}

          {status.step === 'extract' && status.state === 'awaiting-confirm' && (
            <p className={pages.warn}>{t('firmware.reboot_warning', 'The node will reboot during the update and be briefly unavailable.')}</p>
          )}

          {/* #3413: a half-flashed node is cleared only once it is back online. */}
          {fw.halfFlashedNodeId && (
            <div className={styles.alert} role="alert">
              <strong>{t('firmware.recovery_title', 'Device flagged as half-flashed')}</strong>
              <p className={pages.para}>{t('firmware.recovery_explanation')}</p>
              <span className={pages.inline}>
                <span className={styles.dot} data-on={fw.isGatewayOnline || undefined} aria-hidden="true" />
                <span>{fw.isGatewayOnline ? t('firmware.recovery_online') : t('firmware.recovery_offline')}</span>
              </span>
            </div>
          )}

          <div className={styles.actions}>
            {fw.halfFlashedNodeId ? (
              <>
                <button type="button" className={button(pages.dangerButton)} onClick={() => void fw.handleCancel()}>
                  {t('firmware.wizard_cancel', 'Cancel Update')}
                </button>
                <button
                  type="button"
                  className={button(pages.primary)}
                  onClick={() => void fw.handleClearMarkerAndRetry()}
                  disabled={!fw.isGatewayOnline || fw.isClearingMarker}
                  title={fw.isGatewayOnline ? undefined : t('firmware.recovery_not_online')}
                >
                  {fw.isClearingMarker ? t('workspace.state.loading') : t('firmware.recovery_clear_retry')}
                </button>
              </>
            ) : (
              <>
                {(status.state === 'awaiting-confirm' || status.state === 'in-progress') && (
                  <button type="button" className={button(pages.dangerButton)} onClick={() => void fw.handleCancel()}>
                    {t('firmware.wizard_cancel', 'Cancel Update')}
                  </button>
                )}
                {status.state === 'awaiting-confirm' && (
                  <button type="button" className={button(pages.primary)} onClick={() => void fw.handleConfirm()} disabled={fw.isConfirming}>
                    {fw.isConfirming ? t('workspace.state.loading') : t('firmware.wizard_confirm', 'Confirm & Proceed')}
                  </button>
                )}
                {status.state === 'success' && (
                  <button type="button" className={button(pages.primary)} onClick={() => void fw.handleDone()}>
                    {t('common.done')}
                  </button>
                )}
                {failed && (
                  <>
                    <button type="button" className={button()} onClick={() => void fw.handleDone()}>
                      {t('common.dismiss')}
                    </button>
                    {status.step === 'flash' && (
                      <button type="button" className={button(pages.primary)} onClick={() => void fw.handleRetryFlash()}>
                        <UiIcon name="refresh" size={16} /> {t('firmware.retry_flash', 'Retry Flash')}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          {status.step === 'flash' && <p className={pages.muted}>{t('firmware.reboot_warning', 'The node will reboot during the update and be briefly unavailable.')}</p>}
        </div>
      </Sheet>
    </>
  );
}

/** "2.7.15.567b8ea" → "2.7.15", the form releases are named in. */
const release = (version: string) => version.split('.').slice(0, 3).join('.');

export function FirmwareCard({ base }: { base: string }) {
  const { t } = useTranslation();
  const config = useSharedDeviceConfig();
  const { data } = useQuery(firmwareReleasesQuery(useCsrfFetch(), appBasename));
  const installed = config && !config.state.loading ? release(config.state.localFirmwareVersion ?? '') : '';
  const latest = data?.releases?.[0]?.version;
  const newer = !!latest && !!installed && compareVersions(latest, installed) > 0;
  return (
    <Link to={`${base}/maintenance/firmware`} className={styles.firmware}>
      <UiIcon name="upload" size={20} />
      <span className={styles.firmwareLabel}>{t('workspace.settings.maintenance.firmware')}</span>
      <span className={styles.versions}>
        {newer ? t('workspace.settings.maintenance.firmware_versions', { installed, latest }) : installed}
      </span>
      {newer && <span className={styles.tag}>{t('firmware.update_available')}</span>}
      <UiIcon name="chevronRight" size={18} />
    </Link>
  );
}
