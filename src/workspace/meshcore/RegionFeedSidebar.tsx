/**
 * A region feed's sidebar (board 8-15, Task 7.5): Region feed, the decrypted
 * channels with their message counts (from the feed's one messages read,
 * shared with its page) and the receive-only note. Nothing here sends.
 */
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon } from '../../components/icons';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { feedChannels, useFeedMessages } from './useRegionFeed';
import listStyles from '../chat/ChannelList.module.css';
import tools from './McTools.module.css';
import styles from './MeshCoreSidebar.module.css';

export default function RegionFeedSidebar({ source, onNavigate }: { source: WorkspaceSource; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const base = `/source/${encodeURIComponent(source.id)}`;
  const canRead = hasPermission('connection', 'read', { sourceId: source.id });
  const { data: messages = [] } = useFeedMessages(source.id, canRead);
  const channels = feedChannels(messages).filter((c) => c.name !== null);
  return (
    <div className={styles.lists}>
      <ul className={styles.tools}>
        <li>
          <NavLink to={base} end className={styles.toolRow} onClick={onNavigate}>
            <UiIcon name="dashboard" size={16} />
            <span className={styles.label}>{t('workspace.meshcore.region_feed')}</span>
          </NavLink>
        </li>
      </ul>
      {channels.length > 0 && (
        <section className={styles.section}>
          <div className={styles.heading}>
            <h3 className={styles.headingText}>{t('workspace.meshcore.decrypted_channels')}</h3>
          </div>
          <ul className={listStyles.list}>
            {channels.map((c) => (
              <li key={c.name}>
                <NavLink to={`${base}/channels`} className={({ isActive }) => `${listStyles.row} ${isActive ? listStyles.on : ''}`} onClick={onNavigate}>
                  <span className={listStyles.hash} aria-hidden="true">#</span>
                  <span className={listStyles.name}>{c.name!.replace(/^#/, '')}</span>
                  <span className={styles.count}>{c.count}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={`${tools.note} ${tools.sideNote}`}>
        <UiIcon name="globe" size={14} />
        <span>{t('workspace.meshcore.feed_sidebar_note')}</span>
      </p>
    </div>
  );
}
