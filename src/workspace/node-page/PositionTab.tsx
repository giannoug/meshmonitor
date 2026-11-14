/**
 * The node page's Position tab (boards 15-02, 15-12): the node's map with its
 * position history (today's trail and, for a tracked asset, today's playback
 * bar), today's 2.8 opt-in notice, estimate rationale and GNSS sky view; beside it the
 * history switches (MapContext's, saved to the user's map preferences as on
 * the device map, so the trail shows on both, s15n0), the position facts
 * (today's source and accuracy, `nodePositionSource`) and the override,
 * which is set from Data › Override Position. Nothing here sends.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Firmware28SilenceNotice } from '../../components/Firmware28SilenceNotice';
import { NodeSkyView } from '../../components/gnss/NodeSkyView';
import { UiIcon } from '../../components/icons';
import { PositionHistoryHoursSlider } from '../../components/map/PositionHistoryHoursSlider';
import PositionEstimateRationaleBox from '../../components/PositionEstimateRationaleBox';
import { useMapContext } from '../../contexts/MapContext';
import { useSettings } from '../../contexts/SettingsContext';
import type { DeviceInfo } from '../../types/device';
import { formatRelativeTime } from '../../utils/datetime';
import { nodePositionSource } from '../../utils/nodePositionSource';
import { useIsPhone } from '../shell/useIsPhone';
import { Fact, FactCard, Facts } from './Facts';
import NodeMap from './NodeMap';
import styles from './PositionTab.module.css';

export default function PositionTab({ sourceId, node, mapNodes }: { sourceId: string; node: DeviceInfo; mapNodes: DeviceInfo[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const map = useMapContext();
  const { distanceUnit, timeFormat, dateFormat } = useSettings();
  const pos = node.position;
  const source = nodePositionSource(node, t, distanceUnit);
  const fixes = map.positionHistoryTotalFixes ?? map.positionHistory.length;

  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void, sub?: ReactNode) => (
    <label className={styles.toggle}>
      <span className={styles.text}>
        <span>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      <input type="checkbox" role="switch" aria-label={label} className={styles.switch} checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );

  return (
    <div className={styles.position} data-phone={isPhone || undefined}>
      <div className={styles.main}>
        <NodeMap node={node} mapNodes={mapNodes} size="full" />
        <Firmware28SilenceNotice node={node} />
        {node.positionIsEstimated && pos?.latitude != null && pos.longitude != null && (
          <PositionEstimateRationaleBox nodeNum={node.nodeNum} distanceUnit={distanceUnit} timeFormat={timeFormat} dateFormat={dateFormat} />
        )}
        {/* Today's GNSS sky view: collapsed, it reads nothing until opened. */}
        <NodeSkyView node={node} sourceId={sourceId} />
      </div>
      <div className={styles.side}>
        <FactCard title={t('workspace.node.history')}>
          <div className={styles.rows}>
            {toggle(t('map.showPositionHistory'), map.showMotion, map.setShowMotion, fixes > 0 ? t('workspace.node.fixes', { count: fixes }) : null)}
            {toggle(t('map.positionHistoryPointsOnly', 'Points only (no line)'), map.positionHistoryPointsOnly, map.setPositionHistoryPointsOnly)}
            <div className={styles.toggle}>
              <span className={styles.text}>
                <span>{t('workspace.node.duration')}</span>
                <span className={styles.sub}>{t('workspace.node.duration_range')}</span>
              </span>
              {map.positionHistory.length > 1 && (
                <PositionHistoryHoursSlider positionHistory={map.positionHistory} hours={map.positionHistoryHours} onChange={map.setPositionHistoryHours} />
              )}
            </div>
          </div>
        </FactCard>
        {pos?.latitude != null && pos.longitude != null && (
          <FactCard title={t('node_details.position', 'Position')}>
            <Facts>
              <Fact label={t('workspace.node.lat_lon')}>{`${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)}`}</Fact>
              {pos.altitude != null && <Fact label={t('node_details.elevation', 'Elevation')}>{`${pos.altitude} m`}</Fact>}
              <Fact label={t('workspace.node.source')}>
                <span title={source.tooltip}>{source.label}</span>
              </Fact>
              <Fact label={t('workspace.node.accuracy')}>
                {source.accuracy ?? (source.exact ? t('node_details.position_accuracy_exact', 'Exact') : '—')}
              </Fact>
              {node.positionTimestamp != null && (
                <Fact label={t('workspace.node.updated')}>
                  {formatRelativeTime(node.positionTimestamp, timeFormat, dateFormat, false)}
                </Fact>
              )}
            </Facts>
          </FactCard>
        )}
        <FactCard title={t('node_details.position_source_override', 'Override')}>
          <div className={styles.override}>
            <p className={styles.state}>{t(node.positionIsOverride ? 'workspace.node.override_on' : 'workspace.node.override_off')}</p>
            <p className={styles.sub}>{t('position_override.description')}</p>
            <p className={styles.where}>
              <span>{t('workspace.node_menu.data')}</span>
              <UiIcon name="chevronRight" size={14} />
              <span>{t('messages.override_position')}</span>
            </p>
          </div>
        </FactCard>
      </div>
    </div>
  );
}
