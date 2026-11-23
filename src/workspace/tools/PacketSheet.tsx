/**
 * One packet in the device monitor (boards o1-packets' side panel, q3-packet's
 * sheet; one sheet at a time, D9c): the shared raw packet panel (PacketDetailPanel:
 * a side panel on desktop, a bottom sheet on the phone; Escape closes the top
 * layer only, CR) with two actions at its foot: Copy JSON (today's full
 * packet JSON to the clipboard) and Show sender (the sender's node page).
 * Neither sends anything.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import type { PacketLog } from '../../types/packet';
import PacketDetailPanel from '../overview/PacketDetailPanel';
import { useIsPhone } from '../shell/useIsPhone';
import { fullJson } from '../overview/packetRows';
import mc from '../meshcore/McTools.module.css';
import styles from './Tools.module.css';

export default function PacketSheet({ packet, sourceId, onClose }: { packet: PacketLog; sourceId: string; onClose(): void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  // The sheet portals to <body>, outside the page's phone scope: its buttons size themselves.
  const isPhone = useIsPhone();
  const sender = packet.from_node_id && packet.from_node_id !== '!ffffffff' ? packet.from_node_id : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullJson(packet));
      showToast(t('common.copied_to_clipboard'), 'success');
    } catch {
      showToast(t('workspace.tools.copy_failed'), 'error');
    }
  };
  const actions = (
    <div className={styles.panelActions} data-phone={isPhone ? '' : undefined}>
      <button type="button" className={mc.button} onClick={() => void copy()}>
        {t('workspace.meshcore.copy_json')}
      </button>
      <button
        type="button"
        className={`${mc.button} ${mc.primary}`}
        disabled={!sender}
        onClick={() => sender && void navigate(`/source/${encodeURIComponent(sourceId)}/node/${encodeURIComponent(sender)}`)}
      >
        {t('workspace.meshcore.show_sender')}
      </button>
    </div>
  );
  return <PacketDetailPanel packet={packet} onClose={onClose} actions={actions} />;
}
