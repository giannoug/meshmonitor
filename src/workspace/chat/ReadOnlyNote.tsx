/**
 * What a conversation shows in place of the composer when the viewer cannot
 * send (boards 10-05, 10-14; note ds7, s10n3). TX disabled is not here: the
 * composer stays, disabled, with today's tooltip (Composer's
 * `disabledReason`).
 *
 * - `mqtt`: an MQTT mirror has no radio. Today's reason, and a link to the same
 *   conversation on a device with a radio, when there is one (a DM, 10-05).
 * - `receive-only`: the same, as one line in a channel (i5, Task 6.7): today's
 *   reason, and Switch to the channel on a device with a radio.
 * - `guest`: not signed in; channels only, with today's Login.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SignInDialog } from '../auth/SignInCard';
import { UiIcon } from '../../components/icons';
import styles from './ReadOnlyNote.module.css';

export type ReadOnlyNoteProps =
  | { kind: 'mqtt'; deviceName: string; openOn?: { name: string; to: string } }
  | { kind: 'receive-only'; switchTo?: string }
  | { kind: 'guest' };

export default function ReadOnlyNote(props: ReadOnlyNoteProps) {
  const { t } = useTranslation();
  const [loginOpen, setLoginOpen] = useState(false);

  if (props.kind === 'receive-only') {
    return (
      <div className={`${styles.note} ${styles.line}`} role="note">
        <UiIcon name="network" size={20} />
        <p className={styles.text}>{t('tx_disabled.no_local_radio_tooltip')}</p>
        {props.switchTo && (
          <Link className={styles.secondary} to={props.switchTo}>
            {t('workspace.chat.switch')}
          </Link>
        )}
      </div>
    );
  }

  if (props.kind === 'mqtt') {
    return (
      <div className={styles.note} role="note">
        <UiIcon name="network" size={20} />
        <div className={styles.body}>
          <p className={styles.label}>{t('workspace.chat.mqtt_mirror', { device: props.deviceName })}</p>
          <p className={styles.title}>{t('workspace.chat.receive_only')}</p>
          <p className={styles.text}>{t('tx_disabled.no_local_radio_tooltip')}</p>
          {props.openOn && (
            <Link className={styles.primary} to={props.openOn.to}>
              <UiIcon name="messages" size={16} /> {t('workspace.chat.open_on', { name: props.openOn.name })}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.note} role="note">
      <UiIcon name="visibility" size={20} />
      <div className={styles.body}>
        <p className={styles.text}>{t('workspace.chat.guest_note')}</p>
        <button type="button" className={styles.primary} onClick={() => setLoginOpen(true)}>
          <UiIcon name="user" size={16} /> {t('auth.login')}
        </button>
      </div>
      <SignInDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
