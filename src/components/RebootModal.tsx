import React from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from './icons';
import { useRebootWait } from '../hooks/useRebootWait';

interface RebootModalProps {
  isOpen: boolean;
  /**
   * `always`: the save reboots the node. `possible`: it reboots only if
   * certain fields changed, so a node that stays up is not an error (#5823).
   */
  expectation?: 'always' | 'possible';
  onClose: () => void;
}

export const RebootModal: React.FC<RebootModalProps> = ({ isOpen, expectation = 'always', onClose }) => {
  const { t } = useTranslation();
  const { statusKey, statusParams, elapsedSeconds, isVerifying } = useRebootWait(isOpen, expectation, onClose);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          background: 'var(--color-bg)',
          borderRadius: '8px',
          padding: '2rem',
          border: '2px solid var(--color-accent)',
          boxShadow: '0 0 20px color-mix(in srgb, var(--color-accent) 50%, transparent)'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-accent)', marginBottom: '1rem' }}>
            <UiIcon name={isVerifying ? 'check' : 'refresh'} /> {t(expectation === 'possible' ? 'reboot.title_possible' : 'reboot.title')}
          </div>

          <div style={{ fontSize: '1rem', color: 'var(--color-text)', marginBottom: '1.5rem' }}>
            {t(statusKey, statusParams)}
          </div>

          {!isVerifying && elapsedSeconds > 0 && (
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-subtle)', marginBottom: '1.5rem' }}>
              {t('reboot.elapsed', { seconds: elapsedSeconds })}
            </div>
          )}

          {!isVerifying && (
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'var(--color-surface-hover)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginBottom: '1rem'
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--color-accent)',
                  animation: 'progress-bar 2s ease-in-out infinite',
                  width: '30%'
                }}
              />
            </div>
          )}

          <style>{`
            @keyframes progress-bar {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(300%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>

          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '1rem' }}>
            {t('reboot.do_not_close')}
          </div>
        </div>
      </div>
    </div>
  );
};
