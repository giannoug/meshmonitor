/**
 * In MeshMonitor › Coverage recording (s12n4, Task 5.8): today's one switch
 * (CoverageMqttRecordingSection) on an MQTT or bridge source. Turning it on
 * asks first with today's row-count warning; turning it off saves at once.
 * Writes `coverage_mqtt_enabled?sourceId=`; the server drops its cached flag.
 */
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { COVERAGE_MQTT_ENABLED_SETTING, isCoverageMqttFlagOn, splitConfirmParagraphs } from '../../../utils/coverage';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import { useAutosaveSetting } from '../useAutosaveSetting';
import { Warn } from './RowParts';
import { AutosavePage, SavedLine } from './autosave';
import { usePageSource, bool01 } from './autosaveValues';
import pages from './SettingsPages.module.css';

export default function CoverageRecordingCategory() {
  return (
    <AutosavePage>
      <CoverageRow />
    </AutosavePage>
  );
}

function CoverageRow() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [on, set, status] = useAutosaveSetting<boolean>(COVERAGE_MQTT_ENABLED_SETTING, {
    sourceId: usePageSource(),
    commit: 'change',
    scoped: true,
    parse: isCoverageMqttFlagOn,
    serialize: bool01.serialize,
    onSaved: () => void queryClient.invalidateQueries({ queryKey: ['analysis', 'coverageReport', 'receivers'] }),
  });
  const paragraphs = splitConfirmParagraphs(t('settings.coverage_mqtt_enable_confirm'));
  return (
    <SettingGroup>
      <SettingRow
        id="coverage-recording.coverage_mqtt_enabled"
        label={t('settings.coverage_mqtt_toggle_label', 'Record MQTT gateway receptions for the Coverage Report')}
        help={
          <>
            <Warn>
              <Trans i18nKey="settings.coverage_mqtt_warning" components={{ link: <Link to="/settings#settings-coverage" className={pages.link} /> }} />
            </Warn>
            <span className={pages.block}>{t('settings.coverage_mqtt_note')}</span>
          </>
        }
      >
        <SavedLine status={status} />
        <SettingToggle checked={on} onChange={(next) => (next ? setAsking(true) : set(false))} />
      </SettingRow>
      <ConfirmSheet
        open={asking}
        title={t('settings.coverage_enable_confirm_title', 'Turn on coverage recording?')}
        body={paragraphs.map((p) => (
          <p key={p} className={pages.para}>
            {p}
          </p>
        ))}
        confirmLabel={t('settings.coverage_enable_confirm_ok', 'Turn on recording')}
        onConfirm={() => {
          setAsking(false);
          set(true);
        }}
        onCancel={() => setAsking(false)}
      />
    </SettingGroup>
  );
}
