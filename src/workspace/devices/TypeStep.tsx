/**
 * Add device, step 1 (h1 desktop, i1 phone): what is being connected. On
 * desktop a card is picked and Next goes on; on phone a row goes straight on.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useIsPhone } from '../shell/useIsPhone';
import { DEVICE_TYPES } from './deviceInfo';
import type { SourceType } from './useSourceForm';
import styles from './Devices.module.css';

export default function TypeStep({ value, onPick }: { value: SourceType; onPick(type: SourceType, go: boolean): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const id = useId();
  return (
    <div className={styles.step}>
      <h3 className={styles.question}>{t('workspace.devices.type_question')}</h3>
      <p className={styles.lead}>{t(isPhone ? 'workspace.devices.type_lead_phone' : 'workspace.devices.type_lead')}</p>
      <div className={styles.types} role="radiogroup" aria-label={t('workspace.devices.type_question')} data-phone={isPhone || undefined}>
        {DEVICE_TYPES.map(({ type, icon, tone }) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value === type}
            aria-labelledby={`${id}-${type}`}
            aria-describedby={`${id}-${type}-desc`}
            className={styles.typeCard}
            data-phone={isPhone || undefined}
            onClick={() => onPick(type, isPhone)}
          >
            <span className={styles.typeIcon} style={{ background: `var(--device-${tone})` }}>
              <UiIcon name={icon} size={22} />
            </span>
            <span className={styles.typeText}>
              <span className={styles.typeTitle} id={`${id}-${type}`}>{t(`workspace.devices.type.${type}`)}</span>
              <span className={styles.typeDesc} id={`${id}-${type}-desc`}>{t(`workspace.devices.type.${type}_desc`)}</span>
            </span>
            {isPhone && <UiIcon name="chevronRight" size={20} />}
          </button>
        ))}
      </div>
    </div>
  );
}
