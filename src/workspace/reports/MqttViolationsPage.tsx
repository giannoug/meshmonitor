/**
 * Overview › Reports › ok_to_mqtt Violations (boards 6-06, 6-13; notes s6n0,
 * s6n3). Today's report (`useMqttViolationsReport` and its parts, as they
 * are): the window, From / To, Include unproven, Hide expected, Run report
 * and Export CSV; the pre-run, caveat and broker banners; the summary tiles;
 * the gateway table with its packet drill-down and CSV. The phone puts Run
 * report in the header and the filters in a sheet, lists one ≥52 px row per
 * gateway, and opens a gateway's packets in a sheet with Export CSV. Nothing
 * is read until Run report; nothing here sends on the mesh.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import MqttOkToMqttMarker from '../../components/MQTT/MqttOkToMqttMarker';
import { okToMqttState } from '../../components/MQTT/okToMqttState';
import {
  BrokerClassBadge,
  MqttViolationsBanners,
  MqttViolationsControls,
  MqttViolationsStats,
  MqttViolationsTable,
} from '../../components/Analysis/MqttViolationsReport';
import {
  mapErrorMessage,
  rowKeyOf,
  useMqttViolationsReport,
  type MqttViolationsState,
} from '../../components/Analysis/useMqttViolationsReport';
import { DEFAULT_VIOLATION_FILTERS, formatNodeDisplay } from '../../components/Analysis/mqttViolationTypes';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import ReportFrame from './ReportFrame';
import parts from './reportParts.module.css';
import styles from './MqttViolationsPage.module.css';

/** Filters set off today's defaults (the phone Filters button's count). */
function filterCount(x: MqttViolationsState): number {
  const d = x.draft;
  return [d.lookbackDays !== DEFAULT_VIOLATION_FILTERS.lookbackDays, d.from !== '', d.to !== '', d.includeUnknown, x.hidePrivateBroker]
    .filter(Boolean).length;
}

export default function MqttViolationsPage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const x = useMqttViolationsReport();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const title = t('analysis.mqtt_violations.title', 'ok_to_mqtt Violations');
  const subtitle = t(
    'analysis.mqtt_violations.description',
    "Find MQTT gateways that uplinked other nodes' packets even though the sender did not opt in to MQTT (ok_to_mqtt = 0).",
  );

  if (!isPhone) {
    return (
      <ReportFrame back="reports" title={title} subtitle={subtitle}>
        <div className={styles.desktop}>
          <MqttViolationsControls x={x} />
          <MqttViolationsBanners x={x} />
          <MqttViolationsStats x={x} />
          <MqttViolationsTable x={x} />
        </div>
      </ReportFrame>
    );
  }

  const count = filterCount(x);
  const open = x.expandedGatewayRow;
  const openDisplay = open && formatNodeDisplay(open.gatewayLongName, open.gatewayShortName, open.gatewayId, open.gatewayNodeNum);
  const showRows = x.run && !x.isLoading && !x.error && x.data && x.hasData;

  return (
    <ReportFrame
      back="reports"
      title={title}
      subtitle={subtitle}
      actions={
        <button type="button" className={parts.primary} onClick={x.onRun} disabled={x.draftRangeInvalid}>
          <UiIcon name="play" size={16} />
          {x.isLoading
            ? t('analysis.mqtt_violations.running', 'Scanning…')
            : x.run
              ? t('analysis.mqtt_violations.rerun', 'Re-run report')
              : t('analysis.mqtt_violations.run', 'Run report')}
        </button>
      }
    >
      <div className={parts.toolbar}>
        <button type="button" className={parts.ghost} onClick={() => setFiltersOpen(true)}>
          <UiIcon name="filter" size={16} />
          {count > 0 ? t('workspace.reports.filters_count', { count }) : t('common.filters')}
        </button>
      </div>

      <div className={`${parts.targets} ${styles.phoneBanners}`}>
        <MqttViolationsBanners x={x} />
        <MqttViolationsStats x={x} />
      </div>

      {showRows && (
        <ul className={parts.list}>
          {x.visibleGateways.map((row) => {
            const d = formatNodeDisplay(row.gatewayLongName, row.gatewayShortName, row.gatewayId, row.gatewayNodeNum);
            return (
              <li key={rowKeyOf(row)} className={parts.item} data-testid="mqtt-gateway-item">
                <button type="button" className={parts.rowButton} onClick={() => x.handleRowToggle(rowKeyOf(row))}>
                  <span className={parts.rowTitle}>{d.primary}</span>
                  <span className={parts.rowMeta}>
                    {[
                      `${t('analysis.mqtt_violations.col_confirmed', 'Confirmed')} ${row.violationCount}`,
                      x.suspectedShown && `${t('analysis.mqtt_violations.col_suspected', 'Suspected')} ${row.suspectedCount}`,
                      `${t('analysis.mqtt_violations.col_originators', 'Originators')} ${row.distinctOriginators}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <UiIcon name="chevronRight" size={18} className={parts.chevron} />
              </li>
            );
          })}
        </ul>
      )}
      {showRows && x.totalPages > 1 && (
        <div className={parts.toolbar}>
          <span className={styles.muted}>
            {t('analysis.mqtt_violations.page', 'Page {{page}} of {{pages}}', { page: x.currentPage, pages: x.totalPages })}
          </span>
          <span className={styles.pager}>
            <button type="button" className={parts.ghost} onClick={() => x.handlePageChange(x.currentPage - 1)} disabled={x.currentPage <= 1}>
              {t('analysis.mqtt_violations.prev', 'Previous')}
            </button>
            <button type="button" className={parts.ghost} onClick={() => x.handlePageChange(x.currentPage + 1)} disabled={x.currentPage >= x.totalPages}>
              {t('analysis.mqtt_violations.next', 'Next')}
            </button>
          </span>
        </div>
      )}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={t('common.filters')}>
        <div className={`${parts.targets} ${styles.sheetControls}`}>
          <MqttViolationsControls x={x} />
        </div>
      </Sheet>

      <Sheet
        open={!filtersOpen && open != null}
        onClose={() => open && x.handleRowToggle(rowKeyOf(open))}
        title={openDisplay ? openDisplay.primary : ''}
        actions={
          open?.gatewayId && (
            <button
              type="button"
              className={`${parts.ghost} ${styles.sheetAction}`}
              disabled={!x.drillHasData || x.drillExportPending}
              onClick={() => void x.handleExportPackets(open.gatewayId!)}
            >
              <UiIcon name="download" size={16} />
              {t('analysis.mqtt_violations.export_csv', 'Export CSV')}
            </button>
          )
        }
      >
        {open && (
          <div className={`${styles.drill} ${parts.sheetPad}`}>
            <p className={styles.muted}>
              {t('analysis.mqtt_violations.col_broker', 'Broker')} <BrokerClassBadge brokerClass={open.brokerClass} t={t} />
            </p>
            {x.drillExportWarning && <p className={parts.banner}>{x.drillExportWarning}</p>}
            {x.packetsQuery.isLoading && <p className={parts.banner}>{t('analysis.mqtt_violations.drill_loading', 'Loading packets…')}</p>}
            {!x.packetsQuery.isLoading && x.packetsQuery.error && (
              <p className={parts.error} role="alert">{mapErrorMessage(t, x.packetsQuery.error)}</p>
            )}
            {!x.packetsQuery.isLoading && !x.packetsQuery.error && x.packetsQuery.data && !x.drillHasData && (
              <p className={parts.banner}>
                {t('analysis.mqtt_violations.drill_empty', 'No individual rows for this gateway in this window.')}
              </p>
            )}
            {x.drillHasData && (
              <ul className={parts.list}>
                {x.visibleDrillViolations.map((v) => {
                  const from = formatNodeDisplay(v.fromLongName, v.fromShortName, v.fromNodeId, v.fromNode);
                  const state = okToMqttState({ okToMqttViolation: v.kind === 'confirmed' ? 1 : 0, bitfield: v.bitfield });
                  return (
                    <li key={`${v.kind}-${v.sourceId}-${v.packetId ?? v.id ?? ''}-${v.timestamp}`} className={styles.packet}>
                      <span className={parts.rowTitle}>
                        {from.primary}
                        <MqttOkToMqttMarker state={state} scope="gateway" />
                      </span>
                      <span className={parts.rowMeta}>
                        {[
                          new Date(v.timestamp).toLocaleString(),
                          v.portnumName ?? v.portnum,
                          v.channelId,
                          `${t('analysis.mqtt_violations.dcol_bitfield', 'Bitfield')} ${v.bitfield ?? '—'}`,
                        ].filter((p) => p != null && p !== '').join(' · ')}
                      </span>
                      <span className={`${parts.rowMeta} ${parts.mono}`}>
                        {t('analysis.mqtt_violations.dcol_topic', 'Topic')} {v.topic ?? '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {x.drillHasData && x.drillTotalPages > 1 && (
              <div className={parts.toolbar}>
                <span className={styles.muted}>
                  {t('analysis.mqtt_violations.page', 'Page {{page}} of {{pages}}', { page: x.drillCurrentPage, pages: x.drillTotalPages })}
                </span>
                <span className={styles.pager}>
                  <button type="button" className={parts.ghost} onClick={() => x.handleDrillPageChange(x.drillCurrentPage - 1)} disabled={x.drillCurrentPage <= 1}>
                    {t('analysis.mqtt_violations.prev', 'Previous')}
                  </button>
                  <button type="button" className={parts.ghost} onClick={() => x.handleDrillPageChange(x.drillCurrentPage + 1)} disabled={x.drillCurrentPage >= x.drillTotalPages}>
                    {t('analysis.mqtt_violations.next', 'Next')}
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </ReportFrame>
  );
}
