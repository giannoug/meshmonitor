/**
 * A MeshCore device's own phone header (8-16): the square and name open the
 * device switcher, the status line opens its Connection card, and `children`
 * (the gear and ⋯) sit at the end. Drawn by the phone Home, and by the
 * permission note (no `connection:read`), so the switcher never goes away.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import ConnectionCard from '../devices/ConnectionCard';
import { statusLabel } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import styles from './MeshCoreHome.module.css';

export default function PhoneDeviceHeader({ sourceId, detail, children }: { sourceId: string; detail?: string | null; children?: ReactNode }) {
  const { t } = useTranslation();
  const { sources, openSwitcher } = useShellDevices();
  const [cardOpen, setCardOpen] = useState(false);
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return null;
  const line = [statusLabel(t, source.status), detail].filter(Boolean).join(' · ');
  return (
    <>
      <header className={styles.header}>
        <div className={styles.ident}>
          <button type="button" className={styles.name} onClick={openSwitcher} aria-haspopup="dialog" aria-label={t('workspace.switcher.open', { name: source.name })}>
            <span className={styles.square} style={{ background: source.colorToken }} aria-hidden="true">{source.abbrev}</span>
            <span className={styles.nameText}>{source.name}</span>
            <UiIcon name="chevronDown" size={18} />
          </button>
          <button
            type="button"
            className={styles.status}
            aria-haspopup="dialog"
            aria-label={t('workspace.connection.status_line', { name: source.name, status: line })}
            onClick={() => setCardOpen(true)}
          >
            <span className={styles.dot} data-status={source.status} aria-hidden="true" />
            <span>{line}</span>
          </button>
        </div>
        {children}
      </header>
      <ConnectionCard source={source} open={cardOpen} onClose={() => setCardOpen(false)} />
    </>
  );
}
