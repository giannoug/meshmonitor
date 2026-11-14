/**
 * The node filters (boards 15-10 "More filters" on desktop, 15-14 "Filters" on
 * phone): every field of today's AdvancedNodeFilterPopup, in today's words, on
 * the same state (`usePersistedNodeFilters('nodeFilters')` and UIContext's
 * security filter), so Nodes and the device map share them. As today, a
 * change applies at once; Apply closes and Reset all restores the defaults.
 * Phone puts Device role and Channel behind a disclosure (s15n5 "opens ... as
 * lists"). Filtering sends nothing on the mesh.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../components/common/NumberInput';
import { ROLE_NAMES } from '../../constants';
import type { Channel } from '../../types/device';
import type { NodeFilters, SecurityFilter } from '../../types/ui';
import { DEFAULT_NODE_FILTERS, toggleInSelection } from '../../utils/nodeAdvancedFilter';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './NodeFiltersSheet.module.css';

export interface NodeFiltersSheetProps {
  open: boolean;
  onClose(): void;
  nodeFilters: NodeFilters;
  onNodeFiltersChange(filters: NodeFilters): void;
  securityFilter: SecurityFilter;
  onSecurityFilterChange(filter: SecurityFilter): void;
  channels: Channel[];
}

const ROLES = Object.entries(ROLE_NAMES).map(([value, label]) => ({ value: Number(value), label }));

type Feature = 'showTelemetry' | 'showEnvironment' | 'showPosition' | 'showPKI' | 'showRemoteAdmin' | 'showMqtt' | 'showUnknown' | 'showIgnored' | 'showFavorites' | 'showFavoriteLocked' | 'showHiddenFromMap';
// The popup's order and keys.
const FEATURES: Array<[Feature, string, string]> = [
  ['showTelemetry', 'node_filter.telemetry', 'Telemetry data'],
  ['showEnvironment', 'node_filter.environment', 'Environment metrics'],
  ['showPosition', 'node_filter.position', 'Position data'],
  ['showPKI', 'node_filter.pkc', 'Public Key Crypto'],
  ['showRemoteAdmin', 'node_filter.remote_admin', 'Remote Admin'],
  ['showMqtt', 'node_filter.mqtt', 'MQTT nodes'],
  ['showUnknown', 'node_filter.unknown', 'Unknown nodes'],
  ['showIgnored', 'node_filter.ignored', 'Show ignored nodes'],
  ['showFavorites', 'node_filter.favorites', 'Favorites'],
  ['showFavoriteLocked', 'node_filter.favorite_locked', 'Favorite locked'],
  ['showHiddenFromMap', 'node_filter.hidden_from_map', 'Hidden from map'],
];

/** How many filters differ from the defaults (the mode is how they apply, not a filter). */
function activeFilterCount(f: NodeFilters, security: SecurityFilter): number {
  const d = DEFAULT_NODE_FILTERS;
  return (
    FEATURES.filter(([k]) => !!f[k] !== !!d[k]).length +
    Number(f.powerSource !== d.powerSource) +
    Number(f.minHops !== d.minHops || f.maxHops !== d.maxHops) +
    Number(f.deviceRoles.length > 0) +
    Number(f.channels.length > 0) +
    Number(security !== 'all')
  );
}

export default function NodeFiltersSheet(p: NodeFiltersSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const f = p.nodeFilters;
  const set = (patch: Partial<NodeFilters>) => p.onNodeFiltersChange({ ...f, ...patch });
  const count = activeFilterCount(f, p.securityFilter);
  const title = isPhone ? t('common.filters') : t('workspace.map.more_filters');

  const segments = <T extends string>(name: string, value: T, options: Array<[T, string]>, onPick: (v: T) => void) => (
    <div className={styles.segments}>
      {options.map(([v, label]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onPick(v)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
  const section = (heading: string, body: ReactNode) => (
    <section className={styles.section}>
      <h3 className={styles.heading}>{heading}</h3>
      {body}
    </section>
  );
  const checks = (items: Array<{ value: number; label: string }>, selected: number[], onToggle: (v: number, on: boolean) => void) => (
    <div className={styles.grid}>
      {items.map(({ value, label }) => (
        <label key={value} className={styles.check}>
          <input type="checkbox" checked={selected.length === 0 || selected.includes(value)} onChange={(e) => onToggle(value, e.target.checked)} />
          {label}
        </label>
      ))}
    </div>
  );
  // Phone: a list behind a disclosure whose summary says how many are chosen.
  const disclosure = (heading: string, total: number, selected: number[], body: ReactNode) =>
    isPhone ? (
      <details className={styles.section}>
        <summary className={styles.summary}>
          <span className={styles.heading}>{heading}</span>
          <span>{selected.length === 0 ? t('common.all') : `${selected.length} / ${total}`}</span>
        </summary>
        {body}
      </details>
    ) : (
      section(heading, body)
    );

  const channelItems = p.channels.map((ch) => ({
    value: ch.id,
    label: `${t('node_filter.channel_number', 'Channel {{number}}', { number: ch.id })}${ch.name ? ` (${ch.name})` : ''}`,
  }));

  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title={
        <>
          {title}
          {count > 0 && <span className={styles.count}> · {t('workspace.nodes.filters_on', { count })}</span>}
        </>
      }
      footer={
        <div className={styles.footer} data-phone={isPhone || undefined}>
          {!isPhone && <p className={styles.note}>{t('workspace.nodes.filters_note')}</p>}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              p.onNodeFiltersChange(DEFAULT_NODE_FILTERS);
              p.onSecurityFilterChange('all');
            }}
          >
            {t('node_filter.reset_all', 'Reset All')}
          </button>
          <button type="button" className={styles.primary} onClick={p.onClose}>
            {t('node_filter.apply', 'Apply')}
          </button>
        </div>
      }
    >
      <div className={styles.body} data-phone={isPhone || undefined}>
        {section(
          t('node_filter.filter_mode', 'Filter Mode'),
          <>
            {segments('nf-mode', f.filterMode, [['show', t('node_filter.show_only', 'Show only')], ['hide', t('node_filter.hide_matching', 'Hide matching')]], (filterMode) => set({ filterMode }))}
            <p className={styles.hint}>
              {f.filterMode === 'show'
                ? t('node_filter.show_description', 'Show only nodes that match all selected filters')
                : t('node_filter.hide_description', 'Hide nodes that match any selected filters')}
            </p>
          </>,
        )}
        {section(
          t('node_filter.security', 'Security'),
          segments<SecurityFilter>('nf-security', p.securityFilter, [
            ['all', t('node_filter.all_nodes', 'All Nodes')],
            ['flaggedOnly', t('node_filter.flagged_only', 'Flagged Only')],
            ['hideFlagged', t('node_filter.hide_flagged', 'Hide Flagged')],
          ], p.onSecurityFilterChange),
        )}
        {section(
          t('node_filter.node_features', 'Node Features'),
          <div className={styles.features}>
            {FEATURES.map(([key, label, fallback]) => (
              <label key={key} className={styles.check}>
                <input type="checkbox" checked={!!f[key]} onChange={(e) => set({ [key]: e.target.checked })} />
                {t(label, fallback)}
              </label>
            ))}
          </div>,
        )}
        {section(
          t('node_filter.power_source', 'Power Source'),
          segments('nf-power', f.powerSource, [
            ['both', t('node_filter.both', 'Both')],
            ['powered', t('node_filter.powered_only', 'Powered only')],
            ['battery', t('node_filter.battery_only', 'Battery only')],
          ], (powerSource) => set({ powerSource })),
        )}
        {section(
          t('node_filter.hops_away', 'Hops Away'),
          <div className={styles.range}>
            <label>
              {t('node_filter.min', 'Min')}
              <NumberInput integer min={0} max={10} value={f.minHops} onChange={(minHops) => set({ minHops })} />
            </label>
            <label>
              {t('node_filter.max', 'Max')}
              <NumberInput integer min={0} max={10} value={f.maxHops} onChange={(maxHops) => set({ maxHops })} />
            </label>
          </div>,
        )}
        {disclosure(
          t('node_filter.device_role', 'Device Role'),
          ROLES.length,
          f.deviceRoles,
          checks(ROLES, f.deviceRoles, (v, on) => set({ deviceRoles: toggleInSelection(f.deviceRoles, v, on, ROLES.map((r) => r.value)) })),
        )}
        {disclosure(
          t('node_filter.channel', 'Channel'),
          channelItems.length,
          f.channels,
          checks(channelItems, f.channels, (v, on) => set({ channels: toggleInSelection(f.channels, v, on, channelItems.map((c) => c.value)) })),
        )}
      </div>
    </Sheet>
  );
}
