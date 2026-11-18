/**
 * Today's Dashboard filters (Ruling 8.1 HV): search, node, type and device
 * role, from today's `useDashboardFilters`, over the board's starred charts
 * (widgets always show, as today). A Filters button with the number of active
 * filters opens them in a sheet. Sort is not offered: the user's own order is
 * the board's (D12). Filtering only changes what shows; it writes nothing.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import type { useDashboardFilters } from '../../components/Dashboard/hooks/useDashboardFilters';
import { getTelemetryLabel } from '../../components/TelemetryChart';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './Dashboard.module.css';

type Filters = ReturnType<typeof useDashboardFilters>;

/** How many filters are on. */
function activeFilters(f: Filters): number {
  return Number(f.searchQuery.trim() !== '') + Number(f.selectedNode !== 'all') + Number(f.selectedType !== 'all') + Number(f.selectedRoles.size > 0);
}

export function FiltersButton({ filters, onOpen }: { filters: Filters; onOpen(): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const count = activeFilters(filters);
  return (
    <button type="button" className={isPhone ? `${styles.button} ${styles.phoneTool}` : styles.button} onClick={onOpen} aria-pressed={count > 0}>
      <UiIcon name="filter" size={18} />
      {t('common.filters')}
      {count > 0 && <span className={styles.badge}>{count}</span>}
    </button>
  );
}

export interface FiltersSheetProps {
  open: boolean;
  onClose(): void;
  filters: Filters;
  showRoles: boolean;
}

export function FiltersSheet({ open, onClose, filters: f, showRoles }: FiltersSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const clear = () => {
    f.setSearchQuery('');
    f.setSelectedNode('all');
    f.setSelectedType('all');
    f.handleClearRoleFilter();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('common.filters')}
      footer={
        <button type="button" className={styles.button} onClick={clear} disabled={activeFilters(f) === 0}>
          {t('common.clear')}
        </button>
      }
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        <div className={styles.fields}>
          <input
            type="search"
            className={styles.field}
            value={f.searchQuery}
            onChange={(e) => f.setSearchQuery(e.target.value)}
            placeholder={t('dashboard.search_placeholder')}
            aria-label={t('dashboard.search_placeholder')}
          />
          <label className={styles.fieldLabel}>
            {t('dashboard.select_node')}
            <select className={styles.field} value={f.selectedNode} onChange={(e) => f.setSelectedNode(e.target.value)}>
              <option value="all">{t('dashboard.all_nodes')}</option>
              {f.uniqueNodes.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            {t('dashboard.select_metric')}
            <select className={styles.field} value={f.selectedType} onChange={(e) => f.setSelectedType(e.target.value)}>
              <option value="all">{t('dashboard.all_types')}</option>
              {f.uniqueTelemetryTypes.map((type) => (
                <option key={type} value={type}>{getTelemetryLabel(type)}</option>
              ))}
            </select>
          </label>
          {showRoles && f.uniqueDeviceRoles.length > 0 && (
            <fieldset className={styles.roles}>
              <legend className={styles.fieldLabel}>
                {f.selectedRoles.size === 0 ? t('dashboard.device_roles_all') : t('dashboard.device_roles_selected', { count: f.selectedRoles.size })}
              </legend>
              {f.uniqueDeviceRoles.map((role) => (
                <label key={role} className={styles.check}>
                  <input type="checkbox" checked={f.selectedRoles.has(role)} onChange={(e) => f.handleToggleRole(role, e.target.checked)} />
                  {role}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      </div>
    </Sheet>
  );
}
