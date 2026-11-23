/**
 * The live-trace transport for one rule (moved verbatim out of LiveTracePanel,
 * #6365 Rule X): while mounted it arms the trace over the shared Socket.io
 * connection, keeps the newest entries in a capped buffer, and counts down the
 * server's 5-minute session. Shared by Classic's LiveTracePanel and the
 * Workspace's Live trace tab, so both use the same subscription.
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import type { TraceStep } from './outcomeMeta';

export const TRACE_DURATION_MS = 5 * 60_000;
const MAX_ENTRIES = 200;

export interface TraceEntry {
  ts: number;
  automationId: string;
  triggerType: string;
  sourceId: string | null;
  event: Record<string, unknown>;
  outcome: 'fired' | 'prefiltered' | 'cooldown' | 'ratelimited';
  reason?: string;
  status?: 'completed' | 'failed';
  conditionResults?: Record<string, boolean>;
  actions?: Array<{ nodeId: string; ok: boolean; error?: string }>;
  steps?: TraceStep[];
}

export type TraceStatus = 'connecting' | 'live' | 'stopped' | 'error';

export function useLiveTrace(automationId: string) {
  const { state } = useWebSocketContext();
  const socket = state.socket;
  const [entries, setEntries] = useState<TraceEntry[]>([]);
  const [status, setStatus] = useState<TraceStatus>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(TRACE_DURATION_MS);
  const expiresAtRef = useRef<number>(0);

  // Arm the trace + subscribe while mounted. Re-runs if the socket (re)connects:
  // cleanup stops on the old socket (a no-op once it's gone) and we re-arm on the
  // new one, which re-fires `automation-trace:started` and resets the countdown —
  // intended, since a reconnect starts a fresh 5-minute server-side session.
  useEffect(() => {
    if (!socket) {
      setStatus('connecting');
      return;
    }
    const onTrace = (payload: TraceEntry) => {
      if (!payload || payload.automationId !== automationId) return;
      setEntries((prev) => {
        const next = [payload, ...prev];
        return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
      });
    };
    const onStarted = (data: { automationId: string; expiresAt: number }) => {
      if (data?.automationId !== automationId) return;
      expiresAtRef.current = data.expiresAt;
      setStatus('live');
    };
    const onError = (data: { automationId?: string; error: string }) => {
      if (data?.automationId && data.automationId !== automationId) return;
      setErrorMsg(data?.error ?? 'trace error');
      setStatus('error');
    };

    socket.on('automation:trace', onTrace);
    socket.on('automation-trace:started', onStarted);
    socket.on('automation-trace:error', onError);
    socket.emit('automation-trace:start', { automationId, durationMs: TRACE_DURATION_MS });

    return () => {
      socket.emit('automation-trace:stop', { automationId });
      socket.off('automation:trace', onTrace);
      socket.off('automation-trace:started', onStarted);
      socket.off('automation-trace:error', onError);
    };
  }, [socket, automationId]);

  // Countdown to auto-stop (the server expires it too).
  useEffect(() => {
    if (status !== 'live') return;
    const tick = () => {
      const left = Math.max(0, expiresAtRef.current - Date.now());
      setRemaining(left);
      if (left <= 0) setStatus('stopped');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status]);

  return { entries, clear: () => setEntries([]), status, errorMsg, remaining };
}

export const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
