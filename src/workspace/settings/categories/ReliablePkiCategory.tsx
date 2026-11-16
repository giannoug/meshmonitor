/**
 * In MeshMonitor › Reliable PKI (board 12-12, Task 5.8): this source's
 * override of the install-wide default (ReliablePkiSection's `scope="source"`),
 * saved on change to `reliablePkiSourceMode?sourceId=`. Saving changes only
 * the mode: the per-node hourly NodeInfo timer lives in the database and a
 * save never resets it (reliablePki.ts).
 */
import { useTranslation } from 'react-i18next';
import SendsLine from '../../patterns/SendsLine';
import SettingGroup from '../kit/SettingGroup';
import { useServerSettings } from '../useAutosaveSetting';
import { Warn } from './RowParts';
import { AutoSelect, AutosavePage } from './autosave';
import { usePageSource } from './autosaveValues';
import pages from './SettingsPages.module.css';

type GlobalMode = 'off' | 'asNeeded' | 'avoid';
const parseGlobal = (v?: string): GlobalMode => (v === 'asNeeded' || v === 'avoid' ? v : 'off');
const parseSource = (v?: string) => (v === 'off' || v === 'asNeeded' || v === 'avoid' ? v : 'inherit');

export default function ReliablePkiCategory() {
  return (
    <AutosavePage>
      <ReliablePkiRows />
    </AutosavePage>
  );
}

function ReliablePkiRows() {
  const { t } = useTranslation();
  const { data = {} } = useServerSettings(usePageSource());
  const globalDefault = parseGlobal(data.reliablePkiMode);
  const modeLabel = (m: GlobalMode) =>
    m === 'asNeeded'
      ? t('settings.reliable_pki.mode_as_needed', 'As needed')
      : m === 'avoid'
        ? t('settings.reliable_pki.mode_avoid', 'Avoid PKI')
        : t('settings.reliable_pki.mode_off', 'Off');
  return (
    <SettingGroup>
      <AutoSelect
        k="reliablePkiSourceMode"
        id="reliable-pki.reliablePkiSourceMode"
        label={t('settings.reliable_pki.source_label', 'Reliable PKI for this source')}
        help={t('settings.reliable_pki.description')}
        scoped
        segmented
        parse={parseSource}
        options={[
          { value: 'inherit', label: t('settings.reliable_pki.mode_inherit', { mode: modeLabel(globalDefault), defaultValue: 'Use the global default ({{mode}})' }) },
          { value: 'off', label: modeLabel('off') },
          { value: 'asNeeded', label: modeLabel('asNeeded') },
          { value: 'avoid', label: modeLabel('avoid') },
        ]}
        render={(value) => {
          const effective = value === 'inherit' ? globalDefault : (value as GlobalMode);
          return (
            <div className={pages.groupNote}>
              {effective === 'avoid' ? (
                <Warn>{t('settings.reliable_pki.avoid_warning')}</Warn>
              ) : (
                <SendsLine>{t('settings.reliable_pki.cost_warning')}</SendsLine>
              )}
            </div>
          );
        }}
      />
    </SettingGroup>
  );
}
