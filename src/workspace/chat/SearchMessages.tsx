/**
 * Message search (boards 10-15 desktop, 10-16 phone; note s10n5): today's
 * SearchModal moved into the shell, with its state and request from the shared
 * `useMessageSearch` (Rule X). It searches the open device only, with today's
 * filters (text of at least 2 characters, Case Sensitive, Scope, Channels,
 * Sender, From / To Date) and 25 results at a time with Load More. Direct
 * Messages Only needs messages:read; the channel filter lists the channels the
 * viewer can read (as App passes them).
 *
 * Desktop: a dialog over the open page. Phone: a full-screen page with Back,
 * above the tab bar. Picking a result opens its conversation
 * (`/source/:id/channel/:n` or `/source/:id/dm/:nodeId`) and closes search.
 * Searching sends nothing on the mesh.
 */
import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { skipToken, useQuery } from '@tanstack/react-query';
import { UiIcon } from '../../components/icons';
import { highlightText, useMessageSearch, type SearchResult } from '../../components/SearchModal/useMessageSearch';
import { useAuth } from '../../contexts/AuthContext';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { sourcePollQueryKey } from '../../hooks/pollQueryKey';
import type { PollData } from '../../hooks/usePoll';
import type { ResourceType } from '../../types/permission';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import styles from './SearchMessages.module.css';

export interface SearchMessagesProps {
  source: WorkspaceSource;
  phone: boolean;
  onClose(): void;
}

export default function SearchMessages(props: SearchMessagesProps) {
  return createPortal(<SearchPanel {...props} />, document.body);
}

function SearchPanel({ source, phone, onClose }: SearchMessagesProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { contentRef, onKeyDown } = useDialogA11y(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { title: useId(), scope: useId(), channel: useId(), sender: useId(), from: useId(), to: useId() };
  useEffect(() => inputRef.current?.focus(), []);

  // The device's channels, nodes and local node, from the poll its page holds (no fetch of its own).
  const { data: poll } = useQuery<PollData>({ queryKey: sourcePollQueryKey(source.id), queryFn: skipToken });
  const scoped = { sourceId: source.id };
  const channels = useMemo(
    () =>
      (poll?.channels ?? [])
        .filter((ch) => hasPermission(`channel_${ch.id}` as ResourceType, 'read', { sourceId: source.id }))
        .map((ch) => ({ id: ch.id, name: ch.name })),
    [poll, hasPermission, source.id],
  );
  const nodes = useMemo(
    () =>
      (poll?.nodes ?? []).map((n) => ({
        nodeId: n.user?.id || String(n.nodeNum),
        longName: n.user?.longName || `!${n.nodeNum.toString(16)}`,
        shortName: n.user?.shortName || '????',
      })),
    [poll],
  );
  const local = (poll?.deviceConfig?.basic?.nodeId as string | undefined) || poll?.config?.localNodeInfo?.nodeId;
  const canSearchDms = hasPermission('messages', 'read', scoped);
  const s = useMessageSearch({ canSearchDms, canSearchMeshcore: false, channelCount: channels.length, sourceId: source.id });

  const isDm = (r: SearchResult) => r.channel === undefined || r.channel === null || r.channel === -1;
  // The other end of a DM: ours go to `to`, theirs come from `from`.
  const peerOf = (r: SearchResult) =>
    (r.fromNodeId && r.fromNodeId === local ? r.toNodeId : r.fromNodeId) ?? (r.fromNodeNum !== undefined ? `!${r.fromNodeNum.toString(16)}` : '');
  const node = (id: string | undefined) => nodes.find((n) => n.nodeId === id);
  const contextLabel = (r: SearchResult) =>
    isDm(r)
      ? t('search.dm_label', { name: node(peerOf(r))?.longName ?? peerOf(r) })
      : t('search.channel_label', {
          name: channels.find((c) => c.id === r.channel)?.name || t('channels.channel_fallback', { channelNum: r.channel }),
        });
  const senderName = (r: SearchResult) => {
    const n = node(r.fromNodeId);
    return n ? `${n.longName} (${n.shortName})` : (r.fromNodeId ?? '');
  };

  const pick = (r: SearchResult) => {
    const base = `/source/${encodeURIComponent(source.id)}`;
    onClose();
    void navigate(isDm(r) ? `${base}/dm/${encodeURIComponent(peerOf(r))}` : `${base}/channel/${r.channel}`);
  };

  const showChannelFilter = (s.scope === 'all' || s.scope === 'channels') && channels.length > 0;
  const count = s.results.length < s.total
    ? t('search.results_count_of', { count: s.results.length, total: s.total })
    : t('search.results_count', { count: s.results.length });

  return (
    <div className={styles.layer} data-phone={phone ? '' : undefined}>
      {!phone && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
      <div
        ref={contentRef}
        className={styles.panel}
        data-phone={phone ? '' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.head}>
          {phone && (
            <button type="button" className={styles.icon} onClick={onClose} aria-label={t('common.back')}>
              <UiIcon name="back" size={22} />
            </button>
          )}
          <div className={styles.titles}>
            <h2 id={ids.title} className={styles.title}>{t('search.title')}</h2>
            {phone && <p className={styles.subtitle}>{source.name}</p>}
          </div>
          {!phone && (
            <button type="button" className={styles.icon} onClick={onClose} aria-label={t('common.close')}>
              <UiIcon name="close" size={20} />
            </button>
          )}
        </div>

        <div className={styles.body}>
          <form className={styles.form} onSubmit={s.handleSubmit}>
            <label className={styles.input}>
              <UiIcon name="search" size={18} />
              <input
                ref={inputRef}
                type="text"
                value={s.query}
                onChange={(e) => s.setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
              />
            </label>
            <button type="submit" className={styles.submit} disabled={s.query.trim().length < 2 || s.loading}>
              {t('search.button')}
            </button>
          </form>

          <div className={styles.filters}>
            <label className={styles.check}>
              <input type="checkbox" checked={s.caseSensitive} onChange={(e) => s.setCaseSensitive(e.target.checked)} />
              {t('search.case_sensitive')}
            </label>
            <div className={styles.field}>
              <label htmlFor={ids.scope}>{t('search.scope')}</label>
              <select id={ids.scope} value={s.scope} onChange={(e) => s.setScope(e.target.value as typeof s.scope)}>
                <option value="all">{t('search.scope_all')}</option>
                {channels.length > 0 && <option value="channels">{t('search.scope_channels')}</option>}
                {canSearchDms && <option value="dms">{t('search.scope_dms')}</option>}
              </select>
            </div>
            {showChannelFilter && (
              <div className={styles.field}>
                <label htmlFor={ids.channel}>{t('search.channels_filter')}</label>
                <select id={ids.channel} value={s.selectedChannels[0] ?? ''} onChange={s.handleChannelChange}>
                  <option value="">{t('search.scope_all')}</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>{ch.name || t('channels.channel_fallback', { channelNum: ch.id })}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor={ids.sender}>{t('search.sender_filter')}</label>
              <select id={ids.sender} value={s.senderNodeId} onChange={(e) => s.setSenderNodeId(e.target.value)}>
                <option value="">{t('search.scope_all')}</option>
                {nodes.map((n) => (
                  <option key={n.nodeId} value={n.nodeId}>{`${n.longName} (${n.shortName})`}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.from}>{t('search.date_from')}</label>
              <input id={ids.from} type="date" value={s.startDate} onChange={(e) => s.setStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.to}>{t('search.date_to')}</label>
              <input id={ids.to} type="date" value={s.endDate} onChange={(e) => s.setEndDate(e.target.value)} />
            </div>
          </div>

          {s.loading && <p className={styles.note} role="status">{t('search.loading')}</p>}
          {s.error && <p className={styles.note} role="alert">{t('search.error')}</p>}
          {!s.loading && !s.error && s.hasSearched && s.results.length === 0 && <p className={styles.note}>{t('search.no_results')}</p>}
          {!s.hasSearched && !s.loading && s.query.trim().length < 2 && <p className={styles.note}>{t('search.min_length')}</p>}

          {!s.loading && !s.error && s.results.length > 0 && (
            <>
              <p className={styles.count}>
                {phone ? (
                  `${count} · ${t('workspace.search.tap_hint')}`
                ) : (
                  <>
                    <span>{count}</span>
                    <span>{t('workspace.search.pick_hint')}</span>
                  </>
                )}
              </p>
              <ul className={styles.results}>
                {s.results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className={styles.result} onClick={() => pick(r)}>
                      <span className={styles.avatar} aria-hidden="true">{node(r.fromNodeId)?.shortName ?? '?'}</span>
                      <span className={styles.main}>
                        <span className={styles.meta}>
                          <span className={styles.chip}>{contextLabel(r)}</span>
                          <span className={styles.sender}>{senderName(r)}</span>
                          <span className={styles.time}>{new Date(r.timestamp < 1e12 ? r.timestamp * 1000 : r.timestamp).toLocaleString()}</span>
                        </span>
                        <span className={styles.text}>{highlightText(r.text, s.query, s.caseSensitive)}</span>
                      </span>
                      <UiIcon name="chevronRight" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
              {s.results.length < s.total && (
                <div className={styles.more}>
                  <button type="button" className={styles.moreButton} onClick={s.handleLoadMore} disabled={s.loading}>
                    {t('search.load_more')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
