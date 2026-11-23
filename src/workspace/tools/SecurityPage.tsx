/**
 * A device's Security (boards o3-security, 16-02-security, 16-05-security-digest;
 * notes s16n0–s16n3): `/source/:id/security` for a Meshtastic-family device
 * and a MeshCore one (one page, today's protocol sections), and Quiet nodes
 * (today's Dead nodes) at `security/quiet`.
 *
 * - Reads and actions are today's SecurityTab's (`useSecurityData`, moved out
 *   of it): issues and scanner status, dead nodes, key mismatches or the
 *   MeshCore findings, every 30 s; Scan now (security:write) and Export (CSV
 *   or JSON). Both run on MeshMonitor's server and send nothing on the mesh.
 * - Four tiles count Key problems, Noisy senders, Clock off and Quiet nodes;
 *   each opens its list (today's sections) in a sheet, Quiet nodes its page.
 * - Needs a look lists each finding with one "Send a DM" per node. A press
 *   opens the Workspace DM to that node with today's notice in the draft; it
 *   never sends. Only Send in the DM sends it: 1 DM per button (s16n1). It
 *   needs messages:write here, as today; MeshCore shows today's flood warning.
 * - The Security digest (security:write) is today's card: Send now posts to
 *   the Apprise URL from the server; nothing goes on the mesh.
 * - "Also on this page": Quiet nodes and the key-mismatch log (Meshtastic).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { getHardwareModelName } from '../../utils/hardwareModel';
import { securityCapabilities, type SecurityDeviceType } from '../../utils/securityCapabilities';
import { securityNotificationText } from '../../utils/securityNotificationText';
import { keyPrefix, type FindingNode, type NotifyState, type SecurityIssueView } from '../../components/security/securityTypes';
import { notifyStateOf, useSecurityData, type KeyMismatchEvent } from '../../components/security/useSecurityData';
import { useSecurityDigest } from '../../components/security/useSecurityDigest';
import { useSecurityFormat } from '../../components/security/useSecurityFormat';
import ToolHead from '../meshcore/ToolHead';
import RowMenu from '../patterns/RowMenu';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import QuietNodes from './QuietNodes';
import { nodeIdOf } from './deviceTools';
import mc from '../meshcore/McTools.module.css';
import styles from './Tools.module.css';

type Node = SecurityIssueView;
type Level = 'high' | 'medium' | 'low';
type ListKind = 'keys' | 'noisy' | 'clock' | 'mismatch';

export interface SecurityPageProps {
  sourceId: string;
  deviceName: string;
  sourceType: string;
  /** MeshCore device kind (a DM needs a Companion). */
  deviceType?: SecurityDeviceType;
  /** `security/quiet`: Quiet nodes (16-06). */
  quiet?: boolean;
}

const nodeName = (n: { longName?: string | null; shortName?: string | null; nodeNum?: number }) =>
  n.longName || n.shortName || (n.nodeNum !== undefined ? `!${n.nodeNum.toString(16).padStart(8, '0')}` : '');

export default function SecurityPage({ sourceId, deviceName, sourceType, deviceType, quiet = false }: SecurityPageProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { timeFormat } = useSettings();
  const caps = securityCapabilities(sourceType, deviceType);
  const isMeshCore = !caps.lowEntropy;
  const data = useSecurityData(sourceId, isMeshCore, caps);
  const { formatDate, formatRelativeTime, formatTimeOffset } = useSecurityFormat();
  const [list, setList] = useState<ListKind | null>(null);
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const canWrite = hasPermission('security', 'write', { sourceId });
  const canWriteNodes = hasPermission('nodes', 'write', { sourceId });
  const canEditSettings = hasPermission('settings', 'write', { sourceId });
  const canMessage = hasPermission('messages', 'write', { sourceId });
  const issues = data.issues;
  const nodes = useMemo(() => issues?.nodes ?? [], [issues]);

  if (quiet) {
    return (
      <QuietNodes
        sourceId={sourceId}
        deviceName={deviceName}
        isMeshCore={isMeshCore}
        deviceDelete={caps.deviceDelete}
        loading={data.loading}
        nodes={data.deadNodes}
        thresholdDays={data.deadThresholdDays}
        forbidden={data.deadNodesForbidden}
        canDelete={canWrite && canWriteNodes}
        canEditThreshold={canEditSettings}
        onChanged={data.fetchSecurityData}
      />
    );
  }

  const title = t('nav.security');
  const back = { label: t('workspace.home.tools'), to: `${base}/tools` };
  const exportMenu = caps.scanner && !data.issuesForbidden && (
    <RowMenu
      label={t('security.export')}
      items={[
        { key: 'csv', label: t('security.export_as_csv'), icon: 'download', onSelect: () => void data.handleExport('csv') },
        { key: 'json', label: t('security.export_as_json'), icon: 'download', onSelect: () => void data.handleExport('json') },
      ]}
      triggerClassName={isPhone ? mc.iconButton : mc.button}
      trigger={<><UiIcon name="download" size={isPhone ? 22 : 16} />{!isPhone && t('security.export')}</>}
    />
  );

  if (data.loading) {
    return (
      <div className={mc.page} data-phone={isPhone ? '' : undefined}>
        <ToolHead title={title} back={back} />
        <StateView kind="loading" title={t('security.loading')} />
      </div>
    );
  }
  if (data.notConnected || data.error) {
    return (
      <div className={mc.page} data-phone={isPhone ? '' : undefined}>
        <ToolHead title={title} back={back} />
        {data.notConnected ? (
          <StateView kind="empty" title={t('workspace.security.not_connected')} />
        ) : (
          <StateView kind="error" detail={t('security.error_loading', { error: data.error })} onRetry={() => void data.fetchSecurityData()} />
        )}
      </div>
    );
  }

  // ── Scanner ──
  const status = data.scannerStatus;
  const statusWord = status?.scanningNow ? t('security.scanning_now') : status?.running ? t('security.active') : t('security.stopped');
  const lastScan = status?.lastScanTime
    ? new Date(status.lastScanTime * 1000).toLocaleTimeString('en-US', { hour12: timeFormat === '12', hour: '2-digit', minute: '2-digit' })
    : t('security.never');
  const scanLine = t('workspace.security.scan_line', { device: deviceName, time: lastScan });
  const everyLine = status ? t('workspace.security.every', { hours: status.intervalHours }) : '';
  const scanButton = caps.scanner && canWrite && !data.issuesForbidden && (
    <button type="button" className={`${mc.button} ${mc.primary}`} disabled={data.scanning || status?.scanningNow} onClick={() => void data.triggerScan()}>
      {data.scanning || status?.scanningNow ? t('security.scanning') : t('workspace.security.scan_now')}
    </button>
  );

  // ── The DM button: opens the DM with today's notice; Send there sends it. ──
  const notify = (node: Node): NotifyState => {
    const state = notifyStateOf(node, caps.notifyDm, t);
    if (state.visible && !canMessage) return { visible: true, disabled: true, hint: t('security.no_permission_send') };
    return state;
  };
  const noticeFor = (node: Node, kind: 'key' | 'excessive' | 'offset', duplicateCount?: number) => {
    if (kind === 'excessive') return securityNotificationText('excessivePackets', { packetsPerHour: node.packetRatePerHour });
    if (kind === 'offset') return securityNotificationText('timeOffset', { offsetSeconds: node.timeOffsetSeconds });
    // Today's key button: the low-entropy text first, then the shared-key text.
    if (node.keyIsLowEntropy) return securityNotificationText('lowEntropy');
    if (node.duplicateKeyDetected && duplicateCount) return securityNotificationText('duplicateKey', { duplicateCount });
    return '';
  };
  const openDm = (node: Node, draft: string) => {
    const id = nodeIdOf(node.nodeKey);
    if (id) void navigate(`${base}/dm/${encodeURIComponent(id)}`, { state: { draft } });
  };
  /** One node's DM button and its Sends line; on the phone the node sits beside its button (16-02). */
  const dmButton = (node: Node, draft: string, named: boolean, withWho = false) => {
    const state = notify(node);
    if (!state.visible) return null;
    const name = nodeName(node);
    const button = (
      <button type="button" className={mc.button} disabled={state.disabled} title={state.hint} onClick={() => openDm(node, draft)}>
        <UiIcon name="directMessages" size={16} />
        {named ? t('workspace.security.dm_to', { name }) : t('workspace.security.dm')}
      </button>
    );
    return (
      <div key={node.nodeKey} className={styles.nodeDm}>
        {withWho ? <div className={styles.nodeDmRow}>{who(node)}{button}</div> : button}
        {state.disabled && state.hint && <span className={mc.muted}>{state.hint}</span>}
        <SendsLine>{t('workspace.security.dm_sends', { name })}</SendsLine>
        {state.floodWarning && !state.disabled && <span className={mc.error} data-testid="security-flood-warning">{t('security.notify_flood_warning')}</span>}
      </div>
    );
  };
  const openNode = (nodeKey: string) => {
    const id = nodeIdOf(nodeKey);
    if (id) void navigate(`${base}/node/${encodeURIComponent(id)}`);
  };
  const who = (n: Node | FindingNode) => {
    const label = 'publicKey' in n && !('nodeNum' in n) ? (n as FindingNode).name?.trim() || keyPrefix((n as FindingNode).publicKey) : nodeName(n as Node);
    return (
      <button type="button" className={styles.whoLink} onClick={() => openNode(n.nodeKey)}>
        <span className={styles.avatar} aria-hidden="true">{('shortName' in n && n.shortName) || label.slice(0, 3).toUpperCase()}</span>{' '}
        {label}
      </button>
    );
  };

  // ── Needs a look ──
  type Finding = { key: string; level: Level; title: string; text: string; nodes: Array<Node | FindingNode>; dms: ReactNode[] };
  const groups = new Map<string, Node[]>();
  nodes.filter((n) => n.duplicateKeyDetected && n.publicKey).forEach((n) => groups.set(n.publicKey!, [...(groups.get(n.publicKey!) ?? []), n]));
  const shared = [...groups.entries()].filter(([, g]) => g.length > 1);
  const findings: Finding[] = [
    ...shared.map(([key, g]) => ({
      key: `dup-${key}`, level: 'high' as const, title: t('workspace.security.shared_key'), text: t('workspace.security.shared_text'),
      nodes: g, dms: g.map((n) => dmButton(n, noticeFor(n, 'key', g.length - 1), !isPhone, isPhone)),
    })),
    ...nodes.filter((n) => n.keyIsLowEntropy).map((n) => ({
      key: `weak-${n.nodeKey}`, level: 'medium' as const, title: t('workspace.security.weak_key'), text: t('workspace.security.weak_text'),
      nodes: [n], dms: [dmButton(n, noticeFor(n, 'key'), false, isPhone)],
    })),
    ...(caps.spam ? nodes.filter((n) => n.isExcessivePackets) : []).map((n) => ({
      key: `spam-${n.nodeKey}`, level: 'low' as const, title: t('workspace.security.sending_a_lot'),
      text: `${n.packetRatePerHour ?? '?'} ${t('security.packets_per_hour')}`, nodes: [n], dms: [dmButton(n, noticeFor(n, 'excessive'), false, isPhone)],
    })),
  ];
  const f = data.findings;
  const mcFindings: Finding[] = !f || data.findingsForbidden ? [] : [
    ...(caps.pathHashCollisions ? f.pathHashCollisions.groups : []).map((g) => ({
      key: `hash-${g.hash}`, level: 'medium' as const, title: t('security.mc_collisions_title'),
      text: `${t('security.mc_collisions_description', { width: f.pathHashCollisions.width })} ${t('security.mc_collisions_hash')} ${g.hash}`, nodes: g.nodes, dms: [],
    })),
    ...(caps.advertSignatures ? f.signatureFailures : []).map((n) => ({
      key: `sig-${n.nodeKey}`, level: 'high' as const, title: t('security.mc_signature_title'), text: t('security.mc_signature_description'), nodes: [n], dms: [],
    })),
    ...(caps.nameReuse ? f.nameReuse : []).map((g) => ({
      key: `name-${g.name}`, level: 'medium' as const, title: `${t('security.mc_name_reuse_title')}: ${g.name}`,
      text: `${t('security.mc_name_reuse_description')} ${t('security.mc_name_reuse_original')}: ${g.original.name ?? keyPrefix(g.original.publicKey)}`, nodes: g.suspects, dms: [],
    })),
  ];
  const all = [...mcFindings, ...findings];

  // ── Tiles ──
  const thresholds = issues?.thresholds;
  const tiles: Array<{ key: string; label: string; count: number; line: string; alert?: boolean; open(): void }> = [
    ...(caps.lowEntropy
      ? [{
          key: 'keys', label: t('workspace.security.key_problems'), count: (issues?.lowEntropyCount ?? 0) + (issues?.duplicateKeyCount ?? 0),
          line: t('workspace.security.key_line', { weak: issues?.lowEntropyCount ?? 0, shared: issues?.duplicateKeyCount ?? 0 }),
          alert: (issues?.lowEntropyCount ?? 0) + (issues?.duplicateKeyCount ?? 0) > 0, open: () => setList('keys'),
        }]
      : []),
    ...(caps.spam
      ? [{
          key: 'noisy', label: t('workspace.security.noisy_senders'), count: issues?.excessivePacketsCount ?? 0,
          line: thresholds ? t('workspace.security.noisy_line', { count: thresholds.packetsPerHour }) : t('security.have_excessive_packets'), open: () => setList('noisy'),
        }]
      : []),
    ...(caps.timeOffset
      ? [{
          key: 'clock', label: t('workspace.security.clock_off'), count: issues?.timeOffsetCount ?? 0,
          line: thresholds ? t('workspace.security.clock_line', { count: thresholds.timeOffsetMinutes }) : t('security.have_time_offset'), open: () => setList('clock'),
        }]
      : []),
    ...(caps.deadNodes
      ? [{
          key: 'quiet', label: t('workspace.security.quiet_nodes'), count: data.deadNodesForbidden ? 0 : data.deadNodes.length,
          line: t('workspace.security.quiet_line', { count: data.deadThresholdDays }), open: () => void navigate(`${base}/security/quiet`),
        }]
      : []),
  ];

  const issueDetails = (n: Node, rows: Array<[string, ReactNode]>, recs: string[]) => (
    <details className={styles.details}>
      <summary>{t('security.details')}</summary>
      <dl className={mc.kv}>
        {rows.map(([l, v]) => (
          <div key={l} className={mc.kvRow}><dt className={mc.kvLabel}>{l}</dt><dd className={mc.kvValue}>{v}</dd></div>
        ))}
      </dl>
      <p className={styles.prose}>{t('security.recommendations')}:</p>
      <ul className={styles.bullets}>{recs.map((r) => <li key={r}>{r}</li>)}</ul>
      {n.publicKey && <span className={styles.srOnly}>{n.publicKey.substring(0, 32)}</span>}
    </details>
  );
  const issueRow = (n: Node, badge: string, value: ReactNode, rows: Array<[string, ReactNode]>, recs: string[], dm: ReactNode) => (
    <li key={n.nodeKey} className={styles.finding}>
      <div className={styles.findingBody}>
        <div className={styles.findingHead}>
          {who(n)}
          <span className={styles.level}>{badge}</span>
          {value && <span className={mc.muted}>{value}</span>}
        </div>
        <p className={styles.findingText}>
          {n.protocol === 'meshcore' ? keyPrefix(n.nodeKey.slice(3)) : `Node #${n.nodeNum.toString(16).toUpperCase()}`}
          {n.hwModel ? ` · ${getHardwareModelName(n.hwModel)}` : ''} · {t('security.last_seen', { time: formatRelativeTime(n.lastHeard) })}
        </p>
        {issueDetails(n, rows, recs)}
      </div>
      <div className={styles.dmButtons}>{dm}</div>
    </li>
  );

  const listTitle: Record<ListKind, string> = {
    keys: t('workspace.security.key_problems'),
    noisy: t('workspace.security.noisy_senders'),
    clock: t('workspace.security.clock_off'),
    mismatch: t('security.key_mismatch_title'),
  };
  const listBody = () => {
    switch (list) {
      case 'keys':
        return (
          <>
            {issues && issues.total > 0 && issues.lowEntropyCount + issues.duplicateKeyCount > issues.total && <p className={mc.note}>{t('security.both_issues_note')}</p>}
            <h3 className={mc.sectionTitle}>{t('security.low_entropy_count', { count: issues?.lowEntropyCount ?? 0 })}</h3>
            <ul className={styles.findings}>
              {nodes.filter((n) => n.keyIsLowEntropy).map((n) => issueRow(n, t('security.badge_low_entropy'), n.duplicateKeyDetected ? t('security.badge_duplicate') : null, [
                [t('security.last_heard'), formatDate(n.lastHeard)],
                ...(n.keySecurityIssueDetails ? [[t('security.details'), n.keySecurityIssueDetails] as [string, ReactNode]] : []),
                ...(n.publicKey ? [[t('security.public_key'), `${n.publicKey.substring(0, 32)}...`] as [string, ReactNode]] : []),
              ], [
                t('security.recommendation_weak_key'), ...(n.duplicateKeyDetected ? [t('security.recommendation_shared_key')] : []),
                t('security.recommendation_reconfigure'), t('security.recommendation_docs'),
              ], dmButton(n, noticeFor(n, 'key'), false)))}
            </ul>
            <h3 className={mc.sectionTitle}>{t('security.duplicate_count', { count: issues?.duplicateKeyCount ?? 0 })}</h3>
            {shared.map(([key, g]) => (
              <div key={key} className={mc.card}>
                <p className={styles.prose}>
                  <span className={styles.level}>{t('security.shared_key')}</span> <span className={mc.mono}>{key.substring(0, 32)}...</span> · {t('security.nodes_sharing', { count: g.length })}
                </p>
                <ul className={styles.findings}>
                  {g.map((n) => issueRow(n, t('security.badge_duplicate'), null, [[t('security.last_heard'), formatDate(n.lastHeard)]], [t('security.group_recommendation_text')], dmButton(n, noticeFor(n, 'key', g.length - 1), false)))}
                </ul>
              </div>
            ))}
          </>
        );
      case 'noisy':
        return (
          <>
            <h3 className={mc.sectionTitle}>{t('security.top_broadcasters')}</h3>
            <p className={mc.note}>{t('security.top_broadcasters_description')}</p>
            <div className={mc.card}>
              <dl className={mc.kv}>
                {(issues?.topBroadcasters ?? []).map((b, i) => (
                  <div key={b.nodeKey ?? b.nodeNum} className={mc.kvRow}>
                    <dt className={mc.kvLabel}>
                      {i + 1}.{' '}
                      <button type="button" className={styles.whoLink} onClick={() => openNode(b.nodeKey ?? `mt:${b.nodeNum}`)}>{b.longName || b.shortName || `!${b.nodeNum.toString(16).padStart(8, '0')}`}</button>
                    </dt>
                    <dd className={mc.kvValue}>{b.packetCount} {t('security.packets_per_hour')}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <h3 className={mc.sectionTitle}>{t('security.excessive_packets_count', { count: issues?.excessivePacketsCount ?? 0 })}</h3>
            <ul className={styles.findings}>
              {nodes.filter((n) => n.isExcessivePackets).map((n) => issueRow(n, t('security.badge_excessive_packets'), `${n.packetRatePerHour ?? '?'} ${t('security.packets_per_hour')}`, [
                [t('security.packet_rate'), `${n.packetRatePerHour ?? '?'} ${t('security.packets_per_hour')}`],
                ...(n.advertRatePerHour != null ? [[t('security.advert_rate'), `${n.advertRatePerHour}`] as [string, ReactNode]] : []),
                [t('security.rate_last_checked'), formatDate(n.packetRateLastChecked)],
                [t('security.last_heard'), formatDate(n.lastHeard)],
              ], [t('security.recommendation_excessive_packets'), t('security.recommendation_investigate_spam')], dmButton(n, noticeFor(n, 'excessive'), false)))}
            </ul>
          </>
        );
      case 'clock':
        return (
          <>
            <p className={mc.note}>{t('security.time_offset_description')}</p>
            <ul className={styles.findings}>
              {nodes.filter((n) => n.isTimeOffsetIssue).map((n) => issueRow(n, t('security.badge_time_offset'), formatTimeOffset(n.timeOffsetSeconds), [
                [t('security.clock_offset'), formatTimeOffset(n.timeOffsetSeconds)],
                [t('security.last_heard'), formatDate(n.lastHeard)],
                n.protocol === 'meshcore'
                  ? [t('security.offset_source'), n.timeOffsetSource === 'advert' ? t('security.offset_source_advert') : t('security.offset_source_message')]
                  : [t('security.node_reported_time'), n.lastHeard && n.timeOffsetSeconds != null ? formatDate(n.lastHeard - n.timeOffsetSeconds) : t('security.unknown')],
              ], [t('security.recommendation_time_offset'), t('security.recommendation_check_gps')], dmButton(n, noticeFor(n, 'offset'), false)))}
            </ul>
          </>
        );
      case 'mismatch':
        return <MismatchLog events={data.mismatchEvents} />;
      default:
        return null;
    }
  };

  const today = new Date().setHours(0, 0, 0, 0);
  const mismatchToday = data.mismatchEvents.filter((e) => e.timestamp >= today).length;

  return (
    <div className={mc.page} data-phone={isPhone ? '' : undefined}>
      <ToolHead
        title={title}
        back={back}
        subtitle={caps.scanner && status ? `${scanLine} · ${everyLine}` : t(isMeshCore ? 'security.mc_description' : 'security.description')}
        actions={<>{exportMenu}{scanButton}</>}
        phoneActions={exportMenu || null}
      />
      {isPhone && caps.scanner && status && (
        <div className={styles.selectBar}>
          <div>
            <p className={styles.live}><span className={styles.liveDot} data-paused={!status.running || undefined} aria-hidden="true" />{statusWord} · {everyLine}</p>
            <p className={mc.muted}>{scanLine}</p>
          </div>
          {scanButton}
        </div>
      )}
      {!isPhone && caps.scanner && status && <p className={mc.note}>{t('security.status')}: {statusWord}</p>}
      {data.issuesForbidden && <p className={mc.note} data-testid="security-issues-forbidden">{t('security.mc_no_node_access')}</p>}
      {issues?.packetLogEnabled === false && <p className={mc.note} data-testid="security-packet-log-off">{t('security.mc_packet_log_off')}</p>}

      {caps.ownKeyChange && f && f.ownKey.detectedAt && f.ownKey.previousKey && (
        <div className={mc.banner} role="alert">
          <UiIcon name="securityAlert" size={20} />
          <div className={styles.findingBody}>
            <strong>{t('security.mc_own_key_title')}</strong>
            <p className={styles.findingText}>{t('security.mc_own_key_body')}</p>
            <dl className={mc.kv}>
              <div className={mc.kvRow}><dt className={mc.kvLabel}>{t('security.mc_own_key_previous')}</dt><dd className={`${mc.kvValue} ${mc.mono}`}>{f.ownKey.previousKey}</dd></div>
              <div className={mc.kvRow}><dt className={mc.kvLabel}>{t('security.mc_own_key_current')}</dt><dd className={`${mc.kvValue} ${mc.mono}`}>{f.ownKey.currentKey ?? '-'}</dd></div>
              <div className={mc.kvRow}><dt className={mc.kvLabel}>{t('security.mc_own_key_detected')}</dt><dd className={mc.kvValue}>{new Date(f.ownKey.detectedAt).toLocaleString()}</dd></div>
            </dl>
            {f.ownKey.pkiKeyMismatch && <p className={styles.findingText}>{t('security.mc_own_key_pki_note')}</p>}
          </div>
          {canWrite && (
            <button type="button" className={mc.button} disabled={data.acknowledging} onClick={() => void data.acknowledgeOwnKey()}>
              {t('security.mc_own_key_acknowledge')}
            </button>
          )}
        </div>
      )}

      {!data.issuesForbidden && (
        <div className={styles.tiles} data-phone={isPhone ? '' : undefined}>
          {tiles.map((tile) => (
            <button key={tile.key} type="button" className={styles.tile} data-alert={tile.alert || undefined} onClick={tile.open}>
              <span className={styles.tileHead}>{tile.label}<UiIcon name="chevronRight" size={16} /></span>
              <span className={styles.tileCount}>{tile.count}</span>
              <span className={styles.tileLine}>{tile.line}</span>
            </button>
          ))}
        </div>
      )}

      <section className={mc.section}>
        <h2 className={mc.sectionTitle}>{t('workspace.security.needs_a_look')}</h2>
        {data.findingsForbidden && <p className={mc.note} data-testid="security-findings-forbidden">{t('security.mc_no_node_access')}</p>}
        {all.length === 0 ? (
          <div className={mc.card}>
            <p className={styles.prose}>{t('security.no_issues')}</p>
            <p className={styles.prose}>{isMeshCore ? t('security.mc_collisions_empty') : t('security.scanner_checks')}</p>
          </div>
        ) : (
          <ul className={`${mc.card} ${styles.findings}`}>
            {all.map((x) => (
              <li key={x.key} className={styles.finding}>
                <span className={styles.stripe} data-level={x.level} aria-hidden="true" />
                <div className={styles.findingBody}>
                  <div className={styles.findingHead}>
                    <h3 className={styles.findingTitle}>{x.title}</h3>
                    <span className={styles.level}>{t(`workspace.security.level_${x.level}`)}</span>
                  </div>
                  {/* On the phone a finding with DM buttons names each node beside its button (16-02). */}
                  {!(isPhone && x.dms.some(Boolean)) && (
                  <div className={styles.who}>
                    {x.nodes.map((n, i) => (
                      <span key={n.nodeKey}>{i > 0 && x.nodes.length === 2 ? `${t('workspace.security.and')} ` : ''}{who(n)}</span>
                    ))}
                  </div>
                  )}
                  <p className={styles.findingText}>{x.text}</p>
                  {isPhone && x.dms.length > 0 && <div className={styles.nodeDm}>{x.dms}</div>}
                </div>
                {!isPhone && x.dms.length > 0 && <div className={styles.dmButtons}>{x.dms}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {caps.digest && canWrite && <DigestCard sourceId={sourceId} deviceName={deviceName} />}

      <section className={mc.section}>
        <h2 className={mc.sectionTitle}>{t('workspace.security.also_here')}</h2>
        <div className={mc.card}>
          {caps.deadNodes && (
            <Link to={`${base}/security/quiet`} className={styles.moreRow}>
              <span className={styles.moreLabel}>{t('workspace.security.quiet_nodes')}</span>
              <span className={styles.moreValue}>{data.deadNodesForbidden ? 0 : data.deadNodes.length}</span>
              <UiIcon name="chevronRight" size={18} />
            </Link>
          )}
          {caps.keyMismatchLog && (
            <button type="button" className={`${styles.moreRow} ${styles.rowButton}`} onClick={() => setList('mismatch')}>
              <span className={styles.moreLabel}>{t('workspace.security.mismatch_log')}</span>
              <span className={styles.moreValue}>{t('workspace.security.today_count', { count: mismatchToday })}</span>
              <UiIcon name="chevronRight" size={18} />
            </button>
          )}
        </div>
      </section>

      <Sheet open={list !== null} onClose={() => setList(null)} title={list ? listTitle[list] : ''}>
        <div className={mc.section}>{listBody()}</div>
      </Sheet>
    </div>
  );
}

/** Today's key-mismatch log (Meshtastic): node, detected, old and new key fragments, status, resolved. */
function MismatchLog({ events }: { events: KeyMismatchEvent[] }) {
  const { t } = useTranslation();
  if (events.length === 0) return <p className={mc.note}>{t('security.key_mismatch_empty')}</p>;
  const status = (action: string) =>
    ({ mismatch: t('security.key_mismatch_status_pending'), purge: t('security.key_mismatch_status_purged'), fixed: t('security.key_mismatch_status_fixed'), exhausted: t('security.key_mismatch_status_exhausted') })[action] ?? action;
  return (
    <div className={mc.tableWrap}>
      <table className={mc.table}>
        <thead>
          <tr>
            <th>{t('security.node')}</th>
            <th>{t('security.key_mismatch_detected')}</th>
            <th>{t('security.key_mismatch_old_key')}</th>
            <th>{t('security.key_mismatch_new_key')}</th>
            <th>{t('security.key_mismatch_status')}</th>
            <th>{t('security.key_mismatch_resolved')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.nodeName || `!${e.nodeNum.toString(16).padStart(8, '0')}`}</td>
              <td>{new Date(e.timestamp).toLocaleString()}</td>
              <td className={mc.mono}>{e.oldKeyFragment || '-'}</td>
              <td className={mc.mono}>{e.newKeyFragment || '-'}</td>
              <td>{status(e.action)}</td>
              <td>{e.action === 'fixed' ? new Date(e.timestamp).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 16-05: today's digest card on the kit. Save writes settings; Send now posts to Apprise from the server. */
function DigestCard({ sourceId, deviceName }: { sourceId: string; deviceName: string }) {
  const { t } = useTranslation();
  const g = useSecurityDigest(sourceId);
  const seg = <T extends string>(value: T, options: Array<[T, string]>, onChange: (v: T) => void, label: string) => (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className={styles.segButton} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
  return (
    <section className={mc.section}>
      <h2 className={mc.sectionTitle}>{t('security.digest_title')}</h2>
      <div className={mc.card}>
        <label className={styles.formRow}>
          <span className={styles.formLabel}>
            <span>{t('security.digest_enabled')}</span>
            <span className={styles.formHint}>{t('workspace.security.digest_hint', { device: deviceName })}</span>
          </span>
          <input type="checkbox" role="switch" checked={g.enabled} onChange={(e) => g.setEnabled(e.target.checked)} />
        </label>
        <label className={styles.formRow} data-stack="">
          <span>{t('security.digest_apprise_url')}</span>
          <input className={styles.input} type="text" value={g.appriseUrl} onChange={(e) => g.setAppriseUrl(e.target.value)} placeholder="discord://webhook_id/webhook_token" />
        </label>
        <label className={styles.formRow}>
          <span>{t('security.digest_time')}</span>
          <input className={styles.input} type="time" value={g.time} onChange={(e) => g.setTime(e.target.value)} />
        </label>
        <div className={styles.formRow}>
          <span>{t('security.digest_report_type')}</span>
          {seg(g.reportType, [['summary', t('security.digest_summary')], ['detailed', t('security.digest_detailed')]], g.setReportType, t('security.digest_report_type'))}
        </div>
        <div className={styles.formRow}>
          <span>{t('security.digest_format')}</span>
          {seg(g.format, [['text', t('security.digest_format_text')], ['markdown', t('security.digest_format_markdown')]], g.setFormat, t('security.digest_format'))}
        </div>
        <label className={styles.formRow}>
          <span>{t('security.digest_suppress_empty')}</span>
          <input type="checkbox" role="switch" checked={g.suppressEmpty} onChange={(e) => g.setSuppressEmpty(e.target.checked)} />
        </label>
        <div className={styles.formActions}>
          <button type="button" className={`${mc.button} ${mc.primary}`} disabled={g.saving} onClick={() => void g.save()}>
            {g.saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
          <button type="button" className={mc.button} disabled={g.sending || !g.appriseUrl} onClick={() => void g.sendNow()}>
            <UiIcon name="forward" size={16} />
            {g.sending ? t('common.sending', 'Sending...') : t('security.digest_send_now')}
          </button>
        </div>
        <div className={styles.message}><SendsLine>{t('workspace.security.digest_sends')}</SendsLine></div>
        {g.message && <p className={styles.message} data-error={g.message.type === 'error' || undefined} role="status">{g.message.text}</p>}
      </div>
    </section>
  );
}
