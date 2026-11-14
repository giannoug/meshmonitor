/**
 * The phone device Home (boards c-home-e1-home, a-chat-D-phone): `/source/:id`
 * on a Meshtastic-family device below 768 px. Under the shell's device header:
 * the "Jump to…" pill (opens message search, note s10n5), the Map / Nodes /
 * Automation / Tools tiles (the shell's destinations, today's pages where the
 * Workspace has none yet), the device's channels with unread, and its most
 * recent DMs with "All direct messages".
 *
 * One owner per screen (Ruling AD): App is not mounted here. The screen runs
 * the source's poll itself (the same request App would run), and the lists
 * read it and the shell's unread counts. Nothing here sends.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../components/icons';
import { mapNav } from '../../components/nav/sourceNavEntries';
import type { DashboardSource } from '../../hooks/useDashboardData';
import { useDeviceTab } from '../shell/deviceTabs';
import { useShellDevices } from '../shell/shellDevices';
import ChannelList from './ChannelList';
import ChatProviders from './ChatProviders';
import DmList from './DmList';
import { useChatRuntime } from './useChatRuntime';
import threadStyles from './ChannelThread.module.css';
import styles from './PhoneHome.module.css';

/** How many recent conversations Home lists (cs2: "Home lists the most recent DMs"). */
const RECENT_DMS = 5;

export interface PhoneHomeRouteProps {
  sourceId: string;
  source: DashboardSource;
}

export default function PhoneHomeRoute({ sourceId, source }: PhoneHomeRouteProps) {
  return (
    <ChatProviders sourceId={sourceId} source={source} classicTab="messages">
      <PhoneHome sourceId={sourceId} sourceType={source.type} />
    </ChatProviders>
  );
}

function PhoneHome({ sourceId, sourceType }: { sourceId: string; sourceType: string }) {
  const { t } = useTranslation();
  useChatRuntime(-1);
  const { sources, openSearch } = useShellDevices();
  const device = sources.find((s) => s.id === sourceId);
  const tab = useDeviceTab(device);
  const active = device?.live?.activeNodeCount;

  const tiles: Array<{ key: string; icon: UiIconName; label: string }> = [
    { key: 'map', icon: 'map', label: mapNav(t).label },
    { key: 'nodes', icon: 'radioSignal', label: active !== undefined ? `${t('nodes.title')} · ${active}` : t('nodes.title') },
    { key: 'automation', icon: 'zap', label: t('nav.automation') },
    { key: 'tools', icon: 'more', label: t('workspace.home.tools') },
  ];
  const channels = tab('channels');
  const dms = tab('dms');

  return (
    <div className={threadStyles.page} data-phone="">
      <div className={styles.top}>
        {openSearch && (
          <button type="button" className={styles.pill} onClick={openSearch}>
            <UiIcon name="search" size={18} />
            <span>{t('workspace.home.jump_to')}</span>
            <span className={threadStyles.srOnly}>{t('search.title')}</span>
          </button>
        )}
        <nav className={styles.tiles} aria-label={t('workspace.home.tools_label')}>
          {tiles.flatMap(({ key, icon, label }) => {
            // shortcut: the phone map is Task 3.2; until then Map opens today's Nodes tab, as before.
            const to = tab(key === 'map' ? 'nodes' : key);
            return to
              ? [
                  <Link key={key} to={to} className={styles.tile}>
                    <UiIcon name={icon} size={22} />
                    <span className={styles.tileLabel}>{label}</span>
                  </Link>,
                ]
              : [];
          })}
        </nav>
      </div>
      <div className={styles.lists}>
        {channels && (
          <section>
            <h2 className={styles.section}>{t('channels.title')}</h2>
            <ChannelList sourceId={sourceId} sourceType={sourceType} large />
          </section>
        )}
        {dms && (
          <section>
            <h2 className={styles.section}>{t('workspace.shell.direct_messages')}</h2>
            <DmList sourceId={sourceId} large limit={RECENT_DMS} />
            <Link to={dms} className={styles.all}>
              {t('workspace.home.all_dms')}
              <UiIcon name="chevronRight" size={18} />
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
