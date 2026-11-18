/**
 * ReticulumConfigurationView — the Reticulum source's Configuration page.
 *
 * Every mode: the LXMF identity section (#6011): destination hash, display
 * name, "Announce now" and the periodic announce interval
 * (`ReticulumIdentitySection`).
 *
 * Own mode only (#3960 Phase 3): RNode radio configuration + device info,
 * because editable radio params exist only when the bridge drives the RNode
 * directly. `showRadio` turns those sections off for attach/tcp_peer.
 *
 * Write controls require `configuration:write` on this source, mirroring
 * MeshCore's config view.
 *
 * Talks to:
 *   GET/PUT /api/sources/:id/reticulum/radio-config
 *   GET     /api/sources/:id/reticulum/device-info
 * Both use the ok() envelope, so responses are read via `.data`.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../icons';
import styles from './ReticulumConfigurationView.module.css';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import { ReticulumIdentitySection } from './ReticulumIdentitySection';
import { useReticulumRadioConfig } from './hooks/useReticulumRadioConfig';

interface ReticulumConfigurationViewProps {
  sourceId: string;
  /** Show the RNode radio + device sections. Only own mode has them; defaults to true. */
  showRadio?: boolean;
}

export const ReticulumConfigurationView: React.FC<ReticulumConfigurationViewProps> = ({ sourceId, showRadio = true }) => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('configuration', 'write', { sourceId });

  const { config, setConfig, setField, deviceInfo, loading, saving, error, status, apply } = useReticulumRadioConfig(sourceId, showRadio);
  const numberScope = useNumberInputScope();

  const save = async () => {
    // A value outside a field's range must never reach the RNode.
    if (numberScope.invalid) return;
    await apply();
  };

  const disabled = !canWrite || saving;

  return (
    <NumberInputScope scope={numberScope}>
    <div className={styles.view}>
      {!canWrite && (
        <div className={styles.banner} role="status">
          <UiIcon name="info" size={14} />
          <span>{t('reticulum.config.readOnlyAll', 'You have read-only access — this configuration cannot be changed.')}</span>
        </div>
      )}

      <ReticulumIdentitySection sourceId={sourceId} canWrite={canWrite} />

      {showRadio && loading && <div className={styles.muted}>{t('common.loading', 'Loading…')}</div>}
      {showRadio && !loading && (<>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {status && <div className={styles.success} role="status">{status}</div>}

      <section className={styles.section}>
        <h3 className={styles.heading}>{t('reticulum.config.radioHeading', 'RNode Radio')}</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>{t('reticulum.config.frequency', 'Frequency (Hz)')}</span>
            <NumberInput allowEmpty value={config.frequency} disabled={disabled}
              onChange={v => setField('frequency', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.bandwidth', 'Bandwidth (Hz)')}</span>
            <NumberInput allowEmpty value={config.bandwidth} disabled={disabled}
              onChange={v => setField('bandwidth', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.sf', 'Spreading Factor')}</span>
            <NumberInput allowEmpty min={5} max={12} value={config.spreadingFactor} disabled={disabled}
              onChange={v => setField('spreadingFactor', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.cr', 'Coding Rate')}</span>
            <NumberInput allowEmpty min={5} max={8} value={config.codingRate} disabled={disabled}
              onChange={v => setField('codingRate', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.txPower', 'TX Power (dBm)')}</span>
            <NumberInput allowEmpty min={0} max={22} value={config.txPower} disabled={disabled}
              onChange={v => setField('txPower', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.stAlock', 'Short Airtime Lock (%)')}</span>
            <NumberInput allowEmpty min={0} max={100} value={config.stAlock} disabled={disabled}
              onChange={v => setField('stAlock', v)} />
          </label>
          <label className={styles.field}>
            <span>{t('reticulum.config.ltAlock', 'Long Airtime Lock (%)')}</span>
            <NumberInput allowEmpty min={0} max={100} value={config.ltAlock} disabled={disabled}
              onChange={v => setField('ltAlock', v)} />
          </label>
          <label className={styles.checkField}>
            <input type="checkbox" checked={config.radioState === true} disabled={disabled}
              onChange={e => setConfig(prev => ({ ...prev, radioState: e.target.checked }))} />
            <span>{t('reticulum.config.radioOn', 'Radio on')}</span>
          </label>
        </div>
        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={() => void save()} disabled={disabled || numberScope.invalid}>
            {saving ? t('common.saving', 'Applying…') : t('reticulum.config.apply', 'Apply')}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{t('reticulum.config.deviceHeading', 'Device Info')}</h3>
        {deviceInfo ? (
          <dl className={styles.deviceGrid}>
            {deviceInfo.firmwareVersion && (<><dt>{t('reticulum.config.firmware', 'Firmware')}</dt><dd>{deviceInfo.firmwareVersion}</dd></>)}
            {deviceInfo.mcu && (<><dt>{t('reticulum.config.mcu', 'MCU')}</dt><dd>{deviceInfo.mcu}</dd></>)}
            {deviceInfo.platform && (<><dt>{t('reticulum.config.platform', 'Platform')}</dt><dd>{deviceInfo.platform}</dd></>)}
            {typeof deviceInfo.chipTemp === 'number' && (<><dt>{t('reticulum.config.chipTemp', 'Chip temp')}</dt><dd>{deviceInfo.chipTemp} °C</dd></>)}
          </dl>
        ) : (
          <div className={styles.muted}>{t('reticulum.config.noDevice', 'Device info unavailable.')}</div>
        )}
      </section>
      </>)}
    </div>
    </NumberInputScope>
  );
};

export default ReticulumConfigurationView;
