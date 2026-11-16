import React from 'react';
import { UiIcon } from '../icons';
import { getHardwareModelName } from '../../utils/hardwareModel';
import FirmwareUpdateUnsupportedCard from './FirmwareUpdateUnsupportedCard';
import styles from './FirmwareUpdateSection.module.css';
import { ConfigSection } from '../shared/config/ConfigSection';
import { STEP_ORDER, formatFirmwareSize, useFirmwareUpdate, type FirmwareBackup, type FirmwareChannel } from './useFirmwareUpdate';

interface FirmwareUpdateSectionProps {
  baseUrl: string;
  /**
   * Anchor id of the section. `config-firmware` on Device Configuration, where
   * the section lives (#5683 follow-up).
   */
  sectionId?: string;
}

const FirmwareUpdateSection: React.FC<FirmwareUpdateSectionProps> = ({ baseUrl, sectionId = 'config-firmware' }) => {
  const {
    t, gatewayInfo, isOtaSupported, isGatewayOnline,
    channel, setChannel, customUrl, setCustomUrl, isChecking, isSavingChannel, showRejectedFiles, setShowRejectedFiles,
    isConfirming, halfFlashedNodeId, isClearingMarker, isUploading, acknowledgedRisk, setAcknowledgedRisk, fileInputRef, logRef,
    effectiveStatus, releases, backups, lastChecked, savedCustomUrl, stagedUpload,
    handleSaveChannel, handleCheckNow, handleFileSelected, handleDiscardUpload, handleInstallCustomUrl, handleInstallUpload,
    handleInstall, handleConfirm, handleClearMarkerAndRetry, handleCancel, handleDone, handleRetryFlash, restoreBackup,
    formatTimestamp, formatBytes, getStepTitle, isUpdateActive, isOtherSourceUpdate, unsupportedHardware,
  } = useFirmwareUpdate(baseUrl);

  const handleRestoreBackup = async (backup: FirmwareBackup) => {
    const confirmed = window.confirm(
      `Restore configuration from backup "${backup.filename}"?\nThis will overwrite current device configuration.`
    );
    if (!confirmed) return;
    await restoreBackup(backup);
  };

  return (
    <ConfigSection title={t('firmware.title', 'Firmware Updates')} description={t('firmware.description', 'Manage firmware updates for your gateway node.')} id={sectionId}>

      {/* Issue #2981: surface a clear notice when the active source can't be
          flashed over IP, instead of silently defaulting to 192.168.1.100.
          Not shown with the hardware card (#5677): that already says why. */}
      {!isOtaSupported && !unsupportedHardware && (
        <div
          className="setting-item"
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-warning)',
            borderRadius: '4px',
          }}
        >
          <span className="setting-description">
            {gatewayInfo.isBridged
              ? t(
                  'firmware.ota_unavailable_bridged',
                  'This node is reached through a serial/BLE-to-TCP bridge (it reports no native WiFi or Ethernet), so it cannot be flashed over the air. Update it directly via USB instead.'
                )
              : gatewayInfo.sourceType && gatewayInfo.sourceType !== 'meshtastic_tcp'
              ? t(
                  'firmware.ota_unavailable_non_tcp',
                  'OTA firmware update is only available for TCP sources. The active source ({{type}}) cannot be flashed from MeshMonitor.',
                  { type: gatewayInfo.sourceType }
                )
              : t(
                  'firmware.ota_unavailable_no_host',
                  'No node IP is configured for this source. Configure the TCP host before starting an OTA update.'
                )}
          </span>
        </div>
      )}

      {/* Gateway Info */}
      {gatewayInfo.firmwareVersion && (
        <div className="setting-item" style={{ marginTop: '0.5rem' }}>
          <span className="setting-description">
            <strong>{t('firmware.current_version', 'Current Firmware')}:</strong> {gatewayInfo.firmwareVersion}
            {gatewayInfo.hwModel > 0 && (
              <> &nbsp;|&nbsp; <strong>{t('firmware.hardware_model', 'Hardware Model')}:</strong> {gatewayInfo.hwModel}</>
            )}
            {gatewayInfo.gatewayIp && (
              <> &nbsp;|&nbsp; <strong>IP:</strong> {gatewayInfo.gatewayIp}</>
            )}
          </span>
        </div>
      )}

      {unsupportedHardware && (
        <FirmwareUpdateUnsupportedCard support={unsupportedHardware} hwModel={gatewayInfo.hwModel} />
      )}

      {/* Everything that picks, checks for or starts an update. Replaced by
          the card above when the hardware cannot be updated here (#5677). */}
      {!unsupportedHardware && (<>
      {/* Channel Selector */}
      <div className="setting-item" style={{ marginTop: '1rem' }}>
        <label htmlFor="firmware-channel">
          {t('firmware.channel', 'Release Channel')}
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            id="firmware-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as FirmwareChannel)}
            className="setting-input"
            style={{ flex: 1 }}
          >
            <option value="stable">{t('firmware.channel_stable', 'Stable')}</option>
            <option value="alpha">{t('firmware.channel_alpha', 'Alpha (Pre-release)')}</option>
            <option value="nightly">{t('firmware.channel_nightly', 'Nightly (Develop)')}</option>
            <option value="custom">{t('firmware.channel_custom', 'Custom URL')}</option>
            <option value="local">{t('firmware.channel_local', 'Local File (Upload)')}</option>
          </select>
          <button
            className="save-button"
            onClick={handleSaveChannel}
            disabled={isSavingChannel}
            style={{ whiteSpace: 'nowrap' }}
          >
            {isSavingChannel ? '...' : t('firmware.save_channel', 'Save')}
          </button>
        </div>
      </div>

      {/* Nightly warning — develop builds are untested and can brick a node. */}
      {channel === 'nightly' && (
        <div
          className="setting-item"
          role="alert"
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid var(--color-warning)',
            color: 'var(--color-warning)',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          {t(
            'firmware.channel_nightly_warning',
            'Nightly builds are untested develop snapshots (the upcoming 2.8 release). They may be unstable or fail to boot — flash a spare node you can recover over USB, not your only gateway.',
          )}
        </div>
      )}

      {/* Custom URL Input (#5011) */}
      {channel === 'custom' && (
        <div className="setting-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label htmlFor="firmware-custom-url">
              {t('firmware.channel_custom', 'Custom URL')}
            </label>
            <input
              id="firmware-custom-url"
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder={t('firmware.custom_url_placeholder', 'https://example.com/firmware.bin')}
              className="setting-input"
              style={{ width: '100%' }}
            />
            <span className="setting-description">
              {t(
                'firmware.custom_url_hint',
                'Must point directly at a .bin image. A GitHub file page link is converted to its raw-content URL when you save.',
              )}
            </span>
          </div>

          <div
            role="alert"
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--color-warning)',
              color: 'var(--color-warning)',
              fontSize: '0.85rem',
              lineHeight: 1.4,
            }}
          >
            {t(
              'firmware.custom_url_warning',
              'MeshMonitor does not check that the downloaded file is firmware for this board. Flashing a binary built for a different board will brick the node, and recovery needs a USB cable. Make sure the URL was built for:',
            )}{' '}
            <strong>
              {gatewayInfo.hwModel > 0
                ? getHardwareModelName(gatewayInfo.hwModel)
                : t('firmware.unknown_board', 'this board')}
            </strong>
          </div>

          <div>
            <button
              className="save-button"
              onClick={handleInstallCustomUrl}
              disabled={!isOtaSupported || !savedCustomUrl}
              data-testid="firmware-install-custom-url"
              title={
                savedCustomUrl
                  ? undefined
                  : t('firmware.custom_url_save_first', 'Press Save first to store the URL')
              }
            >
              {t('firmware.install_from_url', 'Install from URL')}
            </button>
          </div>
        </div>
      )}

      {/* Local file upload (#5249) */}
      {channel === 'local' && (
        <div className="setting-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--color-warning)',
              color: 'var(--color-warning)',
              fontSize: '0.85rem',
              lineHeight: 1.4,
            }}
          >
            {t(
              'firmware.local_warning',
              'MeshMonitor does not check that an uploaded file is firmware for this board. Flashing a binary built for a different board will brick the node, and recovery needs a USB cable. Make sure the file you pick was built for:',
            )}{' '}
            <strong>{gatewayInfo.hwModel > 0
              ? getHardwareModelName(gatewayInfo.hwModel)
              : t('firmware.unknown_board', 'this board')}</strong>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".bin,application/octet-stream"
            onChange={handleFileSelected}
            style={{ display: 'none' }}
            data-testid="firmware-file-input"
          />

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="save-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading
                ? t('firmware.uploading', 'Uploading...')
                : stagedUpload
                  ? t('firmware.choose_different_file', 'Choose a different file')
                  : t('firmware.choose_file', 'Choose .bin file')}
            </button>
            {stagedUpload && (
              <>
                <span style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>
                  {stagedUpload.originalName} ({formatFirmwareSize(stagedUpload.size)})
                </span>
                <button className="save-button" onClick={handleDiscardUpload}>
                  {t('firmware.discard_upload', 'Discard')}
                </button>
              </>
            )}
          </div>

          {stagedUpload && (
            <>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={acknowledgedRisk}
                  onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                  data-testid="firmware-ack-risk"
                />
                <span>
                  {t(
                    'firmware.local_ack',
                    'I built or obtained this file for this exact board, and I can recover the node over USB if it fails to boot.',
                  )}
                </span>
              </label>
              <div>
                <button
                  className="save-button"
                  onClick={handleInstallUpload}
                  disabled={!acknowledgedRisk || !isOtaSupported}
                  data-testid="firmware-install-upload"
                >
                  {t('firmware.install_uploaded', 'Install uploaded firmware')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Check Now + Last Checked */}
      <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--color-text)', fontSize: '0.9rem' }}>
          {t('firmware.last_checked', 'Last Checked')}: {formatTimestamp(lastChecked)}
        </span>
        <button
          className="save-button"
          onClick={handleCheckNow}
          disabled={isChecking}
        >
          {isChecking ? t('firmware.checking', 'Checking...') : t('firmware.check_now', 'Check Now')}
        </button>
      </div>
      </>)}

      {isOtherSourceUpdate && (
        <div
          className="setting-item"
          style={{
            marginTop: '1rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-warning)',
            borderRadius: '4px',
          }}
        >
          <span className="setting-description">
            {t(
              'firmware.update_on_other_source',
              'A firmware update is running on another source. Only one update can run at a time; open that source to follow or cancel it.'
            )}
          </span>
        </div>
      )}

      {/* Update Wizard Modal (blocks UI during firmware update) */}
      {isUpdateActive && effectiveStatus && !isOtherSourceUpdate && (
        <div className="modal-overlay" style={{ zIndex: 10002 }}>
        <div style={{
          padding: '1.5rem',
          borderRadius: '8px',
          backgroundColor: 'var(--color-bg)',
          border: effectiveStatus.state === 'error'
            ? '2px solid var(--color-error)'
            : effectiveStatus.state === 'success'
              ? '2px solid #10b981'
              : '2px solid var(--color-accent)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '85vh',
          overflow: 'auto',
        }}>
          <h3 style={{ margin: '0 0 1rem', color: 'var(--color-text)' }}>
            {t('firmware.update_wizard', 'Firmware Update')}
          </h3>

          {/* Step progress indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            marginBottom: '1rem',
            padding: '0.5rem 0',
          }}>
            {STEP_ORDER.map((s, i) => {
              const currentIdx = STEP_ORDER.findIndex(x => x.key === effectiveStatus.step);
              const isComplete = effectiveStatus.state === 'success'
                || (currentIdx >= 0 && i < currentIdx)
                || (effectiveStatus.state === 'error' && i < currentIdx);
              const isCurrent = s.key === effectiveStatus.step;
              const isFailed = isCurrent && effectiveStatus.state === 'error';

              let dotColor = 'var(--color-surface-active)'; // future
              if (isComplete) dotColor = '#10b981'; // green
              if (isCurrent && !isFailed) dotColor = 'var(--color-accent)';
              if (isFailed) dotColor = 'var(--color-error)';

              return (
                <React.Fragment key={s.key}>
                  {i > 0 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      backgroundColor: isComplete ? '#10b981' : 'var(--color-surface-active)',
                    }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '48px' }}>
                    <div style={{
                      width: isCurrent ? '14px' : '10px',
                      height: isCurrent ? '14px' : '10px',
                      borderRadius: '50%',
                      backgroundColor: dotColor,
                      border: isCurrent ? '2px solid var(--color-text)' : 'none',
                      transition: 'all 0.2s',
                    }} />
                    <span style={{
                      fontSize: '0.7rem',
                      color: isCurrent ? 'var(--color-text)' : 'var(--color-text-subtle)',
                      fontWeight: isCurrent ? 600 : 400,
                      marginTop: '4px',
                    }}>
                      {s.label}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Step title & message */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, color: 'var(--color-text)' }}>
              {getStepTitle(effectiveStatus.step)}
            </h4>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text)', fontSize: '0.9rem' }}>
              {effectiveStatus.message}
            </p>
          </div>

          {/* Sibling-build warning (#5423): the board being flashed shares its
              hw model with other release builds. Shown at every confirm so the
              operator sees it before the flash step, not as a passing toast. */}
          {effectiveStatus.state === 'awaiting-confirm' &&
            effectiveStatus.warnings && effectiveStatus.warnings.length > 0 && (
            <div className={styles.siblingWarning} role="alert" data-testid="ota-sibling-warning">
              <UiIcon name="alert" size={18} className={styles.siblingWarningIcon} />
              <div>
                <strong className={styles.siblingWarningTitle}>
                  {t('firmware.sibling_build_title', 'Check which firmware build your node runs')}
                </strong>
                <ul className={styles.siblingWarningList}>
                  {effectiveStatus.warnings.map((w) => (
                    <li key={w.sibling}>
                      {t('firmware.sibling_build_warning', {
                        defaultValue:
                          'This will flash {{board}}. If your node is a {{siblingLabel}}, cancel and use a custom firmware URL or upload the {{sibling}} .bin instead.',
                        board: w.boardLabel,
                        siblingLabel: w.siblingLabel,
                        sibling: w.sibling,
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Progress bar with percentage */}
          {effectiveStatus.progress !== undefined && effectiveStatus.progress > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                fontSize: '0.85rem',
                color: 'var(--color-text)',
              }}>
                <span>{t('firmware.uploading', 'Uploading firmware...')}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.min(effectiveStatus.progress, 100)}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '16px',
                backgroundColor: 'var(--color-surface-active)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(effectiveStatus.progress, 100)}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-accent)',
                  borderRadius: '8px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {/* Preflight info card */}
          {effectiveStatus.preflightInfo && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--color-surface-hover)',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
              lineHeight: '1.6',
            }}>
              <div><strong>{t('firmware.current_version', 'Current Firmware')}:</strong> {effectiveStatus.preflightInfo.currentVersion}</div>
              <div><strong>{t('firmware.version', 'Version')}:</strong> {effectiveStatus.preflightInfo.targetVersion}</div>
              <div><strong>Gateway IP:</strong> {effectiveStatus.preflightInfo.gatewayIp}</div>
              <div><strong>{t('firmware.hardware_model', 'Hardware Model')}:</strong> {effectiveStatus.preflightInfo.hwModel}</div>
              <div><strong>Board:</strong> {effectiveStatus.preflightInfo.boardName}</div>
              <div><strong>Platform:</strong> {effectiveStatus.preflightInfo.platform}</div>
            </div>
          )}

          {/* OTA bootloader prerequisite warning */}
          {effectiveStatus.step === 'preflight' &&
            effectiveStatus.state === 'awaiting-confirm' && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(250, 179, 40, 0.1)',
              border: '1px solid var(--color-caution)',
              color: 'var(--color-text)',
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
              lineHeight: '1.5',
            }}>
              {t('firmware.ota_bootloader_warning',
                'Wi-Fi OTA requires a one-time OTA bootloader flash via USB. If this is your first OTA update, ensure the bootloader has been installed.'
              )}{' '}
              <a
                href="https://meshmonitor.org/firmware-ota-prerequisites"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-color)' }}
              >
                {t('firmware.ota_bootloader_learn_more', 'Learn More')}
              </a>
            </div>
          )}

          {/* Extract results: matched file */}
          {effectiveStatus.matchedFile && (
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <strong>{t('firmware.matched_file', 'Selected Firmware')}:</strong>{' '}
              <code style={{ color: 'var(--color-accent)' }}>{effectiveStatus.matchedFile}</code>
            </div>
          )}

          {/* Extract results: rejected files (collapsible) */}
          {effectiveStatus.rejectedFiles && effectiveStatus.rejectedFiles.length > 0 && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <button
                onClick={() => setShowRejectedFiles(!showRejectedFiles)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                }}
              >
                {t('firmware.rejected_files', 'Rejected Files')} ({effectiveStatus.rejectedFiles.length})
                {' '}<UiIcon name={showRejectedFiles ? 'chevronUp' : 'chevronDown'} size={14} />
              </button>
              {showRejectedFiles && (
                <ul style={{
                  margin: '0.25rem 0 0 1rem',
                  padding: 0,
                  listStyle: 'disc',
                  color: 'var(--color-text)',
                  opacity: 0.8,
                }}>
                  {effectiveStatus.rejectedFiles.map((f, i) => (
                    <li key={i}><code>{f.name}</code> — {f.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Live log output */}
          {effectiveStatus.logs && effectiveStatus.logs.length > 0 && (
            <pre
              ref={logRef}
              style={{
                maxHeight: '200px',
                overflow: 'auto',
                padding: '0.5rem',
                borderRadius: '4px',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                marginBottom: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <code>{effectiveStatus.logs.join('\n')}</code>
            </pre>
          )}

          {/* Error message */}
          {effectiveStatus.state === 'error' && effectiveStatus.error && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(235, 87, 87, 0.1)',
              color: 'var(--color-error)',
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
            }}>
              {effectiveStatus.error}
            </div>
          )}

          {/* Reboot warning */}
          {effectiveStatus.step === 'extract' &&
            effectiveStatus.state === 'awaiting-confirm' && (
            <p style={{
              color: 'var(--color-caution)',
              fontSize: '0.85rem',
              margin: '0 0 0.75rem',
            }}>
              {t('firmware.reboot_warning', 'The node will reboot during the update and be briefly unavailable.')}
            </p>
          )}

          {/* Half-flash recovery panel (issue #3413) — replaces the raw
              "DELETE /api/firmware/recovery-marker/..." toast with a guided,
              one-click recovery flow that checks the node is back online. */}
          {halfFlashedNodeId && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(250, 179, 40, 0.1)',
              border: '1px solid var(--color-caution)',
              color: 'var(--color-text)',
              fontSize: '0.85rem',
              marginBottom: '0.75rem',
              lineHeight: '1.5',
            }}>
              <strong>
                {t('firmware.recovery_title', 'Device flagged as half-flashed')}
              </strong>
              <p style={{ margin: '0.5rem 0' }}>
                {t(
                  'firmware.recovery_explanation',
                  'A previous OTA attempt did not finish, so MeshMonitor flagged this node to prevent another flash on a possibly corrupted device. Recover it via a USB-tethered flash first. Once it is back online, clear the flag below to retry.'
                )}
              </p>
              {/* Live "online and accepting connections" indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: isGatewayOnline ? '#10b981' : 'var(--color-error)',
                  flexShrink: 0,
                }} />
                <span>
                  {isGatewayOnline
                    ? t('firmware.recovery_online', 'Node is online and accepting connections — it appears to have recovered.')
                    : t('firmware.recovery_offline', 'Node is not online and accepting connections yet. Recover it via USB and wait for it to reconnect.')}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            {halfFlashedNodeId ? (
              <>
                <button
                  className="save-button"
                  onClick={handleClearMarkerAndRetry}
                  disabled={!isGatewayOnline || isClearingMarker}
                  title={
                    !isGatewayOnline
                      ? t(
                          'firmware.recovery_not_online',
                          'Node is not online and accepting connections yet. Recover it via USB and wait for it to reconnect before clearing the flag.'
                        )
                      : undefined
                  }
                >
                  {isClearingMarker
                    ? <><UiIcon name="time" /> Working...</>
                    : t('firmware.recovery_clear_retry', "I've Recovered via USB — Clear Flag & Retry")}
                </button>
                <button className="danger-button" onClick={handleCancel}>
                  {t('firmware.wizard_cancel', 'Cancel Update')}
                </button>
              </>
            ) : (
              <>
            {effectiveStatus.state === 'awaiting-confirm' && (
              <button className="save-button" onClick={handleConfirm} disabled={isConfirming}>
                {isConfirming ? <><UiIcon name="time" /> Working...</> : t('firmware.wizard_confirm', 'Confirm & Proceed')}
              </button>
            )}
            {(effectiveStatus.state === 'awaiting-confirm' || effectiveStatus.state === 'in-progress') && (
              <button className="danger-button" onClick={handleCancel}>
                {t('firmware.wizard_cancel', 'Cancel Update')}
              </button>
            )}
            {effectiveStatus.state === 'success' && (
              <button className="save-button" onClick={handleDone}>
                Done
              </button>
            )}
            {effectiveStatus.state === 'error' && (
              <>
                {effectiveStatus.step === 'flash' && (
                  <button className="save-button" onClick={handleRetryFlash}>
                    {t('firmware.retry_flash', 'Retry Flash')}
                  </button>
                )}
                <button className="save-button" onClick={handleDone}>
                  Dismiss
                </button>
              </>
            )}
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Version List Table (shown when idle) */}
      {!isUpdateActive && !unsupportedHardware && (
        <div style={{ marginTop: '1rem' }}>
          {releases.length === 0 ? (
            <p style={{ color: 'var(--color-text)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              {t('firmware.no_releases', "No releases found. Click 'Check Now' to fetch available firmware versions.")}
            </p>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-surface-active)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text)' }}>
                    {t('firmware.version', 'Version')}
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-text)' }}>
                    {t('firmware.release_date', 'Release Date')}
                  </th>
                  <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--color-text)' }}>
                    {t('firmware.release_notes', 'Release Notes')}
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--color-text)' }}></th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr key={release.tagName} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                      {release.version}
                      {release.prerelease && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.1rem 0.4rem',
                          fontSize: '0.75rem',
                          borderRadius: '3px',
                          backgroundColor: 'var(--color-caution)',
                          color: 'var(--color-bg)',
                        }}>
                          {release.isNightly ? t('firmware.badge_nightly', 'nightly') : 'alpha'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                      {(() => {
                        // Nightly builds carry no publish date; avoid rendering "Invalid Date".
                        const d = new Date(release.publishedAt);
                        return release.publishedAt && !Number.isNaN(d.getTime())
                          ? d.toLocaleDateString()
                          : '—';
                      })()}
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                      <a
                        href={release.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-color)' }}
                      >
                        {t('firmware.release_notes', 'Release Notes')}
                      </a>
                    </td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                      <button
                        className="save-button"
                        onClick={() => handleInstall(release)}
                        disabled={!isOtaSupported}
                        title={
                          !isOtaSupported
                            ? gatewayInfo.isBridged
                              ? t(
                                  'firmware.ota_unavailable_bridged_tooltip',
                                  'This bridged node cannot be flashed over the air. Update it directly via USB.'
                                )
                              : t(
                                  'firmware.ota_unavailable_tooltip',
                                  'OTA firmware update requires a TCP source with a configured host.'
                                )
                            : undefined
                        }
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        {t('firmware.install', 'Install')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Configuration Backups */}
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>
          {t('firmware.backups_title', 'Configuration Backups')}
        </h4>
        {backups.length === 0 ? (
          <p style={{ color: 'var(--color-text)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            {t('firmware.no_backups', 'No configuration backups found.')}
          </p>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.9rem',
          }}>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.filename} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                    {backup.filename}
                  </td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                    {new Date(backup.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                    {formatBytes(backup.size)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                    <button
                      className="save-button"
                      onClick={() => handleRestoreBackup(backup)}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      {t('firmware.restore_backup', 'Restore')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ConfigSection>
  );
};

export default FirmwareUpdateSection;
