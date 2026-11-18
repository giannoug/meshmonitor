/**
 * Destinations (boards 9-02, 9-11; notes s9n3, s9n4), native at
 * `/source/:id/destinations`, on the screen's one poll: today's table
 * (ReticulumDestinationsView) with its search (and Clear), sort (Last heard or
 * Name, Ascending or Descending, favourites first), favourite star and
 * per-row Copy of the hash. Today's announce rate is derived here, never
 * stored. A row opens its details (DestinationPanel): beside the table on
 * desktop, in a sheet on the phone, where rows are cards at 52 px and up.
 * Nothing here sends on the network; Favourite and Copy stay in MeshMonitor.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { UiIcon } from '../../components/icons';
import {
  formatAnnounceRate,
  sortRows,
  type SortDirection,
  type SortField,
} from '../../components/Reticulum/ReticulumDestinationsView';
import { formatRelativeTime } from '../../utils/datetime';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import DestinationPanel from './DestinationPanel';
import { peerMark, peerTone, shortHash, useRnsRuntime } from './runtime';
import styles from './Reticulum.module.css';

const nullable = (v: number | null, digits = 0) => (v === null || v === undefined ? '—' : digits > 0 ? v.toFixed(digits) : String(v));

export default function DestinationsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission } = useAuth();
  const { timeFormat, dateFormat } = useSettings();
  const { sourceId, rns } = useRnsRuntime();
  const { destinations, loading, toggleFavorite } = rns;
  const [sortField, setSortField] = useState<SortField>('lastSeen');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const canFavorite = hasPermission('nodes', 'write', { sourceId });

  const rows = useMemo(() => {
    const sorted = sortRows(destinations, sortField, sortDirection);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (r) =>
        (r.displayName || '').toLowerCase().includes(q) ||
        (r.appName || '').toLowerCase().includes(q) ||
        (r.aspects || '').toLowerCase().includes(q) ||
        r.destinationHash.toLowerCase().includes(q),
    );
  }, [destinations, sortField, sortDirection, query]);
  const favourites = destinations.filter((d) => d.isFavorite).length;
  const open = destinations.find((d) => d.destinationHash === selected) ?? null;

  const copy = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      window.prompt(t('reticulum.destinations.copy_fallback', 'Copy this destination hash:'), hash);
    }
    setCopied(hash);
  };

  const star = (d: (typeof rows)[number]) => (
    <button
      type="button"
      className={styles.star}
      data-on={d.isFavorite || undefined}
      aria-pressed={d.isFavorite}
      disabled={!canFavorite}
      title={canFavorite ? undefined : t('workspace.node_menu.needs', { permission: 'nodes:write' })}
      aria-label={d.isFavorite ? t('reticulum.favorite.remove', 'Remove from favorites') : t('reticulum.favorite.add', 'Add to favorites')}
      onClick={(e) => {
        e.stopPropagation();
        void toggleFavorite(d.destinationHash, !d.isFavorite);
      }}
    >
      <UiIcon name={d.isFavorite ? 'favorite' : 'favoriteOff'} size={18} />
    </button>
  );
  const name = (d: (typeof rows)[number]) => d.displayName || shortHash(d.destinationHash);
  const directionLabel = sortDirection === 'asc' ? t('meshcore.ascending', 'Ascending') : t('meshcore.descending', 'Descending');

  const toolbar = (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <UiIcon name="search" size={16} />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('reticulum.destinations.search', 'Search destinations…')}
          aria-label={t('reticulum.destinations.search', 'Search destinations…')}
        />
        {query && (
          <button type="button" className={styles.iconButton} onClick={() => setQuery('')} aria-label={t('common.clear', 'Clear')}>
            <UiIcon name="close" size={16} />
          </button>
        )}
      </label>
      <label className={styles.select}>
        <UiIcon name="sortAscending" size={16} />
        <span>{t('reticulum.destinations.sort_by', 'Sort by')}:</span>
        <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} aria-label={t('reticulum.destinations.sort_by', 'Sort by')}>
          <option value="lastSeen">{t('reticulum.destinations.sort_last_heard', 'Last heard')}</option>
          <option value="name">{t('reticulum.destinations.sort_name', 'Name')}</option>
        </select>
      </label>
      <button type="button" className={styles.button} onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}>
        <UiIcon name={sortDirection === 'asc' ? 'sortAscending' : 'sortDescending'} size={16} /> {directionLabel}
      </button>
    </div>
  );

  const empty =
    rows.length === 0 ? (
      <p className={styles.empty} role="status">
        {loading
          ? t('reticulum.destinations.loading', 'Loading destinations…')
          : query
            ? t('reticulum.destinations.no_search_results', 'No destinations match your search')
            : t('reticulum.destinations.empty', 'No destinations seen yet')}
      </p>
    ) : null;

  const subtitle = t('workspace.reticulum.destinations_subtitle', { count: destinations.length, favourites });

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <ToolHead title={t('reticulum.nav.destinations', 'Destinations')} back={{ label: t('workspace.tabs.home'), to: `/source/${encodeURIComponent(sourceId)}` }} />
        {toolbar}
        <p className={styles.muted}>{subtitle}</p>
        {empty ?? (
          <ul className={styles.cards}>
            {rows.map((d) => (
              <li key={d.destinationHash} className={styles.cardRow}>
                {star(d)}
                <button type="button" className={styles.cardMain} onClick={() => setSelected(d.destinationHash)}>
                  <span className={styles.avatar} data-tone={peerTone(name(d))} data-anon={!d.displayName || undefined} aria-hidden="true">{peerMark(name(d))}</span>
                  <span className={styles.convoText}>
                    <span className={styles.convoTop}>
                      <span className={styles.convoName}>{name(d)}</span>
                      <span className={styles.convoTime}>{formatRelativeTime(d.lastSeen, timeFormat, dateFormat)}</span>
                    </span>
                    <span className={styles.convoPreview}>
                      {[[d.appName, d.aspects].filter(Boolean).join('.'), d.displayName ? shortHash(d.destinationHash) : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className={styles.convoPreview}>
                      {[
                        d.hops != null ? t('workspace.reticulum.hops', { count: d.hops }) : null,
                        d.snr != null ? `SNR ${d.snr}` : null,
                        d.quality != null ? t('workspace.reticulum.quality', { value: d.quality }) : null,
                        formatAnnounceRate(d),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Sheet open={!!open} onClose={() => setSelected(null)} title={open ? name(open) : ''}>
          {open && <DestinationPanel destination={open} embedded />}
        </Sheet>
      </div>
    );
  }

  return (
    <div className={styles.split}>
      <div className={styles.page}>
        <ToolHead title={t('reticulum.nav.destinations', 'Destinations')} subtitle={subtitle} back={{ label: '', to: '' }} />
        {toolbar}
        {empty ?? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th aria-label={t('reticulum.favorite.column', 'Favorite')} />
                  <th>
                    {t('reticulum.destinations.col_name', 'Name')} · {t('reticulum.destinations.col_hash', 'Hash')}
                  </th>
                  <th>
                    {t('reticulum.destinations.col_app', 'App')} · {t('reticulum.destinations.col_aspects', 'Aspects')}
                  </th>
                  <th className={styles.num}>{t('reticulum.destinations.col_hops', 'Hops')}</th>
                  <th className={styles.num}>{t('reticulum.destinations.col_rssi', 'RSSI')}</th>
                  <th className={styles.num}>{t('reticulum.destinations.col_snr', 'SNR')}</th>
                  <th className={styles.num}>{t('reticulum.destinations.col_quality', 'Quality')}</th>
                  <th className={styles.num}>{t('workspace.reticulum.last_heard')}</th>
                  <th className={styles.num}>{t('workspace.reticulum.announce_rate')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.destinationHash}
                    className={styles.clickRow}
                    aria-selected={selected === d.destinationHash}
                    onClick={() => setSelected(d.destinationHash)}
                  >
                    <td>{star(d)}</td>
                    <td>
                      <span className={styles.nameCell}>
                        <span className={styles.avatar} data-tone={peerTone(name(d))} data-anon={!d.displayName || undefined} aria-hidden="true">{peerMark(name(d))}</span>
                        <span className={styles.convoText}>
                          <strong>{name(d)}</strong>
                          {d.displayName && (
                            <span className={styles.hashLine}>
                              <code className={styles.mono}>{shortHash(d.destinationHash)}</code>
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          title={d.destinationHash}
                          aria-label={copied === d.destinationHash ? t('common.copied') : t('common.copy')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void copy(d.destinationHash);
                          }}
                        >
                          <UiIcon name={copied === d.destinationHash ? 'check' : 'copy'} size={14} />
                        </button>
                      </span>
                    </td>
                    <td>
                      <span className={styles.convoText}>
                        <span>{d.appName || '—'}</span>
                        <span className={styles.muted}>{d.aspects || ''}</span>
                      </span>
                    </td>
                    <td className={styles.num}>{nullable(d.hops)}</td>
                    <td className={styles.num}>{nullable(d.rssi)}</td>
                    <td className={styles.num}>{nullable(d.snr, 1)}</td>
                    <td className={styles.num}>{d.quality != null ? `${d.quality} %` : '—'}</td>
                    <td className={styles.num}>{formatRelativeTime(d.lastSeen, timeFormat, dateFormat)}</td>
                    <td className={styles.num}>{formatAnnounceRate(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {open && <DestinationPanel destination={open} onClose={() => setSelected(null)} />}
    </div>
  );
}
