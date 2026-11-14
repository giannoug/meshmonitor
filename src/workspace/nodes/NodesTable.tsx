/**
 * The desktop Nodes table (board f3-nodes): a favourite mark, the node (its
 * name opens the node page), the role, then the user's columns in their order.
 * A sortable header sorts by today's sort field (UIContext), favourites first
 * as today's list. Only the rows near the viewport are in the DOM (as
 * Classic's list): spacer rows keep the scroll height, so it stays a <table>,
 * with aria-rowcount / aria-rowindex for the rows not drawn.
 */
import { Fragment, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { DeviceInfo } from '../../types/device';
import type { SortDirection, SortField } from '../../types/ui';
import { getDeviceRoleName } from '../../utils/deviceRole';
import { isSecurityFlagged } from '../../utils/nodeAdvancedFilter';
import { NODE_COLUMNS, avatarStyle, nodeIdOf, nodeNameOf, shortLabel, type CellContext } from './nodeColumns';
import styles from './NodesTable.module.css';

export interface NodesTableProps {
  sourceId: string;
  nodes: DeviceInfo[];
  columns: string[];
  ctx: CellContext;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort(field: SortField): void;
}

/** A row's height before it is measured (40 px avatar, padding, border). */
const ROW_PX = 57;

export default function NodesTable({ sourceId, nodes, columns, ctx, sortField, sortDirection, onSort }: NodesTableProps) {
  const { t } = useTranslation();
  const shown = columns.flatMap((id) => NODE_COLUMNS.filter((c) => c.id === id));
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_PX,
    overscan: 10,
    getItemKey: (i) => nodes[i]?.nodeNum ?? i,
  });
  const items = rows.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = items.length ? rows.getTotalSize() - items[items.length - 1].end : 0;
  const colSpan = 3 + shown.length;

  const header = (label: string, sort?: SortField) => {
    const active = sort !== undefined && sort === sortField;
    return (
      <th scope="col" aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
        {sort ? (
          <button type="button" className={styles.sort} onClick={() => onSort(sort)}>
            {label}
            {active && <UiIcon name={sortDirection === 'asc' ? 'sortAscending' : 'sortDescending'} size={14} />}
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  return (
    <div className={styles.scroll} ref={scrollRef}>
      <table className={styles.table} aria-rowcount={nodes.length + 1}>
        <thead>
          <tr aria-rowindex={1}>
            <th scope="col" className={styles.star}>
              <span className={styles.srOnly}>{t('node_filter.favorites')}</span>
            </th>
            {header(t('nodes.node'), 'longName')}
            {header(t('nodes.role'))}
            {shown.map((c) => <Fragment key={c.id}>{header(t(c.label), c.sort)}</Fragment>)}
          </tr>
        </thead>
        <tbody>
          {top > 0 && <tr aria-hidden="true"><td colSpan={colSpan} className={styles.gap} style={{ height: top }} /></tr>}
          {items.map(({ index, key }) => {
            const node = nodes[index];
            const nodeId = nodeIdOf(node);
            const role = node.user?.role != null ? getDeviceRoleName(node.user.role) : null;
            return (
              <tr key={key} data-index={index} ref={rows.measureElement} aria-rowindex={index + 2} data-stale={!node.lastHeard || undefined}>
                <td className={styles.star}>
                  {/* A mark, not a toggle: Favourite is in the node's Organise menu (it changes the radio's node DB). */}
                  <UiIcon name={node.isFavorite ? 'favorite' : 'favoriteOff'} size={16} title={node.isFavorite ? t('node_filter.favorites') : undefined} />
                </td>
                <td>
                  <span className={styles.node}>
                    <span className={styles.avatar} style={avatarStyle(node)} aria-hidden="true">{shortLabel(node)}</span>
                    <span className={styles.names}>
                      <Link className={styles.name} to={`${base}/node/${encodeURIComponent(nodeId)}`}>
                        {nodeNameOf(node)}
                      </Link>
                      {isSecurityFlagged(node) && (
                        <UiIcon name={node.keyMismatchDetected ? 'unlock' : 'alert'} size={16} className={styles.risk} title={node.keySecurityIssueDetails || t('nodes.security_risk_generic')} />
                      )}
                      {node.importedAt && !node.lastHeard && (
                        <span className={styles.imported} title={t('nodes.imported_badge_title')}>{t('nodes.imported_badge')}</span>
                      )}
                      <span className={styles.id}>{nodeId}</span>
                    </span>
                  </span>
                </td>
                <td>{role && <span className={styles.role} data-router={/router|repeater/i.test(role) || undefined}>{role}</span>}</td>
                {shown.map((c) => (
                  <td key={c.id}>{c.cell(node, ctx)}</td>
                ))}
              </tr>
            );
          })}
          {bottom > 0 && <tr aria-hidden="true"><td colSpan={colSpan} className={styles.gap} style={{ height: bottom }} /></tr>}
        </tbody>
      </table>
    </div>
  );
}
