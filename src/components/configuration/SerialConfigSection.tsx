import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { useSaveBar } from '../../hooks/useSaveBar';
import { useSectionBaseline } from '../../hooks/useSectionBaseline';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { useNumberInputScope } from '../common/numberInputScopeContext';
import ModuleAvailabilityNotice from './ModuleAvailabilityNotice';
import { ConfigSection } from '../shared/config/ConfigSection';
import { SERIAL_BAUD_OPTIONS, SERIAL_MODE_OPTIONS } from './constants';

interface SerialConfigSectionProps {
  /** False disables every control: no configuration:write on this source (#5830). */
  canWrite?: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  echo: boolean;
  setEcho: (value: boolean) => void;
  rxd: number;
  setRxd: (value: number) => void;
  txd: number;
  setTxd: (value: number) => void;
  baud: number;
  setBaud: (value: number) => void;
  timeout: number;
  setTimeout: (value: number) => void;
  mode: number;
  setMode: (value: number) => void;
  overrideConsoleSerialPort: boolean;
  setOverrideConsoleSerialPort: (value: boolean) => void;
  isSaving: boolean;
  /** Resolves true when the node accepted the save. */
  onSave: () => Promise<boolean>;
}

const SerialConfigSection: React.FC<SerialConfigSectionProps> = ({
  canWrite = true,
  enabled,
  setEnabled,
  echo,
  setEcho,
  rxd,
  setRxd,
  txd,
  setTxd,
  baud,
  setBaud,
  timeout,
  setTimeout,
  mode,
  setMode,
  overrideConsoleSerialPort,
  setOverrideConsoleSerialPort,
  isSaving,
  onSave
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // What the node holds; moves on a successful save (#5797)
  const values = {
    enabled, echo, rxd, txd, baud, timeout, mode, overrideConsoleSerialPort
  };
  const { baseline, hasChanges, commit } = useSectionBaseline(values);

  // Reset to initial values (for SaveBar dismiss)
  const resetChanges = useCallback(() => {
    setEnabled(baseline.enabled);
    setEcho(baseline.echo);
    setRxd(baseline.rxd);
    setTxd(baseline.txd);
    setBaud(baseline.baud);
    setTimeout(baseline.timeout);
    setMode(baseline.mode);
    setOverrideConsoleSerialPort(baseline.overrideConsoleSerialPort);
  }, [baseline, setEnabled, setEcho, setRxd, setTxd, setBaud, setTimeout, setMode, setOverrideConsoleSerialPort]);

  // Move the baseline only when the node took the save
  const handleSave = async () => {
    if (await onSave()) commit(values);
  };

  // Register with SaveBar
  const numberScope = useNumberInputScope();
  useSaveBar({
    id: 'serial-config',
    sectionName: t('serial_config.title'),
    hasChanges,
    isSaving,
    onSave: handleSave,
    onDismiss: resetChanges,
    numberScope
  });

  return (
    <NumberInputScope scope={numberScope}>
    <ConfigSection canWrite={canWrite} title={t('serial_config.title')} docsUrl="https://meshtastic.org/docs/configuration/module/serial/" notice={<ModuleAvailabilityNotice />}>

      {/* Enable Module */}
      <div className="setting-item">
        <label htmlFor="serialEnabled" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <input
            id="serialEnabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            style={{ marginTop: '0.2rem', flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div>{t('serial_config.enabled')}</div>
            <span className="setting-description">{t('serial_config.enabled_description')}</span>
          </div>
        </label>
      </div>

      {enabled && (
        <>
          {/* Mode */}
          <div className="setting-item">
            <label htmlFor="serialMode">
              {t('serial_config.mode')}
              <span className="setting-description">{t('serial_config.mode_description')}</span>
            </label>
            <select
              id="serialMode"
              value={mode}
              onChange={(e) => setMode(parseInt(e.target.value))}
              className="setting-input"
            >
              {SERIAL_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Baud Rate */}
          <div className="setting-item">
            <label htmlFor="serialBaud">
              {t('serial_config.baud')}
              <span className="setting-description">{t('serial_config.baud_description')}</span>
            </label>
            <select
              id="serialBaud"
              value={baud}
              onChange={(e) => setBaud(parseInt(e.target.value))}
              className="setting-input"
            >
              {SERIAL_BAUD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.name} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Echo */}
          <div className="setting-item">
            <label htmlFor="serialEcho" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <input
                id="serialEcho"
                type="checkbox"
                checked={echo}
                onChange={(e) => setEcho(e.target.checked)}
                style={{ marginTop: '0.2rem', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div>{t('serial_config.echo')}</div>
                <span className="setting-description">{t('serial_config.echo_description')}</span>
              </div>
            </label>
          </div>

          {/* Advanced Section Toggle */}
          <div className="setting-item">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="advanced-toggle-btn"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-surface-active)',
                color: 'var(--color-text-subtle)',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span><UiIcon name={showAdvanced ? 'chevronDown' : 'forward'} /></span>
              {t('serial_config.advanced_settings')}
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="advanced-section" style={{
              marginLeft: '1rem',
              paddingLeft: '1rem',
              borderLeft: '2px solid var(--color-surface-active)'
            }}>
              {/* RXD Pin */}
              <div className="setting-item">
                <label htmlFor="serialRxd">
                  {t('serial_config.rxd')}
                  <span className="setting-description">{t('serial_config.rxd_description')}</span>
                </label>
                <NumberInput
                  id="serialRxd"
                  min={0}
                  max={255}
                  value={rxd}
                  integer
                  onChange={setRxd}
                  className="setting-input"
                  style={{ width: '100px' }}
                />
              </div>

              {/* TXD Pin */}
              <div className="setting-item">
                <label htmlFor="serialTxd">
                  {t('serial_config.txd')}
                  <span className="setting-description">{t('serial_config.txd_description')}</span>
                </label>
                <NumberInput
                  id="serialTxd"
                  min={0}
                  max={255}
                  value={txd}
                  integer
                  onChange={setTxd}
                  className="setting-input"
                  style={{ width: '100px' }}
                />
              </div>

              {/* Timeout */}
              <div className="setting-item">
                <label htmlFor="serialTimeout">
                  {t('serial_config.timeout')}
                  <span className="setting-description">{t('serial_config.timeout_description')}</span>
                </label>
                <NumberInput
                  id="serialTimeout"
                  min={0}
                  max={65535}
                  value={timeout}
                  integer
                  onChange={setTimeout}
                  className="setting-input"
                  placeholder="0"
                />
              </div>

              {/* Override Console Serial Port */}
              <div className="setting-item">
                <label htmlFor="serialOverrideConsole" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                  <input
                    id="serialOverrideConsole"
                    type="checkbox"
                    checked={overrideConsoleSerialPort}
                    onChange={(e) => setOverrideConsoleSerialPort(e.target.checked)}
                    style={{ marginTop: '0.2rem', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div>{t('serial_config.override_console')}</div>
                    <span className="setting-description">{t('serial_config.override_console_description')}</span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </>
      )}
    </ConfigSection>
    </NumberInputScope>
  );
};

export default SerialConfigSection;
