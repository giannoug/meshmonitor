/**
 * MeshCoreMessageRouteModal — shown when the relay-hash chain on a received
 * MeshCore message is clicked. Presents the message's reception details and
 * expands each relay hash to the matching repeater / room-server name from
 * the contact list (mirroring the {ROUTE_NAMES} automation token): only
 * relay infrastructure ever appears in a path, unknown hashes stay raw, and
 * hash collisions resolve to the candidate nearest the neighbouring hops.
 * When every hop resolves to a positioned contact, a small map traces the
 * packet's geospatial flow (sender → relays → local node, where known) with
 * numbered, labeled hop markers. Reuses the packet-monitor modal styling
 * (mcpm-*).
 *
 * #5909: a hop no own contact matches may be named from another MeshCore
 * source the viewer can read (opt-in global setting; the server decides what
 * is returned). Those names read "Name (via Source)". When several nodes share
 * the hash, the nearest is shown as a guess with "?" and the full list sits in
 * an expandable list; a guess never carries a position onto the flow map.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshCoreMessage } from './hooks/useMeshCore';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';
import { parsePathHops } from '../../utils/meshcorePath';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { RouteFlowMap, type RouteFlowPoint } from '../map/RouteFlowMap';
import { darkOverlayColors } from '../../config/overlayColors';
import { useResolvedRouteHops, routeFlowPoints } from './useResolvedRouteHops';
import { RouteHopRows } from './MeshCoreRouteHops';
import './MeshCorePacketMonitor.css';
import { meshcoreDisplayTimeMs } from '../../utils/meshcoreMessageTime';

interface Props {
  message: MeshCoreMessage;
  /** Sender label already resolved by the stream (name or key prefix). */
  fromLabel: string;
  contacts: MeshCoreContact[];
  /**
   * The source the message arrived on. With it, hops no contact matches are
   * looked up on other sources (#5909) when the server-side toggle is on.
   */
  sourceId?: string;
  onClose: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode; mono?: boolean; wrap?: boolean }> = ({ label, children, mono, wrap }) => (
  <div className="mcpm-dl-row">
    <span className="mcpm-dl-label">{label}</span>
    <span className={`mcpm-dl-value${mono ? ' mcpm-mono' : ''}${wrap ? ' mcpm-dl-wrap' : ''}`}>{children}</span>
  </div>
);

const MeshCoreMessageRouteModal: React.FC<Props> = ({ message, fromLabel, contacts, sourceId, onClose }) => {
  const { t } = useTranslation();
  const { contentRef, onKeyDown } = useDialogA11y(onClose);

  const hops = useMemo(() => parsePathHops(message.routePath), [message.routePath]);
  const { rows, width } = useResolvedRouteHops(hops, sourceId, contacts);

  // The flow line (sender → relays → local node); see routeFlowPoints.
  const flowPoints = useMemo(
    (): RouteFlowPoint[] | null => routeFlowPoints(rows, contacts, message.fromPublicKey, fromLabel, t('meshcore.route_detail_you', 'You')),
    [rows, contacts, message.fromPublicKey, fromLabel, t],
  );

  const scopeStr = message.scopeName
    ? message.scopeName
    : typeof message.scopeCode === 'number' && message.scopeCode !== 0
      ? `#${message.scopeCode.toString(16).padStart(4, '0')}`
      : '—';

  return (
    <div className="mcpm-modal" onClick={onClose} role="presentation">
      <div
        className="mcpm-modal-content"
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mc-route-detail-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mcpm-modal-header">
          <h4 id="mc-route-detail-title">{t('meshcore.route_detail_title', 'Message Route')}</h4>
          <button className="mcpm-modal-close" onClick={onClose} aria-label={t('common.close', 'Close')}>×</button>
        </div>

        <div className="mcpm-modal-body">
          <section className="mcpm-dl-section">
            <h5>{t('meshcore.route_detail_message', 'Message')}</h5>
            <Row label={t('meshcore.route_detail_from', 'From')}>{fromLabel}</Row>
            <Row label={t('meshcore.route_detail_time', 'Time')} mono>{new Date(meshcoreDisplayTimeMs(message)).toLocaleString()}</Row>
            <Row label={t('meshcore.route_detail_hops', 'Hops')} mono>{typeof message.hopCount === 'number' ? message.hopCount : '—'}</Row>
            <Row label={t('meshcore.route_detail_scope', 'Scope')}>{scopeStr}</Row>
            {message.text && (
              <Row label={t('meshcore.route_detail_text', 'Text')} wrap>{message.text}</Row>
            )}
          </section>

          <section className="mcpm-dl-section">
            <h5>{t('meshcore.route_detail_route', 'Route')}</h5>
            <Row label={t('meshcore.packets.hashWidth', 'Hash width')} mono>{width} B</Row>
            <RouteHopRows rows={rows} />
          </section>

          {flowPoints && flowPoints.length > 0 && (
            <section className="mcpm-dl-section">
              <h5>{t('meshcore.route_detail_flow', 'Packet flow')}</h5>
              <RouteFlowMap points={flowPoints} snrColors={darkOverlayColors.snrColors} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeshCoreMessageRouteModal;
