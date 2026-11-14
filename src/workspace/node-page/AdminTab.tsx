/**
 * The node page's Admin tab (boards 15-03, 15-16; ds4), for anyone who can
 * read the node (Ruling BE). Today's parts from the DM's node details, each
 * with Classic's own gate (MessagesTab's NodeDetailsBlock wiring): the renumbering notice and Merge history…
 * (NodeIdentityChangeNotice), the key warnings with Clear (DmBanners, today's
 * KeyMismatchWarning) and the security-issue details, Notes (nodes:write;
 * saved in MeshMonitor), Asset tracking (settings:write), Remote admin (its
 * link into today's Admin Commands for an admin only, RemoteAdminLink's
 * `canOpenRemoteAdmin`), Share contact, and the
 * key, PKI, channel (editable with nodes:write), Store & Forward and
 * first-heard facts. Nothing here sends on the mesh.
 */
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import AssetTrackingSection from '../../components/AssetTrackingSection';
import { UiIcon } from '../../components/icons';
import { MeshtasticContactShare } from '../../components/MeshtasticContactShare';
import NodeChannelEditor from '../../components/NodeChannelEditor';
import { NodeIdentityChangeNotice } from '../../components/NodeIdentityChangeNotice';
import NodeNameHistory from '../../components/NodeNameHistory';
import PkiExchangeStatusCard from '../../components/PkiExchangeStatusCard';
import { RemoteAdminLink } from '../../components/RemoteAdminLink';
import { useToast } from '../../components/ToastContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useSettings } from '../../contexts/SettingsContext';
import { MAX_NODE_NOTES_LENGTH, useNodeNotesDraft } from '../../hooks/useNodeNotesDraft';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import { useChannels, useNodes } from '../../hooks/useServerData';
import apiService from '../../services/api';
import type { DeviceInfo } from '../../types/device';
import type { MeshMessage } from '../../types/message';
import { formatRelativeTime } from '../../utils/datetime';
import DmBanners from '../chat/DmBanners';
import { nodeIdOf, nodeNameOf } from '../nodes/nodeColumns';
import SendsLine from '../patterns/SendsLine';
import MergeIdentitySheet from './dialogs/MergeIdentitySheet';
import { useIsPhone } from '../shell/useIsPhone';
import { Fact, Facts } from './Facts';
import styles from './AdminTab.module.css';

export interface AdminTabProps {
  sourceId: string;
  node: DeviceInfo;
  /** The source's messages, for the key-mismatch severity (ours sent to this node). */
  messages: MeshMessage[];
}

export default function AdminTab({ sourceId, node, messages }: AdminTabProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const notesId = useId();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission, authStatus } = useAuth();
  const { currentNodeId } = useData();
  const { nodes } = useNodes();
  const { channels } = useChannels();
  const { timeFormat, dateFormat } = useSettings();
  const nodeId = nodeIdOf(node);
  const name = nodeNameOf(node);
  const scope = { sourceId };
  const canWriteNodes = hasPermission('nodes', 'write', scope);
  // MessagesTab's NodeDetailsBlock wiring: the same requests and toasts.
  const notes = useNodeNotesDraft(node, canWriteNodes ? async (text) => {
    await apiService.setNodeNotes(nodeId, text, sourceId);
    showToast(t('node_details.notes_saved', 'Notes saved'), 'success');
  } : undefined);
  const saveChannel = async (channel: number | null, locked: boolean) => {
    await apiService.setNodeChannel(nodeId, channel, locked, sourceId);
    await queryClient.invalidateQueries({ queryKey: sourcePollQueryKey(sourceId) });
    showToast(t('node_details.channel_saved', 'Channel saved'), 'success');
  };
  const sentToNode = messages.filter((m) => m.to === nodeId && m.channel === -1 && (m.from === currentNodeId || m.isLocalMessage === true)).length;
  const sharedWith = node.duplicateKeyDetected
    ? (node.keySecurityIssueDetails?.match(/nodes?: ([\d, ]+)/)?.[1].split(',').map((s) => parseInt(s.trim(), 10)) ?? [])
    : [];
  const checked = node.lastRemoteAdminCheck != null ? formatRelativeTime(node.lastRemoteAdminCheck, timeFormat, dateFormat, false) : null;
  const remoteState = checked == null
    ? t('node_details.remote_admin_unknown')
    : node.hasRemoteAdmin ? t('node_details.remote_admin_yes') : t('node_details.remote_admin_no');
  const channel = node.channel != null ? channels.find((c) => c.id === node.channel) : undefined;
  const key = node.user?.publicKey;

  return (
    <div className={styles.admin} data-phone={isPhone || undefined}>
      <div className={styles.column}>
        <NodeIdentityChangeNotice nodeNum={node.nodeNum} sourceId={sourceId} mergeDialog={MergeIdentitySheet} />
        <DmBanners sourceId={sourceId} node={node} sentDirectMessageCount={sentToNode} onMessageAnyway={null} showDeviceDb={false} />
        {(node.keyIsLowEntropy || sharedWith.length > 0) && (
          <div className={styles.issue} role="note">
            <UiIcon name="alert" size={18} />
            <p>
              {node.keyIsLowEntropy && t('messages.low_entropy_warning')}
              {sharedWith.length > 0 && t('messages.shared_key_with')}
              {sharedWith.map((num, i) => {
                const peer = nodes.find((n) => n.nodeNum === num);
                const label = peer ? nodeNameOf(peer) : t('messages.node_fallback', { nodeNum: num });
                return (
                  <span key={num}>
                    {i > 0 && ', '}
                    {peer?.user?.id ? <Link to={`/source/${encodeURIComponent(sourceId)}/node/${encodeURIComponent(peer.user.id)}`}>{label}</Link> : label}
                  </span>
                );
              })}
            </p>
          </div>
        )}
        <section className={styles.card} aria-labelledby={notesId}>
          <div className={styles.cardHead}>
            <h2 id={notesId} className={styles.title}>{t('node_details.notes', 'Notes')}</h2>
            {notes.notesError && <span className={styles.error} role="alert">{notes.notesError}</span>}
          </div>
          {canWriteNodes ? (
            <>
              <textarea
                className={styles.notes}
                aria-labelledby={notesId}
                value={notes.notesDraft}
                maxLength={MAX_NODE_NOTES_LENGTH}
                rows={3}
                placeholder={t('node_details.notes_placeholder', 'Add a private note about this node…')}
                onChange={(e) => notes.setNotesDraft(e.target.value)}
                disabled={notes.notesSaving}
              />
              <div className={styles.cardFoot}>
                <SendsLine>{t('workspace.node.notes_sends')}</SendsLine>
                <button type="button" className={styles.primary} onClick={() => void notes.handleSaveNotes()} disabled={notes.notesSaving || !notes.notesDirty}>
                  {notes.notesSaving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.readOnly}>{notes.storedNotes || '—'}</p>
          )}
        </section>
        <div className={styles.classic}>
          <AssetTrackingSection nodeNum={node.nodeNum} asset={node.asset} canEdit={hasPermission('settings', 'write', { anySource: true })} />
        </div>
      </div>
      <div className={styles.column}>
        <RemoteAdminLink
          nodeId={node.user?.id ?? ''}
          nodeName={name}
          sourceId={sourceId}
          // App's Admin Commands gate, as NodeDetailsBlock's `canOpenRemoteAdmin` (only for an available node).
          enabled={authStatus?.user?.isAdmin === true && node.hasRemoteAdmin === true && !!node.user?.id}
        >
          <div className={styles.remote}>
            <span className={styles.text}>
              <span className={styles.title}>{t('node_details.remote_admin')}</span>
              <span className={styles.sub}>
                <span data-state={node.hasRemoteAdmin ? 'yes' : undefined} className={styles.state}>{remoteState}</span>
                {checked && ` · ${checked}`}
              </span>
            </span>
            {authStatus?.user?.isAdmin === true && node.hasRemoteAdmin && <UiIcon name="chevronRight" size={18} />}
          </div>
        </RemoteAdminLink>
        {node.user && node.nodeNum > 0 && node.nodeNum < 0xffffffff && (
          <div className={styles.classic}>
            <MeshtasticContactShare nodeNum={node.nodeNum} sourceId={sourceId} nodeName={name} />
          </div>
        )}
        <Facts>
          {key && (
            <Fact label={t('node_details.public_key')}>
              <span className={styles.key} title={key}>{key}</span>
            </Fact>
          )}
          {node.isStoreForwardServer && (
            <Fact label={t('node_details.store_forward', 'Store & Forward')}>{t('node_details.store_forward_server', 'S&F Server')}</Fact>
          )}
          {typeof node.firstHeard === 'number' && (
            <Fact label={t('node_details.first_heard', 'First Heard')}>{formatRelativeTime(node.firstHeard * 1000, timeFormat, dateFormat, false)}</Fact>
          )}
        </Facts>
        <div className={styles.classic}>
          {key && <PkiExchangeStatusCard sourceId={sourceId} nodeNum={node.nodeNum} timeFormat={timeFormat} dateFormat={dateFormat} />}
          {canWriteNodes ? (
            <NodeChannelEditor channel={node.channel} locked={node.channelLocked === true} channels={channels} onSave={saveChannel} />
          ) : (
            node.channel != null && (
              <Facts>
                <Fact label={t('node_details.channel')}>{channel?.name ? `${node.channel} (${channel.name})` : String(node.channel)}</Fact>
              </Facts>
            )
          )}
          <NodeNameHistory
            nodeId={node.user?.id ?? String(node.nodeNum)}
            currentName={`${node.user?.longName ?? ''}\u0000${node.user?.shortName ?? ''}`}
            timeFormat={timeFormat}
            dateFormat={dateFormat}
          />
        </div>
      </div>
    </div>
  );
}
