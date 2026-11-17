/**
 * The frame of a You › Preferences page (Task 6.3): You's page frame, the
 * scope line (desktop under the title, phone under the bar), and the
 * category the kit rows sit in.
 *
 * - The install's settings are read once on open (`GET /api/settings`,
 *   shared by every row; Ruling DM), and the rows wait for it.
 * - Writing them is today's `settings:write` (any source), as global
 *   Settings' Save; without it the rows are View only. A page passes
 *   `readOnly={false}` when all of its controls are per-user.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../../components/icons';
import { NumberInputScopeContext } from '../../../components/common/numberInputScopeContext';
import StateView from '../../patterns/StateView';
import { SettingsCategoryContext } from '../../settings/kit/useFieldRegistry';
import { useServerSettings } from '../../settings/useAutosaveSetting';
import { useIsPhone } from '../../shell/useIsPhone';
import YouPageFrame, { type YouPageFrameProps } from '../YouPageFrame';
import { useCanWriteSettings } from './prefValues';
import styles from './Preferences.module.css';

export interface PrefsFrameProps {
  /** Search id prefix of the rows (`<category>.<field>`). */
  categoryId: string;
  title: string;
  /** The scope line's words; default "Applies to everyone on this MeshMonitor · saves as you go". */
  scope?: string;
  icon: UiIconName;
  back?: YouPageFrameProps['back'];
  crumb?: string;
  actions?: ReactNode;
  /** Override the settings:write gate (Help & about, the editor). */
  readOnly?: boolean;
  /** Wait for `GET /api/settings` before the rows show. Default true. */
  needsSettings?: boolean;
  children: ReactNode;
}

export default function PrefsFrame({ categoryId, title, scope, icon, back, crumb, actions, readOnly, needsSettings = true, children }: PrefsFrameProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const canWrite = useCanWriteSettings();
  const viewOnly = readOnly ?? !canWrite;
  const { isLoading, isError, refetch } = useServerSettings(undefined, needsSettings);

  const line = (
    <span className={styles.scope} data-phone={isPhone || undefined}>
      <UiIcon name={icon} size={16} />
      <span className={styles.scopeText}>{scope ?? t('workspace.prefs.scope_everyone')}</span>
      {viewOnly && readOnly === undefined && <span className={styles.viewOnly}>{t('workspace.settings.view_only')}</span>}
    </span>
  );

  let body = children;
  if (needsSettings && isLoading) body = <StateView kind="loading" />;
  else if (needsSettings && isError) body = <StateView kind="error" onRetry={() => void refetch()} />;

  return (
    <YouPageFrame title={title} scope={line} crumb={crumb} back={back ?? { label: t('workspace.tabs.you'), to: '/you' }} actions={actions}>
      {isPhone && line}
      <SettingsCategoryContext.Provider value={{ categoryId, readOnly: viewOnly }}>
        {/* Number fields answer to this page only. */}
        <NumberInputScopeContext.Provider value={null}>{body}</NumberInputScopeContext.Provider>
      </SettingsCategoryContext.Provider>
    </YouPageFrame>
  );
}
