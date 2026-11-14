import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { highlightText as highlight, useMessageSearch, type SearchResult } from './useMessageSearch';
import './SearchModal.css';

// Reticulum has no messaging surface in Phase 1b (messaging is Phase 2/3
// scope per the build spec), so no 'reticulum' branch is added here — doing
// so would imply a search backend that doesn't exist yet.
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage: (result: SearchResult) => void;
  channels: Array<{ id: number; name: string }>;
  nodes: Array<{ nodeId: string; longName: string; shortName: string }>;
  canSearchDms?: boolean;
  canSearchMeshcore?: boolean;
  /** Limit the search to this source (the page's current source). */
  sourceId?: string | null;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateToMessage,
  channels,
  nodes,
  canSearchDms = true,
  canSearchMeshcore = false,
  sourceId,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query, setQuery,
    caseSensitive, setCaseSensitive,
    scope, setScope,
    selectedChannels,
    senderNodeId, setSenderNodeId,
    startDate, setStartDate,
    endDate, setEndDate,
    results, total, loading, error, hasSearched,
    handleSubmit, handleLoadMore, handleChannelChange,
  } = useMessageSearch({ canSearchDms, canSearchMeshcore, channelCount: channels.length, sourceId });

  // Auto-focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleResultClick = (result: SearchResult) => {
    onNavigateToMessage(result);
    onClose();
  };

  const formatTimestamp = (ts: number): string => {
    return new Date(ts < 1e12 ? ts * 1000 : ts).toLocaleString();
  };

  const getContextLabel = (result: SearchResult): string => {
    if (result.source === 'meshcore') {
      return t('search.meshcore_label');
    }
    if (result.channel !== undefined && result.channel !== null) {
      const ch = channels.find(c => c.id === result.channel);
      return t('search.channel_label', { name: ch?.name || t('channels.channel_fallback', { channelNum: result.channel }) });
    }
    if (result.toNodeId) {
      const node = nodes.find(n => n.nodeId === result.toNodeId);
      return t('search.dm_label', { name: node?.longName ?? result.toNodeId });
    }
    return '';
  };

  const getSenderName = (result: SearchResult): string => {
    if (result.fromNodeId) {
      const node = nodes.find(n => n.nodeId === result.fromNodeId);
      if (node) return `${node.longName} (${node.shortName})`;
      return result.fromNodeId;
    }
    return '';
  };

  const highlightText = (text: string, searchQuery: string): React.ReactNode[] =>
    highlight(text, searchQuery, caseSensitive);

  if (!isOpen) return null;

  const showChannelFilter = scope === 'all' || scope === 'channels';

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-modal-header">
          <h2>{t('search.title')}</h2>
          <button className="search-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="search-modal-body">
          <form onSubmit={handleSubmit}>
            <div className="search-input-row">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
              />
              <button
                type="submit"
                className="search-submit-btn"
                disabled={query.trim().length < 2 || loading}
              >
                {t('search.button')}
              </button>
            </div>
          </form>

          <div className="search-filters">
            <label className="search-case-toggle">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={e => setCaseSensitive(e.target.checked)}
              />
              {t('search.case_sensitive')}
            </label>

            <div className="search-filter-group">
              <label>{t('search.scope')}</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as typeof scope)}
              >
                <option value="all">{t('search.scope_all')}</option>
                {channels.length > 0 && (
                  <option value="channels">{t('search.scope_channels')}</option>
                )}
                {canSearchDms && (
                  <option value="dms">{t('search.scope_dms')}</option>
                )}
                {canSearchMeshcore && (
                  <option value="meshcore">{t('search.scope_meshcore')}</option>
                )}
              </select>
            </div>

            {showChannelFilter && channels.length > 0 && (
              <div className="search-filter-group">
                <label>{t('search.channels_filter')}</label>
                <select
                  value={selectedChannels[0] ?? ''}
                  onChange={handleChannelChange}
                >
                  <option value="">{t('search.scope_all')}</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name || t('channels.channel_fallback', { channelNum: ch.id })}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="search-filter-group">
              <label>{t('search.sender_filter')}</label>
              <select
                value={senderNodeId}
                onChange={e => setSenderNodeId(e.target.value)}
              >
                <option value="">{t('search.scope_all')}</option>
                {nodes.map(node => (
                  <option key={node.nodeId} value={node.nodeId}>
                    {node.longName} ({node.shortName})
                  </option>
                ))}
              </select>
            </div>

            <div className="search-filter-group">
              <label>{t('search.date_from')}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>

            <div className="search-filter-group">
              <label>{t('search.date_to')}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {loading && (
            <div className="search-loading">{t('search.loading')}</div>
          )}

          {error && (
            <div className="search-error">{t('search.error')}</div>
          )}

          {!loading && !error && hasSearched && results.length === 0 && (
            <div className="search-no-results">{t('search.no_results')}</div>
          )}

          {!loading && !error && results.length > 0 && (
            <>
              <div className="search-results-header">
                {results.length < total
                  ? t('search.results_count_of', { count: results.length, total })
                  : t('search.results_count', { count: results.length })}
              </div>
              <div className="search-results-list">
                {results.map(result => (
                  <div
                    key={result.id}
                    className="search-result-item"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="search-result-meta">
                      <span className="search-result-context">
                        {getContextLabel(result)}
                      </span>
                      <span className="search-result-sender">
                        {getSenderName(result)}
                      </span>
                      <span className="search-result-time">
                        {formatTimestamp(result.timestamp)}
                      </span>
                    </div>
                    <div className="search-result-text">
                      {highlightText(result.text, query)}
                    </div>
                  </div>
                ))}
              </div>
              {results.length < total && (
                <div className="search-load-more">
                  <button
                    className="search-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={loading}
                  >
                    {t('search.load_more')}
                  </button>
                </div>
              )}
            </>
          )}

          {!hasSearched && !loading && query.trim().length < 2 && (
            <div className="search-min-length">{t('search.min_length')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
