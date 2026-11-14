/**
 * What a conversation shows in place of the composer when the viewer cannot
 * send (boards 10-05, 10-14; note ds7, s10n3). TX disabled is not here: the
 * composer stays, disabled, with today's tooltip (Composer's
 * `disabledReason`).
 *
 * - `mqtt`: an MQTT mirror has no radio. Today's reason, and a link to the same
 *   conversation on a device with a radio, when there is one.
 * - `guest`: not signed in; channels only, with today's Login.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LoginModal from '../../components/LoginModal';
import { UiIcon } from '../../components/icons';
import styles from './ReadOnlyNote.module.css';

export type ReadOnlyNoteProps =
  | { kind: 'mqtt'; deviceName: string; openOn?: { name: string; to: string } }
  | { kind: 'guest' };

export default function ReadOnlyNote(props: ReadOnlyNoteProps) {
  const { t } = useTranslation();
  const [loginOpen, setLoginOpen] = useState(false);

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
      {createPortal(<LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />, document.body)}
    </div>
  );
}
