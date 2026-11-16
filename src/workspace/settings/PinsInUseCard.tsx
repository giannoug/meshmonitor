/**
 * "Pins in use" (boards 12-06 desktop, 12-22 phone): every GPIO pin the
 * device's configuration sets, with what uses it and where it is set,
 * from today's GpioPinSummary rules (gpioPins.ts), each linking to the
 * category it is set in. A pin with two uses is flagged with today's warning.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { gpioPinUsages, groupPinUsages, type PinUsage } from '../../components/configuration/gpioPins';
import type { DeviceConfigState } from '../../hooks/deviceConfig/useDeviceConfigState';
import { useIsPhone } from '../shell/useIsPhone';
import { categoryById } from './categories';
import styles from './PinsInUseCard.module.css';

/** The category each pin is set in, by the state value that holds it. */
const SET_IN: Array<[RegExp, string]> = [
  [/^(button|buzzer)Gpio$/, 'device/device'],
  [/^(rx|tx|gpsEn)Gpio$/, 'device/position'],
  [/^extNotif/, 'modules/extnotif'],
  [/^cannedMsg/, 'modules/cannedmsg'],
  [/^audio/, 'modules/audio'],
  [/^detectionSensor/, 'modules/detectionsensor'],
  [/^serial/, 'modules/serial'],
];

/** `base`: the device's settings path, for each pin's "Set in" link. */
export default function PinsInUseCard({ state, base }: { state: DeviceConfigState; base: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const setIn = (u: PinUsage) => {
    const id = SET_IN.find(([re]) => re.test(u.fieldKey))?.[1];
    const def = id ? categoryById(id) : undefined;
    return def ? <Link to={`${base}/${def.id}`} className={styles.link}>{t(def.labelKey)}</Link> : u.section;
  };
  const groups = groupPinUsages(gpioPinUsages(state, t));
  const conflict = groups.some(([, uses]) => uses.length > 1);

  return (
    <section className={styles.card} aria-labelledby="settings-pins-heading" data-phone={isPhone || undefined}>
      <h2 className={styles.heading} id="settings-pins-heading">{t('workspace.settings.pins.title')}</h2>
      <div className={styles.box}>
        {groups.length === 0 ? (
          <p className={styles.note}>{t('gpio_summary.no_pins')}</p>
        ) : (
          <table className={styles.table}>
            <thead className={isPhone ? styles.hidden : undefined}>
              <tr>
                <th scope="col">{t('workspace.settings.pins.gpio')}</th>
                <th scope="col">{t('workspace.settings.pins.used_as')}</th>
                {!isPhone && <th scope="col">{t('workspace.settings.pins.set_in')}</th>}
              </tr>
            </thead>
            <tbody>
              {groups.map(([pin, uses]) => (
                <tr key={pin} data-conflict={uses.length > 1 || undefined}>
                  <th scope="row" className={styles.pin}>
                    {t('workspace.settings.pins.pin', { pin })}
                    {uses.length > 1 && <UiIcon name="alert" size={14} />}
                  </th>
                  {isPhone ? (
                    <td>
                      {uses.map((u) => (
                        <span key={u.fieldKey} className={styles.use}>
                          <span>{u.field}</span>
                          <span className={styles.where}>{setIn(u)}</span>
                        </span>
                      ))}
                    </td>
                  ) : (
                    <>
                      <td>{uses.map((u) => <span key={u.fieldKey} className={styles.use}>{u.field}</span>)}</td>
                      <td>{uses.map((u) => <span key={u.fieldKey} className={styles.use}>{setIn(u)}</span>)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {conflict && (
          <p className={styles.warning} role="alert">
            <UiIcon name="alert" size={16} />
            <span>{t('gpio_summary.conflict_warning')}</span>
          </p>
        )}
        {!isPhone && (
          <p className={styles.note}>
            <UiIcon name="info" size={16} />
            <span>{t('workspace.settings.pins.note')}</span>
          </p>
        )}
      </div>
    </section>
  );
}
