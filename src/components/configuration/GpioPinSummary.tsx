import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import { gpioPinUsages, groupPinUsages, type GpioPinValues } from './gpioPins';

type GpioPinSummaryProps = GpioPinValues;

const GpioPinSummary: React.FC<GpioPinSummaryProps> = (props) => {
  const { t } = useTranslation();

  const pinUsages = useMemo(() => gpioPinUsages(props, t), [props, t]);

  // Group by pin number to find conflicts
  const pinGroups = useMemo(() => groupPinUsages(pinUsages), [pinUsages]);

  // Find pins with conflicts (used by more than one field)
  const conflictPins = useMemo(() => {
    return new Set(
      pinGroups
        .filter(([_, usages]) => usages.length > 1)
        .map(([pin]) => pin)
    );
  }, [pinGroups]);

  if (pinUsages.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        border: '1px solid var(--color-surface-active)',
        maxHeight: 'calc(100dvh - 2rem)',
        overflowY: 'auto'
      }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text)' }}>
          {t('gpio_summary.title')}
        </h4>
        <p style={{ margin: 0, color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
          {t('gpio_summary.no_pins')}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: 'var(--color-surface)',
      borderRadius: '8px',
      border: '1px solid var(--color-surface-active)',
      maxHeight: 'calc(100dvh - 2rem)',
      overflowY: 'auto'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text)' }}>
        {t('gpio_summary.title')}
      </h4>
      <p style={{ margin: '0 0 1rem 0', color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
        {t('gpio_summary.description')}
      </p>

      {conflictPins.size > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 68, 68, 0.15)',
          border: '1px solid #ff4444',
          borderRadius: '4px',
          padding: '0.5rem 0.75rem',
          marginBottom: '1rem',
          color: '#ff6b6b',
          fontSize: '0.85rem'
        }}>
          <strong><UiIcon name="alert" /> {t('gpio_summary.conflict_warning')}</strong>
        </div>
      )}

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.8rem'
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-surface-active)' }}>
            <th style={{ textAlign: 'left', padding: '0.4rem', width: '55px' }}>
              {t('gpio_summary.pin')}
            </th>
            <th style={{ textAlign: 'left', padding: '0.4rem' }}>
              {t('gpio_summary.usage')}
            </th>
          </tr>
        </thead>
        <tbody>
          {pinGroups.map(([pin, usages]) => {
            const isConflict = conflictPins.has(pin);
            const rowStyle: React.CSSProperties = {
              borderBottom: '1px solid var(--color-surface-hover)',
              backgroundColor: isConflict ? 'rgba(255, 68, 68, 0.1)' : 'transparent'
            };
            const cellStyle: React.CSSProperties = {
              padding: '0.4rem',
              color: isConflict ? '#ff6b6b' : 'inherit',
              verticalAlign: 'top'
            };

            return (
              <tr key={pin} style={rowStyle}>
                <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {pin}
                  {isConflict && <span style={{ marginLeft: '0.25rem' }}><UiIcon name="alert" size={14} /></span>}
                </td>
                <td style={cellStyle}>
                  {usages.map((usage, idx) => (
                    <div key={idx} style={{ marginBottom: idx < usages.length - 1 ? '0.25rem' : 0 }}>
                      <span style={{ fontWeight: 500 }}>{usage.field}</span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                        {usage.section}
                      </span>
                    </div>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default GpioPinSummary;
