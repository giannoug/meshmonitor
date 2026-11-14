/**
 * The node page's Links tab (boards 15-04, 15-17, g5-links): the last route
 * from this device (today's traceroute strip, with its copy links; Ruling
 * 3.2 put it here), today's traceroute history (TracerouteHistoryModal's
 * content: Show failed traceroutes, forward and return with SNR and
 * distance) and the node's own neighbour report. A traceroute is sent only
 * from Ask the node › Traceroute, with its Sends line; this tab reads.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TracerouteHistoryList } from '../../components/TracerouteHistoryModal';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNodes } from '../../hooks/useServerData';
import type { DeviceInfo } from '../../types/device';
import { parseNodeId } from '../../utils/nodeHelpers';
import TracerouteStripD from '../chat/TracerouteStripD';
import { nodeNameOf } from '../nodes/nodeColumns';
import { useIsPhone } from '../shell/useIsPhone';
import Neighbours from './Neighbours';
import styles from './LinksTab.module.css';

export default function LinksTab({ sourceId, node }: { sourceId: string; node: DeviceInfo }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { currentNodeId } = useData();
  const { nodes } = useNodes();
  const localNodeNum = currentNodeId ? parseNodeId(currentNodeId) : null;
  const local = nodes.find((n) => n.user?.id === currentNodeId);
  const localName = local ? nodeNameOf(local) : currentNodeId ?? '';
  const name = nodeNameOf(node);
  // The strip's gate (today's History button sits behind it).
  const canRead = hasPermission('traceroute', 'read', { sourceId }) || hasPermission('traceroute', 'write', { sourceId });
  const openNode = (id: string) => void navigate(`/source/${encodeURIComponent(sourceId)}/node/${encodeURIComponent(id)}`);

  return (
    <div className={styles.links} data-phone={isPhone || undefined}>
      <div className={styles.main}>
        <TracerouteStripD
          sourceId={sourceId}
          localNodeNum={localNodeNum}
          nodeNum={node.nodeNum}
          localName={localName}
          nodeName={name}
          nodes={nodes}
          onOpenNode={openNode}
          showHistory={false}
        />
        {canRead && localNodeNum != null && localNodeNum !== node.nodeNum && (
          <section className={styles.card} aria-label={t('traceroute_history.title')}>
            <h2 className={styles.title}>{t('traceroute_history.title')}</h2>
            <TracerouteHistoryList
              fromNodeNum={localNodeNum}
              toNodeNum={node.nodeNum}
              fromNodeName={localName}
              toNodeName={name}
              nodes={nodes}
              sourceId={sourceId}
            />
          </section>
        )}
      </div>
      <Neighbours sourceId={sourceId} node={node} />
    </div>
  );
}
