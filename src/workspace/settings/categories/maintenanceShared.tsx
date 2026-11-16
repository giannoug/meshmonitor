/** The parts Maintenance's pages share (Task 5.7): the page wrapper, its header and a row of buttons. */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterField, useSettingsCategory } from '../kit/useFieldRegistry';
import { useSettingsHeader } from '../settingsDock';
import pages from './SettingsPages.module.css';
import styles from './Maintenance.module.css';

const settingsBase = (sourceId: string) => `/source/${encodeURIComponent(sourceId)}/settings`;

/**
 * A Maintenance page's wrapper. A child page (`child`) heads itself
 * "Maintenance ›" above its title, with words after "On the radio".
 */
export function MaintenancePage({ child, children }: { child?: { sourceId: string; scope?: string; phoneTitle?: string }; children: ReactNode }) {
  const { t } = useTranslation();
  useSettingsHeader(
    child ? { back: { to: `${settingsBase(child.sourceId)}/maintenance`, label: t('workspace.settings.group.maintenance') }, scope: child.scope, phoneTitle: child.phoneTitle } : null,
  );
  // Phone styling keys off CategoryPage's <main data-phone>.
  return <div className={styles.page}>{children}</div>;
}

const NO_KEYWORDS: string[] = [];

/**
 * A row whose control is a button or a link (reload, create, the danger
 * actions), registered for settings search as `maintenance.<page>.<field>`.
 */
export function ActionRow({ id, label, help, sends, blocked, children }: {
  id: string;
  label: string;
  help?: ReactNode;
  /** The row's Sends line. */
  sends?: ReactNode;
  /** Why the row's buttons are off (today's reason). */
  blocked?: string | null;
  children: ReactNode;
}) {
  useRegisterField({ id, label, keywords: NO_KEYWORDS, categoryId: useSettingsCategory()?.categoryId ?? '' });
  return (
    <div className={pages.infoRow} data-setting-id={id}>
      <div className={pages.infoText}>
        <span className={pages.infoLabel}>{label}</span>
        {help && <span className={pages.infoHelp}>{help}</span>}
        {blocked && <span className={styles.blocked}>{blocked}</span>}
        {sends}
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}
