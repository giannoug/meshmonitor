/**
 * A device's settings list (boards b-set-p1-list, 12-06, b-set-d2; note
 * s12n0): PINNED (the user's pins, Task 5.4 adds pinning), ON THE RADIO
 * (Identity, LoRa, Channels, Security, then Device ›, Modules › and
 * Maintenance ›, with the open child listed under its parent) and IN
 * MESHMONITOR. A group the viewer may only look at says "View only".
 *
 * Its search field (Task 5.4) filters this list to the device's categories
 * that match (label and today's section keywords) and offers "Search
 * everywhere", which opens ⌘, settings search with the same words.
 *
 * - `sidebar`: the desktop sidebar in settings mode, headed "← <Device> / Settings".
 * - `page`: the phone list page, headed "‹ Home  <Device>".
 *
 * An admin on a Meshtastic radio picks what the settings configure under the
 * head ("Configuring This radio ▾", Task 5.9). On a remote node the list is
 * that node's (b-set-d6): ON <NODE> with what today's Admin Commands offers
 * there, each category's last Send to node (Sent · waiting, Acknowledged,
 * No reply), and REMOTE ONLY (Node management, Remote console); In
 * MeshMonitor is about this server, so it is not listed.
 */
import { useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { matchesQuery, tokenize } from '../../components/search/configSearchMatch';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import { isMac } from './kit/useFieldRegistry';
import { usePins } from './usePins';
import {
  GROUPS,
  categoryById,
  categoryIndex,
  readOnlyFor,
  resolveSettingsPath,
  type CategoryDef,
} from './categories';
import { useVisibleCategories } from './useVisibleCategories';
import TargetPickerTrigger from './remote/TargetPickerTrigger';
import { useRemoteEntry } from './remote/remoteTargetStore';
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
  /** The viewer may only look (shown per row when its group is mixed). */
  readOnly: boolean;
  /** A remote category's last Send to node. */
  status?: { text: string; tone: string };
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
  const { hasPermission, authStatus } = useAuth();
  const remote = useRemoteEntry(sourceId);
  const { categories } = useVisibleCategories(sourceId, sourceType, !!remote.node);
  const canPick = authStatus?.user?.isAdmin === true && sourceType === 'meshtastic_tcp';
  const SENT: Record<string, string> = {
    sending: 'workspace.settings.remote.sent_waiting',
    acknowledged: 'workspace.settings.remote.acknowledged',
    noReply: 'workspace.settings.remote.no_reply',
  };
  const { pins } = usePins();
  const isPhone = useIsPhone();
  const { openSettingsSearch } = useShellDevices();
  const [query, setQuery] = useState('');
  const fieldId = useId();
  const keywords = useMemo(() => new Map(categoryIndex().map((c) => [c.id, c.keywords.join(' ')])), []);
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
    readOnly: readOnlyFor(c, hasPermission, sourceId),
    status: remote.sent[c.id] ? { text: t(SENT[remote.sent[c.id]]), tone: remote.sent[c.id] } : undefined,
  });

  const pinned: Row[] = pins
    .filter((id) => visible.has(id))
    .map((id) => ({ ...row(categoryById(id)!, 'pin'), key: `pin:${id}`, icon: 'favorite', active: false }));

  const radio: Row[] = [];
  for (const c of categories.filter((c) => c.scope === 'radio' && !c.group && c.remote !== 'only')) radio.push(row(c, 'radio'));
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
      readOnly: children.every((c) => readOnlyFor(c, hasPermission, sourceId)),
    });
    const openChild = children.find((c) => c.id === open.categoryId);
    if (variant === 'sidebar' && openGroup === g && openChild) radio.push(row(openChild, 'device', true));
  }
  const meshmonitor = categories.filter((c) => c.scope === 'meshmonitor').map((c) => row(c, 'meshmonitor'));
  const remoteOnly = categories.filter((c) => c.remote === 'only').map((c) => row(c, 'radio'));
  // Maintenance › closes the list on a remote node, as b-set-d6 draws it.
  const maintenance = remote.node ? radio.findIndex((r) => r.key === 'maintenance') : -1;
  const radioTail = maintenance >= 0 ? radio.splice(maintenance) : [];

  const sidebar = variant === 'sidebar';
  const tokens = tokenize(query);
  const found = categories
    .filter((c) => matchesQuery(`${t(c.labelKey)} ${keywords.get(c.id) ?? ''}`, tokens))
    .map((c) => row(c, c.scope === 'meshmonitor' ? 'meshmonitor' : c.group ? 'device' : 'radio'));
  const followed = () => {
    setQuery('');
    onNavigate?.();
  };
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
      {canPick && (
        <div className={styles.picker}>
          <TargetPickerTrigger sourceId={sourceId} />
        </div>
      )}
      <div className={styles.search}>
        <UiIcon name="search" size={16} />
        <label htmlFor={fieldId} className={styles.srOnly}>{t('config_search.title')}</label>
        <input
          id={fieldId}
          type="search"
          className={styles.searchInput}
          value={query}
          placeholder={isPhone ? t('config_search.title') : t('workspace.settings.search.device_placeholder', { device: sourceName })}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!isPhone && (
          <kbd className={styles.kbd}>
            {t(isMac() ? 'workspace.settings.search.shortcut_mac' : 'workspace.settings.search.shortcut_other')}
          </kbd>
        )}
      </div>
      <nav className={styles.body} aria-label={t('nav.settings')}>
        {tokens.length > 0 ? (
          <>
            {found.length > 0 ? (
              <Section title={t('workspace.settings.categories')} rows={found} sidebar={sidebar} onNavigate={followed} />
            ) : (
              <p className={styles.empty}>{t('config_search.no_sections')}</p>
            )}
            {openSettingsSearch && (
              <button type="button" className={styles.everywhere} onClick={() => openSettingsSearch(query)}>
                <UiIcon name="search" size={16} />
                <span className={styles.label}>{t('workspace.settings.search.everywhere')}</span>
                <UiIcon name="chevronRight" size={16} />
              </button>
            )}
          </>
        ) : (
          <>
            <Section title={t('workspace.settings.pinned')} rows={pinned} sidebar={sidebar} onNavigate={onNavigate} />
            <Section
              title={remote.node ? t('workspace.settings.remote.on_node', { name: remote.node.longName }) : t('workspace.settings.on_radio')}
              rows={radio}
              sidebar={sidebar}
              onNavigate={onNavigate}
            />
            <Section title={t('workspace.settings.remote.remote_only')} rows={[...remoteOnly, ...radioTail]} sidebar={sidebar} onNavigate={onNavigate} />
            <Section title={t('workspace.settings.in_meshmonitor')} rows={meshmonitor} sidebar={sidebar} onNavigate={onNavigate} />
          </>
        )}
      </nav>
    </div>
  );
}

/** "View only" beside the group when the viewer may only look at all of it, else beside each such row. */
function Section({ title, rows, sidebar, onNavigate }: { title: string; rows: Row[]; sidebar: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  if (rows.length === 0) return null;
  const viewOnly = rows.every((r) => r.readOnly);
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
              {r.status && <span className={styles.status} data-tone={r.status.tone}>{r.status.text}</span>}
              {!viewOnly && r.readOnly && <span className={styles.viewOnly}>{t('workspace.settings.view_only')}</span>}
              {(r.chevron || !sidebar) && <UiIcon name="chevronRight" size={sidebar ? 16 : 20} />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
