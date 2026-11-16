/**
 * The Maintenance page, `/settings/maintenance` (boards 12-08 desktop, 12-18
 * phone; 12-27 / 12-28 are its sheets): the firmware card, then Backup's and
 * the Danger zone's contents, each shown under its own category's gate and
 * registered for search under that category.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSource } from '../../../contexts/SourceContext';
import { SettingsCategoryContext } from '../kit/useFieldRegistry';
import type { CategoryDef, CategoryTarget } from '../categories';
import { BackupBody } from './BackupCategory';
import { DangerBody } from './DangerCategory';
import { FirmwareCard } from './FirmwareCategory';
import { MaintenancePage } from './maintenanceShared';
import styles from './Maintenance.module.css';

export interface MaintenanceIndexProps {
  base: string;
  sourceId: string;
  /** The Maintenance categories this viewer may open. */
  items: CategoryDef[];
  target: CategoryTarget;
  readOnly: boolean;
}

export default function MaintenanceIndex({ base, sourceId, items, target, readOnly }: MaintenanceIndexProps) {
  const { t } = useTranslation();
  const { sourceName } = useSource();
  const part = (page: string, node: ReactNode) =>
    items.some((c) => c.id === `maintenance/${page}`) && (
      <SettingsCategoryContext.Provider value={{ categoryId: `maintenance/${page}`, readOnly }}>{node}</SettingsCategoryContext.Provider>
    );
  return (
    <MaintenancePage>
      <p className={styles.scope}>{t('workspace.settings.maintenance.scope', { device: sourceName })}</p>
      {part('firmware', <FirmwareCard base={base} />)}
      {part('backup', <BackupBody sourceId={sourceId} readOnly={readOnly} />)}
      {part('danger', <DangerBody sourceId={sourceId} target={target} readOnly={readOnly} />)}
    </MaintenancePage>
  );
}
