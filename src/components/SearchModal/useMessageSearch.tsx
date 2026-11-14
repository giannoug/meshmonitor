/**
 * Message search state and requests, shared by Classic's SearchModal and the
 * Workspace's search (Rule X): the text, today's filters, and the pages of
 * results, 25 at a time. Moved verbatim out of SearchModal.
 */
import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/api.js';

// Note (#3960 Phase 1b WP6): `source` below is a message-protocol
// discriminator ('standard' Meshtastic vs 'meshcore'), not the `sources.type`
// enum used elsewhere in the dashboard (see `DashboardPage.tsx` `formType`).
export interface SearchResult {
  id: string;
  text: string;
  fromNodeId?: string;
  fromNodeNum?: number;
  fromPublicKey?: string;
  toNodeId?: string;
  toNodeNum?: number;
  toPublicKey?: string;
  channel?: number;
  timestamp: number;
  rxTime?: number;
  source: 'standard' | 'meshcore';
}

export type SearchScope = 'all' | 'channels' | 'dms' | 'meshcore';

export const RESULTS_PER_PAGE = 25;

export interface UseMessageSearchOptions {
  canSearchDms: boolean;
  canSearchMeshcore: boolean;
  /** How many channels the viewer may filter by; with none, "Channels Only" is not offered. */
  channelCount: number;
  /** Limit the search to this source (the page's current source). */
  sourceId?: string | null;
}

export function useMessageSearch({ canSearchDms, canSearchMeshcore, channelCount, sourceId }: UseMessageSearchOptions) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [scope, setScope] = useState<SearchScope>('all');
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [senderNodeId, setSenderNodeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Reset scope if currently selected scope becomes inaccessible
  useEffect(() => {
    if (scope === 'dms' && !canSearchDms) setScope('all');
    if (scope === 'meshcore' && !canSearchMeshcore) setScope('all');
    if (scope === 'channels' && channelCount === 0) setScope('all');
  }, [scope, canSearchDms, canSearchMeshcore, channelCount]);

  const performSearch = useCallback(async (offset: number) => {
    setLoading(true);
    setError(false);
    try {
      const params: Parameters<typeof apiService.searchMessages>[0] = {
        q: query,
        caseSensitive: caseSensitive || undefined,
        scope: scope !== 'all' ? scope : undefined,
        channels: selectedChannels.length > 0 ? selectedChannels : undefined,
        fromNodeId: senderNodeId || undefined,
        // Epoch ms, local-day bounds (#5517). The server compares against
        // millisecond message times; seconds here matched nothing.
        startDate: startDate ? new Date(`${startDate}T00:00:00`).getTime() : undefined,
        endDate: endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : undefined,
        sourceId: sourceId ?? undefined,
        limit: RESULTS_PER_PAGE,
        offset,
      };
      const response = await apiService.searchMessages(params);
      if (offset === 0) {
        setResults(response.data);
      } else {
        setResults(prev => [...prev, ...response.data]);
      }
      setTotal(response.total);
      setHasSearched(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [query, caseSensitive, scope, selectedChannels, senderNodeId, startDate, endDate, sourceId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    void performSearch(0);
  };

  const handleLoadMore = () => {
    void performSearch(results.length);
  };

  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '') {
      setSelectedChannels([]);
    } else {
      setSelectedChannels([Number(value)]);
    }
  };

  return {
    query, setQuery,
    caseSensitive, setCaseSensitive,
    scope, setScope,
    selectedChannels,
    senderNodeId, setSenderNodeId,
    startDate, setStartDate,
    endDate, setEndDate,
    results, total, loading, error, hasSearched,
    handleSubmit, handleLoadMore, handleChannelChange,
  };
}

/** The text with each match of `searchQuery` in a <mark>. */
export function highlightText(text: string, searchQuery: string, caseSensitive: boolean): React.ReactNode[] {
  if (!searchQuery) return [text];
  const flags = caseSensitive ? 'g' : 'gi';
  const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, flags);
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (regex.test(part)) {
      // Reset lastIndex since we used 'g' flag
      regex.lastIndex = 0;
      return <mark key={i}>{part}</mark>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
