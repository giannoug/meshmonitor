/**
 * The rarely used rows of a category, folded under "Advanced". Whether it is
 * open follows the user per category (`workspace.settings.advanced.<id>`);
 * a viewer who cannot save preferences still opens it for the visit.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreference } from '../../prefs/useUserPreferences';
import { useSettingsCategory } from './useFieldRegistry';
import styles from './kit.module.css';

/**
 * `count`: how many settings it holds, shown as "Advanced · 7 settings" (b-set-p2);
 * `label`: the head's words in full, when the board names what is inside (b-set-d5).
 */
export default function AdvancedCard({ children, count, label }: { children: ReactNode; count?: number; label?: string }) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();
  const categoryId = useSettingsCategory()?.categoryId ?? '';
  const [saved, save] = useUserPreference<boolean>(`workspace.settings.advanced.${categoryId}`, false);
  const [local, setLocal] = useState<boolean | null>(null);
  const open = local ?? saved;
  const toggle = () => {
    setLocal(!open);
    // Anonymous viewers have no preferences to write (the server answers 403); no category, no key.
    if (authStatus?.authenticated && categoryId) void save(!open).catch(() => {});
  };
  return (
    <section className={styles.group}>
      <div className={styles.card}>
        <button type="button" className={styles.advancedHead} aria-expanded={open} onClick={toggle}>
          <span>{label ?? (count === undefined ? t('workspace.settings.advanced') : t('workspace.settings.advanced_count', { count }))}</span>
          <UiIcon name={open ? 'chevronDown' : 'chevronRight'} size={18} />
        </button>
        {open && children}
      </div>
    </section>
  );
}
