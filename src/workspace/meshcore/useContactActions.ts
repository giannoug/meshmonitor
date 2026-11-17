/**
 * A MeshCore contact's actions on its node page (Task 7.2): today's
 * MeshCoreContactDetailPanel handlers, each calling the same `useMeshCore`
 * action once per press. Nothing retries. Shared by the page's cards and its
 * node menus, so a press in either shows in both.
 *
 * The page mounts per contact (`key`), so a late reply lands on the page it
 * was asked from or nowhere: no stale-contact guard is needed here.
 *
 * Confirms are the caller's (ConfirmSheet with today's words): Reset path,
 * Share Contact and Remove ask first, as today.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DiscoverPathStart,
  MeshCoreActions,
  TracePathResult,
  ZeroHopPingResult,
} from '../../components/MeshCore/hooks/useMeshCore';
import type { MeshCoreContact } from '../../utils/meshcoreHelpers';

/** Today's Discover Path progress (#5508); the countdown sends nothing. */
export type DiscoverState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'waiting'; deadline: number }
  | { phase: 'success'; hops: number }
  | { phase: 'timeout' };

/** Today's per-browser "Auto return path" choice for Trace Path (#5485). */
const TRACE_AUTO_RETURN_KEY = 'meshcoreTraceAutoReturn';

/** `serverFavorite`: the node row's favourite flag (#5507), which the page shows once it changes. */
export function useContactActions(publicKey: string, contact: MeshCoreContact | null, actions: MeshCoreActions, serverFavorite: boolean) {
  const { t } = useTranslation();

  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<{ result: ZeroHopPingResult; at: number } | null>(null);
  const runPing = useCallback(async () => {
    if (pinging) return;
    setPinging(true);
    setPing(null);
    try {
      setPing({ result: await actions.pingContactZeroHop(publicKey), at: Date.now() });
    } finally {
      setPinging(false);
    }
  }, [actions, pinging, publicKey]);

  const [tracing, setTracing] = useState(false);
  const [trace, setTrace] = useState<{ result: TracePathResult; at: number } | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [autoReturn, setAutoReturnState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(TRACE_AUTO_RETURN_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const setAutoReturn = useCallback((next: boolean) => {
    setAutoReturnState(next);
    try {
      localStorage.setItem(TRACE_AUTO_RETURN_KEY, String(next));
    } catch {
      /* private window: keep the in-memory choice */
    }
  }, []);
  const runTrace = useCallback(async () => {
    if (tracing) return;
    setTracing(true);
    setTraceError(null);
    setTrace(null);
    try {
      const result = await actions.traceContactPath(publicKey, { autoReturn });
      if (result && 'timedOut' in result) {
        setTraceError(
          result.waitMs !== null
            ? t('meshcore.contact_details.trace_path_timeout', 'No reply within {{seconds}} s.', { seconds: Math.round(result.waitMs / 1000) })
            : t('meshcore.contact_details.trace_path_timeout_no_time', 'No reply. The trace timed out.'),
        );
      } else if (result) {
        setTrace({ result, at: Date.now() });
      } else {
        setTraceError(t('meshcore.contact_details.trace_path_error', 'Trace path failed or timed out.'));
      }
    } finally {
      setTracing(false);
    }
  }, [actions, autoReturn, publicKey, t, tracing]);

  // Discover Path (#5508): one request, then today's countdown and reply detection.
  const [discover, setDiscover] = useState<DiscoverState>({ phase: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  const baseline = useRef<{ outPath: string | null; pathLen: number | null; pathDiscoveredAt: number | null } | null>(null);
  const discovering = discover.phase === 'sending' || discover.phase === 'waiting';
  const runDiscover = useCallback(async () => {
    if (discovering) return;
    baseline.current = {
      outPath: contact?.outPath ?? null,
      pathLen: contact?.pathLen ?? null,
      pathDiscoveredAt: contact?.pathDiscoveredAt ?? null,
    };
    setDiscover({ phase: 'sending' });
    let started: DiscoverPathStart | null;
    try {
      started = await actions.discoverContactPath(publicKey);
    } catch {
      started = null;
    }
    if (!started) {
      setDiscover({ phase: 'idle' });
      return;
    }
    const at = Date.now();
    setNow(at);
    setDiscover({ phase: 'waiting', deadline: at + started.discoveryTimeoutMs });
  }, [actions, contact, discovering, publicKey]);
  // Today's countdown and expiry, moved as is: UI only, it sends nothing.
  const deadline = discover.phase === 'waiting' ? discover.deadline : null;
  useEffect(() => {
    if (deadline === null) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const expire = setTimeout(
      () => setDiscover((prev) => (prev.phase === 'waiting' ? { phase: 'timeout' } : prev)),
      Math.max(0, deadline - Date.now()),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
  }, [deadline]);
  // A reply arrives as a contact update (a new `pathDiscoveredAt`, or a changed route).
  useEffect(() => {
    if (discover.phase !== 'waiting' || !contact) return;
    const base = baseline.current;
    if (!base) return;
    const stamp = contact.pathDiscoveredAt ?? null;
    const stamped = stamp !== null && stamp !== base.pathDiscoveredAt;
    const len = contact.pathLen;
    const known = typeof len === 'number' && len >= 0;
    const changed = known && ((contact.outPath ?? null) !== base.outPath || len !== base.pathLen);
    if ((stamped && known) || changed) setDiscover({ phase: 'success', hops: len as number });
  }, [contact, discover.phase]);
  const discoverSecondsLeft = discover.phase === 'waiting' ? Math.max(0, Math.ceil((discover.deadline - now) / 1000)) : 0;

  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const runReset = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      if (!(await actions.resetContactPath(publicKey))) setResetError(t('meshcore.contact_details.reset_path_error', 'Reset path failed.'));
    } finally {
      setResetting(false);
    }
  }, [actions, publicKey, resetting, t]);

  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<{ ok: boolean; text: string } | null>(null);
  const runShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    setShareNote(null);
    try {
      const result = await actions.shareContact(publicKey);
      setShareNote(
        result.ok
          ? { ok: true, text: t('meshcore.contact_details.share_contact_success', 'Advert broadcast.') }
          : { ok: false, text: result.error || t('meshcore.contact_details.share_contact_error', 'Share contact failed.') },
      );
    } finally {
      setSharing(false);
    }
  }, [actions, publicKey, sharing, t]);

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const runExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExported(false);
    try {
      const bytes = await actions.exportContact(publicKey);
      if (!bytes) return;
      const url = `meshcore://${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt(t('meshcore.contact_details.export_contact_copy_fallback', 'Copy this meshcore:// URL:'), url);
      }
      setExported(true);
    } finally {
      setExporting(false);
    }
  }, [actions, exporting, publicKey, t]);

  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const runRemove = useCallback(async () => {
    if (removing) return false;
    setRemoving(true);
    setRemoveError(null);
    try {
      const ok = await actions.removeContact(publicKey);
      if (!ok) setRemoveError(t('meshcore.contact_details.remove_contact_error', 'Remove contact failed.'));
      return ok;
    } finally {
      setRemoving(false);
    }
  }, [actions, publicKey, removing, t]);

  // Favourite (#5507): the server's answer shows until the node list catches up.
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  // The node list catching up (or a change from elsewhere) replaces the server-confirmed value.
  useEffect(() => setFavoriteOverride(null), [serverFavorite]);
  const isFavorite = favoriteOverride ?? serverFavorite;
  const toggleFavorite = useCallback(
    async () => {
      if (favoriteBusy) return;
      setFavoriteBusy(true);
      setFavoriteError(null);
      try {
        const next = !isFavorite;
        if (await actions.setNodeFavorite(publicKey, next)) setFavoriteOverride(next);
        else setFavoriteError(t('meshcore.favorite.failed', 'Failed to update favorite'));
      } finally {
        setFavoriteBusy(false);
      }
    },
    [actions, favoriteBusy, isFavorite, publicKey, t],
  );

  const [cliBusy, setCliBusy] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);
  const setRemoteCli = useCallback(
    async (allowed: boolean) => {
      setCliBusy(true);
      setCliError(null);
      const err = await actions.setContactRemoteCli(publicKey, allowed);
      setCliBusy(false);
      setCliError(err);
    },
    [actions, publicKey],
  );

  return {
    pinging, ping, runPing,
    tracing, trace, traceError, autoReturn, setAutoReturn, runTrace,
    discover, discovering, discoverSecondsLeft, runDiscover,
    resetting, resetError, runReset,
    sharing, shareNote, runShare,
    exporting, exported, runExport,
    removing, removeError, runRemove,
    favoriteBusy, isFavorite, favoriteError, toggleFavorite,
    cliBusy, cliError, setRemoteCli,
  };
}

export type ContactActions = ReturnType<typeof useContactActions>;
