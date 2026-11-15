/**
 * A device's settings list (boards b-set-p1-list, 12-06, b-set-d2; note
 * s12n0): PINNED (the user's pins, Task 5.4 adds pinning), ON THE RADIO
 * (Identity, LoRa, Channels, Security, then Device ›, Modules › and
 * Maintenance ›, with the open child listed under its parent) and IN
 * MESHMONITOR. A group the viewer may only look at says "View only".
 *
 * - `sidebar`: the desktop sidebar in settings mode, headed "← <Device> / Settings".
 * - `page`: the phone list page, headed "‹ Home  <Device>".
 */
import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreference } from '../prefs/useUserPreferences';
import {
  GROUPS,
  categoryById,
  readOnlyFor,
  resolveSettingsPath,
  type CategoryDef,
} from './categories';
import { useVisibleCategories } from './useVisibleCategories';
import styles from './SettingsList.module.css';

const ICONS: Record<string, UiIconName> = {
  identity: 'identity',
  lora: 'radioSignal',
  channels: 'channels',
  security: 'security',
  device: 'configuration',
  modules: 'package',
  maintenance: 'wrench',
  'mqtt-bridge': 'server',
  'node-display': 'nodes',
  telemetry: 'telemetry',
  notifications: 'notifications',
  'packet-monitor': 'activity',
  'pki-dm': 'key',
  'reliable-pki': 'encrypted',
  data: 'database',
  'coverage-recording': 'radio',
};

interface Row {
  key: string;
  to: string;
  label: string;
  icon: UiIconName;
  tone: 'pin' | 'radio' | 'device' | 'meshmonitor';
  active: boolean;
  chevron: boolean;
  child?: boolean;
}

export interface SettingsListProps {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  variant: 'sidebar' | 'page';
  /** Called after a row is followed (closes the drawer). */
  onNavigate?: () => void;
}

export default function SettingsList({ sourceId, sourceName, sourceType, variant, onNavigate }: SettingsListProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { hasPermission } = useAuth();
  const { categories } = useVisibleCategories(sourceId, sourceType);
  const [pins] = useUserPreference<string[]>('settings.pins', []);
  const device = `/source/${encodeURIComponent(sourceId)}`;
  const base = `${device}/settings`;
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : '';
  const open = resolveSettingsPath(rest);
  const openGroup = open.group ?? (open.categoryId ? categoryById(open.categoryId)?.group : undefined);
  const visible = new Set(categories.map((c) => c.id));

  const row = (c: CategoryDef, tone: Row['tone'], child = false): Row => ({
    key: c.id,
    to: `${base}/${c.id}`,
    label: t(c.labelKey),
    icon: ICONS[c.id] ?? ICONS[c.group ?? ''] ?? 'settings',
    tone,
    active: open.categoryId === c.id,
    chevron: false,
    child,
  });

  const pinned: Row[] = (Array.isArray(pins) ? pins : [])
    .filter((id) => visible.has(id))
    .map((id) => ({ ...row(categoryById(id)!, 'pin'), key: `pin:${id}`, icon: 'favorite', active: false }));

  const radio: Row[] = [];
  for (const c of categories.filter((c) => c.scope === 'radio' && !c.group)) radio.push(row(c, 'radio'));
  for (const g of GROUPS) {
    const children = categories.filter((c) => c.group === g);
    if (children.length === 0) continue;
    radio.push({
      key: g,
      to: `${base}/${g}`,
      label: t(`workspace.settings.group.${g}`),
      icon: ICONS[g],
      tone: 'device',
      active: open.group === g,
      chevron: true,
    });
    const openChild = children.find((c) => c.id === open.categoryId);
    if (variant === 'sidebar' && openGroup === g && openChild) radio.push(row(openChild, 'device', true));
  }
  const meshmonitor = categories.filter((c) => c.scope === 'meshmonitor').map((c) => row(c, 'meshmonitor'));

  const sidebar = variant === 'sidebar';
  return (
    <div className={styles.frame} data-variant={variant}>
      <div className={styles.head}>
        {sidebar ? (
          <Link to={device} className={styles.back} data-testid="settings-back" onClick={onNavigate}>
            <UiIcon name="back" size={20} />
            <span className={styles.headText}>
              <span className={styles.title} title={sourceName}>{sourceName}</span>
              <span className={styles.subtitle}>{t('nav.settings')}</span>
            </span>
          </Link>
        ) : (
          <>
            <Link to={device} className={styles.pageBack} data-testid="settings-back">
              <UiIcon name="back" size={22} />
              <span>{t('workspace.tabs.home')}</span>
            </Link>
            <h1 className={styles.pageTitle}>{sourceName}</h1>
          </>
        )}
      </div>
      <nav className={styles.body} aria-label={t('nav.settings')}>
        <Section title={t('workspace.settings.pinned')} rows={pinned} sidebar={sidebar} onNavigate={onNavigate} />
        <Section
          title={t('workspace.settings.on_radio')}
          rows={radio}
          sidebar={sidebar}
          onNavigate={onNavigate}
          viewOnly={radio.length > 0 && readOnlyFor('radio', hasPermission, sourceId)}
        />
        <Section
          title={t('workspace.settings.in_meshmonitor')}
          rows={meshmonitor}
          sidebar={sidebar}
          onNavigate={onNavigate}
          viewOnly={meshmonitor.length > 0 && readOnlyFor('meshmonitor', hasPermission, sourceId)}
        />
      </nav>
    </div>
  );
}

function Section({ title, rows, sidebar, viewOnly, onNavigate }: { title: string; rows: Row[]; sidebar: boolean; viewOnly?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <span id={id}>{title}</span>
        {viewOnly && <span className={styles.viewOnly}>{t('workspace.settings.view_only')}</span>}
      </h2>
      <ul className={styles.list} aria-labelledby={id}>
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              to={r.to}
              className={styles.row}
              data-child={r.child || undefined}
              aria-current={r.active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {!sidebar && (
                <span className={styles.tile} data-tone={r.tone} aria-hidden="true">
                  <UiIcon name={r.icon} size={20} />
                </span>
              )}
              {sidebar && r.tone === 'pin' && <UiIcon name="favorite" size={14} />}
              <span className={styles.label}>{r.label}</span>
              {(r.chevron || !sidebar) && <UiIcon name="chevronRight" size={sidebar ? 16 : 20} />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
