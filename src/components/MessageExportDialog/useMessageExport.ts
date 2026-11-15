/**
 * The message export form's state and download (#5517), shared by Classic's
 * MessageExportDialog and the Workspace's Export messages (#6365, Rule X:
 * moved verbatim out of the dialog). It builds the filter set for
 * `GET /api/messages/export` and downloads the CSV through ApiService; the
 * server applies the message views' read permissions. The form resets each
 * time `isOpen` turns true; a finished download calls `onClose`.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService, { type MessageExportParams } from '../../services/api';

export interface MessageExportChannel {
  name: string;
  sources: Array<{ sourceId: string; sourceName: string }>;
}

interface MessageExportInput {
  isOpen: boolean;
  onClose: () => void;
  channels: MessageExportChannel[];
  /** Channel to pre-select (the one the page is showing). */
  initialChannel?: string;
}

export type ChannelMode = 'all' | 'selected';

function splitTerms(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** `datetime-local` value (browser local time) → UTC epoch ms. */
function localInputToMs(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export function useMessageExport({ isOpen, onClose, channels, initialChannel }: MessageExportInput) {
  const { t } = useTranslation();

  const sources = useMemo(() => {
    const byId = new Map<string, string>();
    for (const c of channels) for (const s of c.sources) byId.set(s.sourceId, s.sourceName);
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [channels]);

  // Track the sources the user UNticked, so a source that appears later (the
  // channel list polls) starts ticked and no re-seeding is needed.
  const [excludedSources, setExcludedSources] = useState<Set<string>>(new Set());
  const [channelMode, setChannelMode] = useState<ChannelMode>('all');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [type, setType] = useState<'all' | 'channels' | 'dms'>('all');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sender, setSender] = useState('');
  const [includeReactions, setIncludeReactions] = useState(false);
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh state each time the dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setExcludedSources(new Set());
    setChannelMode(initialChannel ? 'selected' : 'all');
    setSelectedChannels(new Set(initialChannel ? [initialChannel] : []));
    setType('all');
    setInclude('');
    setExclude('');
    setStart('');
    setEnd('');
    setSender('');
    setIncludeReactions(false);
    setTimeZone(browserTimeZone());
    setBusy(false);
    setError(null);
  }, [isOpen, initialChannel]);

  const selectedSources = useMemo(
    () => new Set(sources.filter((s) => !excludedSources.has(s.id)).map((s) => s.id)),
    [sources, excludedSources],
  );

  const visibleChannels = useMemo(
    () => channels.filter((c) => c.sources.some((s) => selectedSources.has(s.sourceId))),
    [channels, selectedSources],
  );

  const startMs = localInputToMs(start);
  const endMs = localInputToMs(end);
  const rangeInvalid = startMs !== undefined && endMs !== undefined && startMs > endMs;
  const noSources = selectedSources.size === 0;
  const noChannels = channelMode === 'selected' && selectedChannels.size === 0 && type !== 'dms';
  const canExport = !busy && !noSources && !noChannels && !rangeInvalid;

  const toggle = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const runExport = async () => {
    const params: MessageExportParams = {
      // All sources ticked ⇒ omit, so DM-only sources (absent from the
      // channel list) are still included.
      sources: selectedSources.size === sources.length ? undefined : Array.from(selectedSources),
      channels: channelMode === 'selected' ? Array.from(selectedChannels) : undefined,
      type,
      include: splitTerms(include),
      exclude: splitTerms(exclude),
      start: startMs,
      end: endMs,
      sender: sender.trim() || undefined,
      includeReactions,
      tz: timeZone.trim() || 'UTC',
    };
    setBusy(true);
    setError(null);
    try {
      await apiService.exportMessagesCsv(params);
      onClose();
    } catch (err) {
      setError(t('unified.messages.export.error', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  return {
    sources,
    selectedSources,
    setExcludedSources,
    channelMode,
    setChannelMode,
    selectedChannels,
    setSelectedChannels,
    visibleChannels,
    type,
    setType,
    include,
    setInclude,
    exclude,
    setExclude,
    start,
    setStart,
    end,
    setEnd,
    sender,
    setSender,
    includeReactions,
    setIncludeReactions,
    timeZone,
    setTimeZone,
    busy,
    error,
    rangeInvalid,
    canExport,
    toggle,
    runExport,
  };
}
