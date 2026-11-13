/**
 * Classic's user-menu item "Try the Workspace layout" (D18): saves
 * `layout=workspace`, and the layout gate moves the user there. UserMenu
 * renders it only when `WORKSPACE_ENTRY_ENABLED` (Task 9.3), so until then
 * Classic's menu is unchanged.
 */
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { useLayout } from '../../workspace/layout/useLayout';

export default function TryWorkspaceMenuItem({ onSelect }: { onSelect: () => void }) {
  const { t } = useTranslation();
  const { setLayout } = useLayout();
  const choose = () => {
    onSelect();
    setLayout('workspace').catch((error: unknown) => logger.error('Failed to save the layout choice:', error));
  };
  return (
    <button type="button" className="user-menu-item" onClick={choose}>
      {t('workspace.entry.menu_item')}
    </button>
  );
}
