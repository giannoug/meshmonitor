/**
 * You › Appearance › Custom themes on its own page (Task 6.3, s13n7): the
 * phone's way to 13-01's list (Apply, Edit, Clone, Delete, Create theme).
 * The same list sits on the desktop Appearance page.
 */
import { useTranslation } from 'react-i18next';
import { CustomThemeList } from './AppearancePage';
import PrefsFrame from './PrefsFrame';

export default function ThemesPage() {
  const { t } = useTranslation();
  return (
    <PrefsFrame
      categoryId="appearance"
      title={t('theme_management.title')}
      icon="sun"
      crumb={t('settings.appearance')}
      back={{ label: t('settings.appearance'), to: '/preferences/appearance' }}
    >
      <CustomThemeList />
    </PrefsFrame>
  );
}
