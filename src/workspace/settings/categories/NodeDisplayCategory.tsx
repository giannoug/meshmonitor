/**
 * In MeshMonitor › Node display (board 12-12, Task 5.8): today's Node Display
 * section of the source's Settings, saving as you go. Per-source keys write to
 * `?sourceId=` (SettingsTab's split); each save fans out to SettingsContext as
 * SettingsTab's Save did.
 *
 * - The inactive-node trio and the LocalStats interval keep a Save of their
 *   own: saving them reschedules the source's inactive-node check, or restarts
 *   LocalStats with a request to this node 30 s later (mesh checklist 3).
 * - Advanced (s12n4): LocalStats interval, hop source, TX target window,
 *   homoglyph, aircraft position requests and age-out.
 */
import { useTranslation } from 'react-i18next';
import { useSettings, type NodeHopsCalculation } from '../../../contexts/SettingsContext';
import {
  parseNodeDisplayBoolean,
  parseNodeDisplayNumber,
  parseTxTargetMaxAgeHoursWhenUnlimited,
  NODE_DIMMING_RANGES,
  NODE_DISPLAY_RANGES,
  NODE_DISPLAY_STRING_DEFAULTS,
  TX_TARGET_MAX_AGE_HOURS_WHEN_UNLIMITED_RANGE,
} from '../../../constants/nodeDisplayDefaults';
import {
  AIRCRAFT_AGE_OUT_HOURS_RANGE,
  AIRCRAFT_AGL_RANGE,
  AIRCRAFT_MSL_RANGE,
  isAircraftAgeOutAction,
  parseAircraftAgeOutLastResult,
  parseAircraftAgeOutSettings,
  parseAircraftSettings,
} from '../../../utils/aircraftClassification';
import { clampSignFlipRangeKm, isSignFlipReferenceValid, parseSignFlipSettings, SIGN_FLIP_RANGE_KM } from '../../../utils/signFlipPosition';
import { kmToMiles } from '../../../utils/distance';
import { formatDateTime } from '../../../utils/datetime';
import SendsLine from '../../patterns/SendsLine';
import SettingGroup from '../kit/SettingGroup';
import AdvancedCard from '../kit/AdvancedCard';
import { useServerSettings } from '../useAutosaveSetting';
import { Warn } from './RowParts';
import pages from './SettingsPages.module.css';
import { AutoNumber, AutoSelect, AutoText, AutoToggle, AutosavePage, InlineSaveRows } from './autosave';
import { bool01, boolText, usePageSource } from './autosaveValues';

const HOPS: NodeHopsCalculation[] = ['nodeinfo', 'traceroute', 'messages'];
const KM_PER_MILE = 1 / 0.621371;
const num = (key: Parameters<typeof parseNodeDisplayNumber>[0]) => (raw?: string) => parseNodeDisplayNumber(key, raw);
const toggle = (key: Parameters<typeof parseNodeDisplayBoolean>[0]) => ({
  parse: (raw?: string) => parseNodeDisplayBoolean(key, raw),
  serialize: bool01.serialize,
});
const aircraft = (raw?: string) => parseAircraftSettings({ enabled: raw }).enabled;
const ageOut = (raw: Parameters<typeof parseAircraftAgeOutSettings>[0]) => parseAircraftAgeOutSettings(raw);

export default function NodeDisplayCategory() {
  return (
    <AutosavePage>
      <NodeDisplayRows />
    </AutosavePage>
  );
}

function NodeDisplayRows() {
  const { t } = useTranslation();
  const s = useSettings();
  const { data = {} } = useServerSettings(usePageSource());
  const R = NODE_DISPLAY_RANGES;
  const detect = parseAircraftSettings({ enabled: data.aircraftDetectionEnabled }).enabled;
  const ageOutOn = ageOut({ enabled: data.aircraftAgeOutEnabled }).enabled;
  const signFlipOn = parseSignFlipSettings({ enabled: data.signFlipCorrectionEnabled }).enabled;
  const miles = s.distanceUnit === 'mi';
  const lastRunAt = Number(data.aircraftAgeOutLastRunAt);
  const lastResult = parseAircraftAgeOutLastResult(data.aircraftAgeOutLastResult);

  return (
    <>
      <SettingGroup title={t('workspace.settings.node_display.node_list')}>
        <AutoNumber
          k="maxNodeAgeHours"
          id="node-display.maxNodeAgeHours"
          label={t('settings.node_window_label')}
          help={t('settings.node_window_description')}
          min={R.maxNodeAgeHours!.min}
          max={R.maxNodeAgeHours!.max}
          parse={num('maxNodeAgeHours')}
          onSaved={s.setMaxNodeAgeHours}
        />
        <AutoToggle
          k="hideIncompleteNodes"
          id="node-display.hideIncompleteNodes"
          label={t('settings.hide_incomplete_nodes')}
          help={t('settings.hide_incomplete_description')}
          {...toggle('hideIncompleteNodes')}
          onSaved={s.setHideIncompleteNodes}
        />
        <AutoToggle
          k="nodeDimmingEnabled"
          id="node-display.nodeDimmingEnabled"
          label={t('settings.node_dimming_enabled')}
          help={t('settings.node_dimming_description')}
          {...toggle('nodeDimmingEnabled')}
          onSaved={s.setNodeDimmingEnabled}
          render={(on) =>
            on && (
              <>
                <AutoNumber
                  k="nodeDimmingStartHours"
                  id="node-display.nodeDimmingStartHours"
                  label={t('settings.node_dimming_start_hours')}
                  help={t('settings.node_dimming_start_hours_description')}
                  {...NODE_DIMMING_RANGES.nodeDimmingStartHours}
                  parse={num('nodeDimmingStartHours')}
                  onSaved={s.setNodeDimmingStartHours}
                />
                <AutoNumber
                  k="nodeDimmingMinOpacity"
                  id="node-display.nodeDimmingMinOpacity"
                  label={t('settings.node_dimming_min_opacity')}
                  help={t('settings.node_dimming_min_opacity_description')}
                  {...NODE_DIMMING_RANGES.nodeDimmingMinOpacity}
                  parse={num('nodeDimmingMinOpacity')}
                  onSaved={s.setNodeDimmingMinOpacity}
                />
              </>
            )
          }
        />
      </SettingGroup>

      <SettingGroup title={t('workspace.settings.node_display.inactive')}>
        <InlineSaveRows
          note={t('workspace.settings.node_display.inactive_note')}
          fields={[
            {
              k: 'inactiveNodeThresholdHours',
              id: 'node-display.inactiveNodeThresholdHours',
              label: t('settings.inactive_node_threshold_label'),
              help: t('settings.inactive_node_threshold_description'),
              ...R.inactiveNodeThresholdHours!,
              parse: num('inactiveNodeThresholdHours'),
              onSaved: s.setInactiveNodeThresholdHours,
            },
            {
              k: 'inactiveNodeCheckIntervalMinutes',
              id: 'node-display.inactiveNodeCheckIntervalMinutes',
              label: t('settings.inactive_node_check_interval_label'),
              help: t('settings.inactive_node_check_interval_description'),
              ...R.inactiveNodeCheckIntervalMinutes!,
              parse: num('inactiveNodeCheckIntervalMinutes'),
              onSaved: s.setInactiveNodeCheckIntervalMinutes,
            },
            {
              k: 'inactiveNodeCooldownHours',
              id: 'node-display.inactiveNodeCooldownHours',
              label: t('settings.inactive_node_cooldown_label'),
              help: t('settings.inactive_node_cooldown_description'),
              ...R.inactiveNodeCooldownHours!,
              parse: num('inactiveNodeCooldownHours'),
              onSaved: s.setInactiveNodeCooldownHours,
            },
          ]}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.aircraft.title', 'Likely aircraft')}>
        <AutoToggle
          k="aircraftDetectionEnabled"
          id="node-display.aircraftDetectionEnabled"
          label={t('settings.aircraft.detection_enabled', 'Detect likely aircraft')}
          help={
            <>
              {t('settings.aircraft.help_threshold')}
              {data.elevationEnabled === 'false' && <Warn>{t('settings.aircraft.warn_elevation_disabled')}</Warn>}
              <span className={pages.block}>{t('settings.aircraft.help_effects')}</span>
            </>
          }
          parse={aircraft}
          serialize={boolText.serialize}
        />
        <AutoNumber
          k="aircraftAglThresholdMeters"
          id="node-display.aircraftAglThresholdMeters"
          label={t('settings.aircraft.agl_threshold_label', 'Height above ground threshold (m)')}
          {...AIRCRAFT_AGL_RANGE}
          step={10}
          disabled={!detect}
          parse={(raw) => parseAircraftSettings({ aglThresholdM: raw }).aglThresholdM}
          serialize={(v) => String(Math.round(v))}
        />
        <AutoNumber
          k="aircraftMslThresholdMeters"
          id="node-display.aircraftMslThresholdMeters"
          label={t('settings.aircraft.msl_threshold_label', 'Fallback: altitude above sea level (m)')}
          {...AIRCRAFT_MSL_RANGE}
          step={100}
          disabled={!detect}
          parse={(raw) => parseAircraftSettings({ mslThresholdM: raw }).mslThresholdM}
          serialize={(v) => String(Math.round(v))}
        />
      </SettingGroup>

      <SettingGroup title={t('settings.sign_flip.title', 'Sign-flipped positions')}>
        <AutoToggle
          k="signFlipCorrectionEnabled"
          id="node-display.signFlipCorrectionEnabled"
          label={t('settings.sign_flip.enabled', 'Correct sign-flipped positions')}
          help={t('settings.sign_flip.help')}
          parse={(raw) => parseSignFlipSettings({ enabled: raw }).enabled}
          serialize={boolText.serialize}
        />
        <AutoNumber
          k="signFlipCorrectionRangeKm"
          id="node-display.signFlipCorrectionRangeKm"
          label={t('settings.sign_flip.range_label', 'Range ({{unit}})', { unit: miles ? 'mi' : 'km' })}
          help={<Warn>{t('settings.sign_flip.range_warning')}</Warn>}
          min={Math.ceil(miles ? kmToMiles(SIGN_FLIP_RANGE_KM.min) : SIGN_FLIP_RANGE_KM.min)}
          max={Math.floor(miles ? kmToMiles(SIGN_FLIP_RANGE_KM.max) : SIGN_FLIP_RANGE_KM.max)}
          disabled={!signFlipOn}
          parse={(raw) => {
            const km = parseSignFlipSettings({ rangeKm: raw }).rangeKm;
            return Math.round(miles ? kmToMiles(km) : km);
          }}
          serialize={(v) => String(clampSignFlipRangeKm(miles ? v * KM_PER_MILE : v))}
        />
        <AutoText
          k="signFlipReferenceLatitude"
          id="node-display.signFlipReferenceLatitude"
          label={t('settings.sign_flip.latitude_placeholder', 'Latitude')}
          help={t('settings.sign_flip.reference_help')}
          disabled={!signFlipOn}
          parse={(raw) => raw ?? ''}
          serialize={(v) => v.trim()}
        />
        <AutoText
          k="signFlipReferenceLongitude"
          id="node-display.signFlipReferenceLongitude"
          label={t('settings.sign_flip.longitude_placeholder', 'Longitude')}
          help={
            !isSignFlipReferenceValid(data.signFlipReferenceLatitude ?? '', data.signFlipReferenceLongitude ?? '') && (
              <Warn tone="danger">{t('settings.sign_flip.reference_invalid')}</Warn>
            )
          }
          disabled={!signFlipOn}
          parse={(raw) => raw ?? ''}
          serialize={(v) => v.trim()}
        />
      </SettingGroup>

      <AdvancedCard count={8}>
        <InlineSaveRows
          note={t('workspace.settings.node_display.local_stats_note')}
          fields={[
            {
              k: 'localStatsIntervalMinutes',
              id: 'node-display.localStatsIntervalMinutes',
              label: t('settings.local_stats_interval_label'),
              help: t('settings.local_stats_interval_description'),
              ...R.localStatsIntervalMinutes!,
              parse: num('localStatsIntervalMinutes'),
            },
          ]}
        />
        <AutoSelect
          k="nodeHopsCalculation"
          id="node-display.nodeHopsCalculation"
          label={t('settings.node_hops_calculation')}
          help={t('settings.node_hops_calculation_description')}
          options={HOPS.map((h) => ({ value: h, label: t(`settings.node_hops_${h}`) }))}
          parse={(raw) => (HOPS.includes(raw as NodeHopsCalculation) ? (raw as string) : NODE_DISPLAY_STRING_DEFAULTS.nodeHopsCalculation)}
          onSaved={(v) => s.setNodeHopsCalculation(v as NodeHopsCalculation)}
        />
        <AutoNumber
          k="txTargetMaxAgeHoursWhenUnlimited"
          id="node-display.txTargetMaxAgeHoursWhenUnlimited"
          label={t('settings.tx_target_window_label')}
          help={
            <>
              {t('settings.tx_target_window_description')}
              <Warn>{t('settings.tx_target_window_warning')}</Warn>
            </>
          }
          min={TX_TARGET_MAX_AGE_HOURS_WHEN_UNLIMITED_RANGE.min}
          max={TX_TARGET_MAX_AGE_HOURS_WHEN_UNLIMITED_RANGE.max}
          parse={parseTxTargetMaxAgeHoursWhenUnlimited}
        />
        <AutoToggle
          k="homoglyphEnabled"
          id="node-display.homoglyphEnabled"
          label={t('settings.homoglyph_enabled')}
          help={t('settings.homoglyph_description')}
          {...boolText}
        />
        <AutoToggle
          k="aircraftPositionRequestsEnabled"
          id="node-display.aircraftPositionRequestsEnabled"
          label={t('settings.aircraft.position_requests_enabled', 'Ask new aircraft for their position')}
          help={<SendsLine>{t('settings.aircraft.position_requests_help')}</SendsLine>}
          disabled={!detect}
          {...boolText}
        />
        <AutoToggle
          k="aircraftAgeOutEnabled"
          id="node-display.aircraftAgeOutEnabled"
          label={t('settings.aircraft.age_out_enabled', 'Age out likely aircraft')}
          help={t('settings.aircraft.age_out_help')}
          disabled={!detect}
          parse={(raw) => ageOut({ enabled: raw }).enabled}
          serialize={boolText.serialize}
        />
        <AutoNumber
          k="aircraftAgeOutHours"
          id="node-display.aircraftAgeOutHours"
          label={t('settings.aircraft.age_out_hours_label', 'Age out after (hours)')}
          {...AIRCRAFT_AGE_OUT_HOURS_RANGE}
          disabled={!detect || !ageOutOn}
          parse={(raw) => ageOut({ hours: raw }).hours}
          serialize={(v) => String(Math.round(v))}
        />
        <AutoSelect
          k="aircraftAgeOutAction"
          id="node-display.aircraftAgeOutAction"
          label={t('settings.aircraft.age_out_action_label', 'Action')}
          help={
            <span data-testid="aircraft-age-out-last-run">
              {Number.isFinite(lastRunAt) && lastRunAt > 0
                ? t('settings.aircraft.age_out_last_run', {
                    time: formatDateTime(new Date(lastRunAt), s.timeFormat, s.dateFormat),
                    agedOut: (lastResult?.agedOut ?? 0) + (lastResult?.deleted ?? 0),
                    fixed: lastResult?.fixed ?? 0,
                    lifted: lastResult?.lifted ?? 0,
                  })
                : t('settings.aircraft.age_out_last_run_never', 'Last run: not yet.')}
            </span>
          }
          disabled={!detect || !ageOutOn}
          options={[
            { value: 'ignore', label: t('settings.aircraft.age_out_action_ignore', 'Ignore') },
            { value: 'delete', label: t('settings.aircraft.age_out_action_delete', 'Delete') },
          ]}
          parse={(raw) => ageOut({ action: raw }).action}
          render={(action) =>
            isAircraftAgeOutAction(action) && action === 'delete' ? (
              <p className={pages.groupNote} data-testid="aircraft-age-out-delete-warning">
                <Warn>{t('settings.aircraft.age_out_delete_warning')}</Warn>
              </p>
            ) : null
          }
        />
      </AdvancedCard>
    </>
  );
}
