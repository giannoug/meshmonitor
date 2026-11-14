/**
 * Message details (boards 10-02, 10-10): today's Delivery / Message Details
 * content (`MessageDetailsBody`) with the message quoted. A side panel beside
 * the conversation on desktop, a Sheet on the phone. It reads the stored
 * timeline and heard-by rows; nothing is sent on the mesh.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { MessageDetailsBody } from '../../components/diagnostics/MessageDetailsModal';
import { toRelayCandidateNodes } from '../../components/diagnostics/relayCandidateNodes';
import type { DateFormat, TimeFormat } from '../../contexts/SettingsContext';
import apiService from '../../services/api';
import type { DeviceInfo } from '../../types/device';
import type { MeshMessage } from '../../types/message';
import { formatMessageTime } from '../../utils/datetime';
import type { MessageDirection } from '../../utils/deliveryDiagnostics/types';
import Sheet from '../patterns/Sheet';
import styles from './MessageDetailsPanel.module.css';

export interface MessageDetailsPanelProps {
  message: MeshMessage;
  direction: MessageDirection;
  sourceId: string;
  nodes: DeviceInfo[];
  phone: boolean;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  onNodeClick(nodeId: string): void;
  onClose(): void;
}

export default function MessageDetailsPanel(props: MessageDetailsPanelProps) {
  const { message, direction, sourceId, phone, onClose } = props;
  const { t } = useTranslation();
  const asideRef = useRef<HTMLElement>(null);
  const title = direction === 'sent' ? t('delivery_details.title') : t('delivery_details.title_received');
  const subtitle = [
    formatMessageTime(new Date(message.timestamp), props.timeFormat, props.dateFormat),
    t('delivery_details.protocol.meshtastic'),
  ].join(' · ');

  // As Classic: the relay candidates rank by direct-neighbour RSSI when the packet names a relay byte.
  const wantStats = direction === 'received' && message.relayNode !== undefined && message.relayNode !== null;
  const { data: stats } = useQuery({
    queryKey: ['directNeighborStats', 24],
    queryFn: () => apiService.getDirectNeighborStats(24),
    enabled: wantStats,
    staleTime: 60_000,
  });
  const candidates = toRelayCandidateNodes(props.nodes, stats);

  useEffect(() => {
    asideRef.current?.focus();
  }, [message.id]);

  const content = (
    <div className={styles.content}>
      <p className={styles.subtitle}>{subtitle}</p>
      {message.text && <p className={styles.quote}>{message.text}</p>}
      <MessageDetailsBody
        protocol="meshtastic"
        direction={direction}
        sourceId={sourceId}
        message={message}
        nodes={candidates}
        onNodeClick={props.onNodeClick}
      />
    </div>
  );

  if (phone) {
    return (
      <Sheet open side="bottom" onClose={onClose} title={title}>
        {content}
      </Sheet>
    );
  }
  return (
    <aside
      ref={asideRef}
      className={styles.panel}
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
          <UiIcon name="close" size={20} />
        </button>
      </div>
      {content}
    </aside>
  );
}
