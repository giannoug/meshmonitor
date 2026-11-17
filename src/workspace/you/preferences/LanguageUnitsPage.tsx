/**
 * You › Preferences › Language & units (boards 13-03 desktop, 13-20 phone;
 * Task 6.3): today's Language, Units & Formats, Sorting and Link Previews
 * sections of global Settings on one page, saving as you go.
 *
 * - Language is today's `setLanguage`: this browser at once, and the
 *   install's `language` where the viewer may write settings (fire and
 *   forget, as today). Every viewer may change it.
 * - The other rows write today's keys to `POST /api/settings` and fan out to
 *   SettingsContext as global Settings' Save did (settings:write).
 * - Link previews are fetched by the MeshMonitor server; nothing here
 *   transmits.
 */
import { useTranslation } from 'react-i18next';
import { AVAILABLE_LANGUAGES } from '../../../config/i18n';
import { useSettings, type DateFormat, type DistanceUnit, type TimeFormat } from '../../../contexts/SettingsContext';
import type { SortOption as DashboardSortOption } from '../../../components/Dashboard/types';
import type { SortDirection, SortField } from '../../../types/ui';
import type { TemperatureUnit } from '../../../utils/temperature';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import { AutoSelect, AutoToggle, SavedLine } from '../../settings/categories/autosave';
import { useAutosaveValue } from '../../settings/useAutosaveSetting';
import { useIsPhone } from '../../shell/useIsPhone';
import PrefsFrame from './PrefsFrame';
import { notOff01, text } from './prefValues';
import styles from './Preferences.module.css';

export const WEBLATE_URL = 'https://hosted.weblate.org/projects/meshmonitor/meshmonitor/';

export default function LanguageUnitsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const s = useSettings();
  return (
    <PrefsFrame categoryId="language" title={t('workspace.you.language_units')} icon="globe">
      <div className={styles.columns} data-phone={isPhone || undefined}>
        <div className={styles.column}>
          <SettingGroup title={t('settings.language')}>
            <LanguageRow />
          </SettingGroup>
          <UnitsRows />
        </div>
        <div className={styles.column}>
          <SortingRows />
          <SettingGroup title={t('settings.link_previews', 'Link Previews')}>
            <AutoToggle
              k="linkPreviewsEnabled"
              id="link-previews.linkPreviewsEnabled"
              label={t('settings.link_previews_enabled', 'Show link previews')}
              help={t('settings.link_previews_description')}
              {...notOff01(s.linkPreviewsEnabled)}
              onSaved={s.setLinkPreviewsEnabled}
            />
          </SettingGroup>
        </div>
      </div>
    </PrefsFrame>
  );
}

function LanguageRow() {
  const { t } = useTranslation();
  const s = useSettings();
  // Today's setter: local at once, the server write fire-and-forget (SettingsContext).
  const [value, set, status] = useAutosaveValue<string>(s.language, {
    commit: 'change',
    same: (v) => v === s.language,
    // Typed void, but a promise at run time: returning it waits for it.
    write: async (v) => s.setLanguage(v),
  });
  return (
    <SettingRow
      stacked
      id="language.language"
      label={t('settings.language')}
      help={
        <>
          {t('settings.language_contribute')}{' '}
          <a className={styles.link} href={WEBLATE_URL} target="_blank" rel="noopener noreferrer">
            Weblate
          </a>
        </>
      }
    >
      <SavedLine status={status} />
      <SettingSelect
        value={value}
        readOnly={false}
        onChange={set}
        options={AVAILABLE_LANGUAGES.map((lang) => ({ value: lang.code, label: `${lang.nativeName} (${lang.name})` }))}
      />
    </SettingRow>
  );
}

function UnitsRows() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <SettingGroup title={t('settings.units_and_formats')}>
      <AutoSelect
        stacked
        segmented
        k="timeFormat"
        id="units.timeFormat"
        label={t('settings.time_format_label')}
        help={t('settings.time_format_description')}
        options={[
          { value: '12', label: t('settings.time_12_hour') },
          { value: '24', label: t('settings.time_24_hour') },
        ]}
        parse={text(s.timeFormat)}
        onSaved={(v) => s.setTimeFormat(v as TimeFormat)}
      />
      <AutoSelect
        stacked
        k="dateFormat"
        id="units.dateFormat"
        label={t('settings.date_format_label')}
        help={t('settings.date_format_description')}
        options={[
          { value: 'MM/DD/YYYY', label: t('settings.date_mdy') },
          { value: 'DD/MM/YYYY', label: t('settings.date_dmy') },
          { value: 'YYYY-MM-DD', label: t('settings.date_iso') },
        ]}
        parse={text(s.dateFormat)}
        onSaved={(v) => s.setDateFormat(v as DateFormat)}
      />
      <AutoSelect
        stacked
        segmented
        k="temperatureUnit"
        id="units.temperatureUnit"
        label={t('settings.temp_unit_label')}
        help={t('settings.temp_unit_description')}
        options={[
          { value: 'C', label: t('settings.temp_celsius') },
          { value: 'F', label: t('settings.temp_fahrenheit') },
        ]}
        parse={text(s.temperatureUnit)}
        onSaved={(v) => s.setTemperatureUnit(v as TemperatureUnit)}
      />
      <AutoSelect
        stacked
        segmented
        k="distanceUnit"
        id="units.distanceUnit"
        label={t('settings.dist_unit_label')}
        help={t('settings.dist_unit_description')}
        options={[
          { value: 'km', label: t('settings.dist_km') },
          { value: 'mi', label: t('settings.dist_mi') },
        ]}
        parse={text(s.distanceUnit)}
        onSaved={(v) => s.setDistanceUnit(v as DistanceUnit)}
      />
    </SettingGroup>
  );
}

function SortingRows() {
  const { t } = useTranslation();
  const s = useSettings();
  const field = (value: SortField, key: string) => ({ value, label: t(key) });
  return (
    <SettingGroup title={t('settings.sorting')}>
      <AutoSelect
        stacked
        k="preferredSortField"
        id="sorting.preferredSortField"
        label={t('settings.sort_field_label')}
        help={t('settings.sort_field_description')}
        options={[
          field('longName', 'settings.sort_long_name'),
          field('shortName', 'settings.sort_short_name'),
          field('id', 'settings.sort_id'),
          field('lastHeard', 'settings.sort_last_heard'),
          field('snr', 'settings.sort_snr'),
          field('battery', 'settings.sort_battery'),
          field('hwModel', 'settings.sort_hw_model'),
          field('hops', 'settings.sort_hops'),
        ]}
        parse={text(s.preferredSortField)}
        onSaved={(v) => s.setPreferredSortField(v as SortField)}
      />
      <AutoSelect
        stacked
        k="preferredSortDirection"
        id="sorting.preferredSortDirection"
        label={t('settings.sort_direction_label')}
        help={t('settings.sort_direction_description')}
        options={[
          { value: 'asc', label: t('settings.sort_ascending') },
          { value: 'desc', label: t('settings.sort_descending') },
        ]}
        parse={text(s.preferredSortDirection)}
        onSaved={(v) => s.setPreferredSortDirection(v as SortDirection)}
      />
      <AutoSelect
        stacked
        k="preferredDashboardSortOption"
        id="sorting.preferredDashboardSortOption"
        label={t('settings.dashboard_sort_label')}
        help={t('settings.dashboard_sort_description')}
        options={[
          { value: 'custom', label: t('settings.dashboard_sort_custom') },
          { value: 'node-asc', label: t('settings.dashboard_sort_node_asc') },
          { value: 'node-desc', label: t('settings.dashboard_sort_node_desc') },
          { value: 'type-asc', label: t('settings.dashboard_sort_type_asc') },
          { value: 'type-desc', label: t('settings.dashboard_sort_type_desc') },
        ]}
        parse={text(s.preferredDashboardSortOption)}
        onSaved={(v) => s.setPreferredDashboardSortOption(v as DashboardSortOption)}
      />
    </SettingGroup>
  );
}
