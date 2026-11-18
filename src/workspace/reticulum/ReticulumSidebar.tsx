/**
 * A Reticulum device's lists in layout D (boards 9-01 … 9-08, note s9n0), and
 * on the phone Home (9-09): Map, Destinations (with today's count),
 * Dashboard and More tools… (Interfaces, Paths, Info), then LXMF MESSAGES:
 * one row per conversation with the peer, a preview and the time, newest
 * first. As today there are no unread dots, and no "New conversation" (s9n2):
 * a conversation exists once a peer has messaged this identity. A peer is
 * named from its announce; one that never announced shows its hash.
 *
 * The lists come from the device screen's one poll (`rnsKeys.lists`): this
 * makes no request of its own and nothing here sends.
 */
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useSettingsOptional } from '../../contexts/SettingsContext';
import { UiIcon, type UiIconName } from '../../components/icons';
import { mapNav } from '../../components/nav/sourceNavEntries';
import { formatTimeOrDate } from '../../utils/datetime';
import RowMenu from '../patterns/RowMenu';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { peerMark, peerTone, peerName, rnsKeys, type RnsLists } from './runtime';
import listStyles from '../chat/ChannelList.module.css';
import homeStyles from '../chat/PhoneHome.module.css';
import mcStyles from '../meshcore/MeshCoreSidebar.module.css';
import styles from './Reticulum.module.css';

/** More tools…: today's views the board's sidebar has no row for, in today's nav order. */
const MORE: Array<{ view: string; key: string; fallback: string; icon: UiIconName }> = [
  { view: 'interfaces', key: 'reticulum.nav.interfaces', fallback: 'Interfaces', icon: 'network' },
  { view: 'paths', key: 'reticulum.nav.paths', fallback: 'Paths', icon: 'route' },
  { view: 'info', key: 'reticulum.nav.info', fallback: 'Info', icon: 'info' },
];

const NO_LISTS: RnsLists = { conversations: [], destinations: [], destinationCount: null };

export interface ReticulumSidebarProps {
  source: WorkspaceSource;
  onNavigate?: () => void;
  /** `home`: the phone Home's tiles and 52 px rows (9-09). */
  variant?: 'sidebar' | 'home';
}

export default function ReticulumSidebar({ source, onNavigate, variant = 'sidebar' }: ReticulumSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasPermission } = useAuth();
  const sourceId = source.id;
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const home = variant === 'home';
  const lists = useRnsLists(sourceId);
  const canRead = hasPermission('nodes', 'read', { sourceId });
  const canMessages = hasPermission('messages', 'read', { sourceId });
  const canDashboard = hasPermission('dashboard', 'read', { sourceId });
  const inMore = MORE.some((m) => pathname === `${base}/${m.view}`);
  const [moreOpen, setMoreOpen] = useState(inMore);
  const open = moreOpen || inMore;

  const tools: Array<{ key: string; to: string; icon: UiIconName; label: string; count?: string }> = canRead
    ? [
        { key: 'map', to: `${base}/map`, icon: 'map', label: mapNav(t).label },
        {
          key: 'destinations',
          to: `${base}/destinations`,
          icon: 'globe',
          label: t('reticulum.nav.destinations', 'Destinations'),
          count: lists.destinationCount !== null ? String(lists.destinationCount) : undefined,
        },
        ...(canDashboard ? [{ key: 'dashboard', to: `${base}/dashboard`, icon: 'dashboard' as const, label: t('nav.dashboard') }] : []),
      ]
    : [];
  const moreLabel = t('workspace.shell.more_tools');


  return (
    <div className={mcStyles.lists} data-variant={variant}>
      {home ? (
        <nav className={homeStyles.tiles} aria-label={t('workspace.home.tools_label')}>
          {tools.map(({ key, to, icon, label }) => (
            <NavLink key={key} to={to} className={homeStyles.tile}>
              <UiIcon name={icon} size={22} />
              <span className={homeStyles.tileLabel}>{label}</span>
            </NavLink>
          ))}
          {canRead && (
            <RowMenu
              label={t('workspace.home.tools')}
              items={MORE.map((m) => ({
                key: m.view,
                label: t(m.key, m.fallback),
                icon: m.icon,
                onSelect: () => void navigate(`${base}/${m.view}`),
              }))}
              triggerClassName={`${homeStyles.tile} ${mcStyles.tileButton}`}
              trigger={
                <>
                  <UiIcon name="more" size={22} />
                  <span className={homeStyles.tileLabel}>{t('workspace.home.tools')}</span>
                </>
              }
            />
          )}
        </nav>
      ) : (
        <ul className={mcStyles.tools}>
          {tools.map(({ key, to, icon, label, count }) => (
            <li key={key}>
              <NavLink to={to} end className={mcStyles.toolRow} onClick={onNavigate}>
                <UiIcon name={icon} size={16} />
                <span className={mcStyles.label}>{label}</span>
                {count && <span className={mcStyles.count}>{count}</span>}
              </NavLink>
            </li>
          ))}
          {canRead && (
            <li>
              <button
                type="button"
                className={`${mcStyles.toolRow} ${mcStyles.toolButton}`}
                aria-expanded={open}
                onClick={() => setMoreOpen(!open)}
              >
                <UiIcon name="more" size={16} />
                <span className={mcStyles.label}>{moreLabel}</span>
                <span className={mcStyles.count}>
                  <UiIcon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
                </span>
              </button>
              {open && (
                <ul className={styles.subTools}>
                  {MORE.map((m) => (
                    <li key={m.view}>
                      <NavLink to={`${base}/${m.view}`} end className={`${mcStyles.toolRow} ${styles.subTool}`} onClick={onNavigate}>
                        <span className={mcStyles.label}>{t(m.key, m.fallback)}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )}
        </ul>
      )}

      {canMessages && <LxmfList sourceId={sourceId} large={home} onNavigate={onNavigate} />}
    </div>
  );
}

/** The lists the device screen published (never fetched here). */
function useRnsLists(sourceId: string): RnsLists {
  const { data = NO_LISTS } = useQuery<RnsLists>({ queryKey: rnsKeys.lists(sourceId), queryFn: () => NO_LISTS, enabled: false });
  return data;
}

/** LXMF MESSAGES: one row per conversation, newest first (also the `dms` page). */
export function LxmfList({ sourceId, large, onNavigate }: { sourceId: string; large?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const settings = useSettingsOptional();
  const lists = useRnsLists(sourceId);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const time = (ms: number) => formatTimeOrDate(new Date(ms), settings?.timeFormat ?? '24', settings?.dateFormat ?? 'DD/MM/YYYY');
  return (
    <section className={mcStyles.section}>
      <div className={mcStyles.heading}>
        <h3 className={mcStyles.headingText}>{t('workspace.reticulum.lxmf_messages')}</h3>
      </div>
      {lists.conversations.length === 0 && <p className={mcStyles.empty}>{t('reticulum.dms.no_conversations', 'No conversations yet.')}</p>}
      <ul className={listStyles.list}>
        {lists.conversations.map((c) => {
          const name = peerName(c.peerHash, lists.destinations);
          return (
            <li key={c.peerHash}>
              <NavLink
                to={`${base}/dm/${encodeURIComponent(c.peerHash)}`}
                className={({ isActive }) => `${styles.convo} ${large ? styles.convoLarge : ''} ${isActive ? styles.convoOn : ''}`}
                title={c.peerHash}
                onClick={onNavigate}
              >
                <span className={styles.avatar} data-tone={peerTone(name)} data-anon={name.startsWith('<') || undefined} aria-hidden="true">{peerMark(name)}</span>
                <span className={styles.convoText}>
                  <span className={styles.convoTop}>
                    <span className={styles.convoName}>{name}</span>
                    <span className={styles.convoTime}>{time(c.lastMessage.timestamp)}</span>
                  </span>
                  <span className={styles.convoPreview}>{c.lastMessage.content ?? ''}</span>
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
