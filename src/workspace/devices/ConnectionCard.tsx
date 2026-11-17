/**
 * A device's Connection card (boards h5, i4; note ds6): the shared Sheet,
 * right-docked on desktop and a bottom sheet on the phone. Opened from the
 * device's status line (desktop sidebar, Server › Devices) and from the
 * offline banner.
 *
 * - The state is today's status word (`getStatusInfo`, as Server › Devices)
 *   and the status reply's `lastError` when it has one. Today's API keeps no
 *   connection history and no "since" time, so neither is drawn.
 * - The controls are today's, under today's gates, one request per press and
 *   no confirm (today asks none), with no retry loop of their own:
 *   - System status's Disconnect / Connect (App: `connection:write` on a
 *     Meshtastic node): `/api/connection/disconnect` while connected, and
 *     `/api/connection/reconnect` after a user disconnect, which the card
 *     reads once from `/api/connection` while it is open and offline.
 *   - The source card's Connect / Disconnect (DashboardSidebar, admins):
 *     `sourceControls`, through `connectSourceAndWait` (today's re-poll) and
 *     `/api/sources/:id/disconnect`. A MeshCore manager stays registered.
 *   - Edit connection (admins): Server › Devices' edit flow on this device.
 * Nothing here transmits on the mesh: a reconnect re-reads the node's config
 * over its own link, as today.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { getStatusInfo } from '../../components/Dashboard/sourceStatusInfo';
import { useAuth } from '../../contexts/AuthContext';
import api, { ApiError } from '../../services/api';
import { logger } from '../../utils/logger';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { endpointOf, sourceControls } from './deviceInfo';
import { connectSourceAndWait } from './useSourceForm';
import styles from './ConnectionCard.module.css';

interface ConnectionCardProps {
  source: WorkspaceSource;
  open: boolean;
  onClose(): void;
}

export default function ConnectionCard({ source, open, onClose }: ConnectionCardProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('workspace.connection.title')}>
      <CardBody source={source} onClose={onClose} />
    </Sheet>
  );
}

function CardBody({ source: s, onClose }: { source: WorkspaceSource; onClose(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { authStatus, hasPermission } = useAuth();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  const status = s.live;
  const connected = status?.connected === true;
  const { dotClass, label } = getStatusInfo(s, status, t);
  const lastError = !connected && typeof status?.lastError === 'string' && status.lastError ? status.lastError : null;
  const endpoint = endpointOf(s.type, s.config, (port) => t('workspace.devices.port', { port }));

  // App's System status control: this radio's own link (never an MQTT source, #5375).
  const link = s.type === 'meshtastic_tcp' && hasPermission('connection', 'write', { sourceId: s.id });
  const linkState = useQuery({
    queryKey: ['workspace', 'connection', s.id],
    queryFn: () => api.get<{ userDisconnected?: boolean }>(`/api/connection?sourceId=${encodeURIComponent(s.id)}`),
    enabled: link && !connected,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const linkConnect = link && !connected && linkState.data?.userDisconnected === true;
  const linkDisconnect = link && connected;
  const card = isAdmin ? sourceControls(s, status) : null;
  const showConnect = linkConnect || !!card?.canConnect;
  const showDisconnect = linkDisconnect || !!card?.canDisconnect;

  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const connectAbort = useRef<AbortController | null>(null);
  useEffect(() => () => connectAbort.current?.abort(), []);
  const refetchStatus = () => void queryClient.refetchQueries({ queryKey: ['dashboard', 'status', s.id], type: 'active' });

  const connect = async () => {
    setBusy('connect');
    try {
      if (linkConnect) {
        // App's handleReconnect.
        try {
          await api.reconnectToNode(s.id);
          showToast(t('toast.reconnecting_to_node'), 'info');
        } catch (error) {
          logger.error('Failed to reconnect:', error);
          showToast(t('toast.failed_reconnect'), 'error');
        }
        refetchStatus();
        void queryClient.invalidateQueries({ queryKey: ['workspace', 'connection', s.id] });
      } else {
        // Today's onConnectSource (Server › Devices' Connect).
        const ctl = new AbortController();
        connectAbort.current = ctl;
        await connectSourceAndWait(queryClient, s.id, ctl.signal);
      }
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      if (linkDisconnect) {
        // App's handleDisconnect.
        try {
          await api.disconnectFromNode(s.id);
          showToast(t('toast.disconnected_from_node'), 'info');
        } catch (error) {
          logger.error('Failed to disconnect:', error);
          showToast(t('toast.failed_disconnect'), 'error');
        }
      } else {
        // Today's onDisconnectSource.
        try {
          await api.post(`/api/sources/${s.id}/disconnect`);
        } catch (err) {
          if (!(err instanceof ApiError)) throw err;
        }
        void queryClient.invalidateQueries({ queryKey: ['dashboard', 'sources'] });
      }
      refetchStatus();
    } finally {
      setBusy(null);
    }
  };

  const connectLabel =
    busy === 'connect' && !linkConnect
      ? t('source.connecting')
      : linkConnect
        ? t('header.connect')
        : card?.gatewaysOnly
          ? t('source.retry_gateways')
          : t('source.connect');

  return (
    <div className={styles.card} data-phone={isPhone || undefined}>
      <div className={styles.device}>
        <span className={styles.square} style={{ background: s.colorToken }} aria-hidden="true">
          {s.abbrev}
        </span>
        <span className={styles.deviceText}>
          <span className={styles.name}>{s.name}</span>
          <span className={styles.sub}>{[t(`workspace.devices.type.${s.type}`, s.type), endpoint].filter(Boolean).join(' · ')}</span>
        </span>
      </div>
      <div className={styles.state} data-tone={dotClass}>
        <UiIcon name={connected ? 'check' : 'alert'} size={18} />
        <div className={styles.stateText}>
          <p className={styles.word}>{label}</p>
          {lastError && <p className={styles.detail}>{t('workspace.connection.last_error', { error: lastError })}</p>}
          {card?.canConnect && !card.gatewaysOnly && label === t('source.status_idle') && (
            <p className={styles.detail}>{t('source.connect_help')}</p>
          )}
        </div>
      </div>
      {(showConnect || showDisconnect || isAdmin) && (
        <div className={styles.actions}>
          {showConnect && (
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              disabled={busy !== null}
              title={linkConnect ? t('header.connectTitle') : undefined}
              onClick={() => void connect()}
            >
              <UiIcon name="refresh" size={16} />
              {connectLabel}
            </button>
          )}
          {isAdmin && (
            <Link className={styles.button} to={`/server/devices?edit=${encodeURIComponent(s.id)}`} onClick={onClose}>
              {t('workspace.connection.edit')}
            </Link>
          )}
          {showDisconnect && (
            <button
              type="button"
              className={styles.button}
              disabled={busy !== null}
              title={linkDisconnect ? t('header.disconnectTitle') : undefined}
              onClick={() => void disconnect()}
            >
              {t('header.disconnect')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
