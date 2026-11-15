/**
 * The per-gateway receptions of one grouped MQTT packet (#4114), fetched on
 * demand: shared by MqttPacketDetailModal and the Workspace's MQTT receptions
 * page (#6365).
 */
import { useEffect, useState } from 'react';
import type { useCsrfFetch } from '../../hooks/useCsrfFetch';
import type { MqttGroupedPacket, MqttReception } from './mqttPacketTypes';

export function useMqttReceptions(
  packet: MqttGroupedPacket,
  prefix: string,
  csrfFetch: ReturnType<typeof useCsrfFetch>,
) {
  const [receptions, setReceptions] = useState<MqttReception[]>([]);
  const [loadingReceptions, setLoadingReceptions] = useState(false);
  const [receptionsError, setReceptionsError] = useState<string | null>(null);

  // The receptions route parses packetId/fromNode as ints and queries
  // WHERE packetId = ?. A 0/null packetId would over-match every id-less
  // packet from that node, so we deliberately skip the fetch in that case.
  const canFetch = typeof packet.packetId === 'number' && packet.packetId !== 0
    && typeof packet.fromNode === 'number';

  useEffect(() => {
    if (!canFetch) return;
    let cancelled = false;
    setLoadingReceptions(true);
    setReceptionsError(null);
    void (async () => {
      try {
        const params = new URLSearchParams();
        params.set('packetId', String(packet.packetId));
        params.set('fromNode', String(packet.fromNode));
        const res = await csrfFetch(`${prefix}/receptions?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const payload = body.data ?? body;
        if (!cancelled) {
          setReceptions(Array.isArray(payload.receptions) ? payload.receptions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setReceptionsError(err instanceof Error ? err.message : 'Failed to load receptions');
        }
      } finally {
        if (!cancelled) setLoadingReceptions(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canFetch, packet.packetId, packet.fromNode, csrfFetch, prefix]);

  return { canFetch, receptions, loadingReceptions, receptionsError };
}
