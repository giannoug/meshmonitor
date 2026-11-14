/**
 * The desktop Nodes table (board f3-nodes): a favourite mark, the node (its
 * name opens the node page), the role, then the user's columns in their order.
 * A sortable header sorts by today's sort field (UIContext), favourites first
 * as today's list.
 */
import { Fragment } from 'react';
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

export default function NodesTable({ sourceId, nodes, columns, ctx, sortField, sortDirection, onSort }: NodesTableProps) {
  const { t } = useTranslation();
  const shown = columns.flatMap((id) => NODE_COLUMNS.filter((c) => c.id === id));
  const base = `/source/${encodeURIComponent(sourceId)}`;

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
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.star}>
              <span className={styles.srOnly}>{t('node_filter.favorites')}</span>
            </th>
            {header(t('nodes.node'), 'longName')}
            {header(t('nodes.role'))}
            {shown.map((c) => <Fragment key={c.id}>{header(t(c.label), c.sort)}</Fragment>)}
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const nodeId = nodeIdOf(node);
            const role = node.user?.role != null ? getDeviceRoleName(node.user.role) : null;
            return (
              <tr key={node.nodeNum} data-stale={!node.lastHeard || undefined}>
                <td className={styles.star}>
                  {/* A mark, not a toggle: Favourite is in the node's Organise menu (it changes the radio's node DB). */}
                  <UiIcon name={node.isFavorite ? 'favorite' : 'favoriteOff'} size={16} title={node.isFavorite ? t('node_filter.favorites') : undefined} />
                </td>
                <td>
                  <span className={styles.node}>
                    <span className={styles.avatar} style={avatarStyle(node)} aria-hidden="true">{shortLabel(node)}</span>
                    <span className={styles.names}>
                      <Link className={styles.name} to={`${base}/node/${encodeURIComponent(nodeId)}`} state={{ focusDmNodeId: nodeId }}>
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
        </tbody>
      </table>
    </div>
  );
}
