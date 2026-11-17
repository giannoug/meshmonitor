/**
 * A room server in layout D (boards 8-03, 8-04, 8-17, 8-18): `/source/:id/room/:key`.
 * The header names the room ("Room Server") and its state: not logged in
 * (password saved or not) or logged in with its post count and last post,
 * with Mute and Log out. Below: the login card and Auto-sync while not
 * logged in (with any saved posts read-only under them, as today), the posts
 * and the composer once logged in.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { MuteMenu } from '../../components/notifications/MuteMenu';
import { useAuth } from '../../contexts/AuthContext';
import { useOptionalMuteSettings, useSettings } from '../../contexts/SettingsContext';
import { formatMessageTime } from '../../utils/datetime';
import OfflineBanner from '../devices/OfflineBanner';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import MeshCoreErrorBar from './MeshCoreErrorBar';
import { useMeshCoreRuntime } from './runtime';
import RoomLogin, { AutoSyncCard } from './RoomLogin';
import RoomPosts from './RoomPosts';
import { shortMark } from './meshcoreLabels';
import { mcKeys } from './useMeshCoreLists';
import { useMeshCoreRoom } from './useMeshCoreRoom';
import threadStyles from '../chat/ChannelThread.module.css';
import styles from './Room.module.css';

export default function MeshCoreRoom({ roomKey }: { roomKey: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const { authStatus } = useAuth();
  const { sourceId } = useMeshCoreRuntime();
  const { timeFormat, dateFormat } = useSettings();
  const mute = useOptionalMuteSettings();
  const room = useMeshCoreRoom(roomKey);
  const name = room.room?.advName || room.room?.name || `${roomKey.slice(0, 12)}…`;
  const key = `${roomKey.slice(0, 4)}…${roomKey.slice(-4)}`;
  const base = `/source/${encodeURIComponent(sourceId)}`;

  const state = room.loggedIn
    ? [
        t('meshcore.rooms.logged_in', 'Logged in'),
        t('workspace.meshcore.posts', { count: room.postCount }),
        room.lastPost
          ? t('workspace.meshcore.last_post', {
              time: formatMessageTime(new Date(room.lastPost), timeFormat, dateFormat),
            })
          : null,
      ]
    : [t('meshcore.rooms.not_logged_in', 'Not logged in'), room.saved ? t('workspace.meshcore.password_saved') : null];
  const refreshMutes = () => void queryClient.invalidateQueries({ queryKey: mcKeys.mutes(sourceId) });
  const [syncOpen, setSyncOpen] = useState(false);
  const tools = room.loggedIn && (
    <span className={styles.toolsCol}>
      <span className={styles.tools}>
        {room.canConfig && (
          <button
            type="button"
            className={threadStyles.button}
            onClick={() => setSyncOpen(true)}
            aria-haspopup="dialog"
          >
            <UiIcon name={room.sync.failure ? 'alert' : 'refresh'} size={16} />{' '}
            {t('meshcore.rooms.auto_sync', 'Auto-sync')}
          </button>
        )}
        {authStatus?.authenticated === true && mute && (
          <MuteMenu
            muted={mute.isDMMuted(roomKey)}
            onMute={async until => {
              await mute.muteDM(roomKey, until);
              refreshMutes();
            }}
            onUnmute={async () => {
              await mute.unmuteDM(roomKey);
              refreshMutes();
            }}
            buttonClassName={threadStyles.button}
            alignRight
          />
        )}
        <button
          type="button"
          className={`${threadStyles.button} ${styles.plain}`}
          onClick={room.logout}
          title={t('workspace.meshcore.log_out_title')}
        >
          <UiIcon name="enterKey" size={16} /> {t('workspace.meshcore.log_out')}
        </button>
      </span>
      {/* The board's "Log out" forgets this browser's login only; say so where it is (M4). */}
      <span className={styles.toolsHint}>{t('workspace.meshcore.log_out_hint')}</span>
    </span>
  );

  return (
    <section className={threadStyles.page} data-phone={isPhone || undefined}>
      <header className={threadStyles.header}>
        {isPhone ? (
          <Link className={threadStyles.icon} to={base}>
            <UiIcon name="back" size={22} />
            <span className={threadStyles.srOnly}>{t('common.back')}</span>
          </Link>
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {shortMark(name)}
          </span>
        )}
        <div className={threadStyles.titles}>
          <h1 className={styles.title}>
            <span className={styles.name}>{name}</span>
            <span className={styles.tag}>{t('meshcore.device_type.room_server', 'Room Server')}</span>
          </h1>
          <p className={styles.status}>
            <span
              className={styles.dot}
              data-room={room.loggedIn ? 'on' : room.saved ? 'saved' : 'off'}
              aria-hidden="true"
            />
            {[...state.filter(Boolean), isPhone && room.loggedIn ? null : key].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!isPhone && tools}
      </header>
      {isPhone && tools && <div className={styles.subRow}>{tools}</div>}
      <OfflineBanner sourceId={sourceId} />
      <MeshCoreErrorBar />
      {/* Today's logged-in header holds Auto-sync for configuration:write; here it is one tap away, in a sheet. */}
      <Sheet
        open={syncOpen && room.loggedIn}
        onClose={() => setSyncOpen(false)}
        title={t('meshcore.rooms.auto_sync', 'Auto-sync')}
      >
        <div className={styles.sheetPad}>
          <AutoSyncCard room={room} name={name} heading={false} />
        </div>
      </Sheet>
      {room.loggedIn ? (
        <RoomPosts room={room} name={name} roomKey={roomKey} />
      ) : (
        <div className={styles.scroll}>
          <RoomLogin room={room} name={name} />
          {room.posts.length > 0 && (
            <div className={styles.saved}>
              <RoomPosts room={room} name={name} roomKey={roomKey} readOnly />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
