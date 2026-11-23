import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { TabType } from '../types/ui';
import { getHardwareModelName } from '../utils/hardwareModel';
import { SourceNotConnectedNotice } from './common/SourceNotConnectedNotice';
import { securityCapabilities, type SecurityDeviceType } from '../utils/securityCapabilities';
import { securityNotificationText } from '../utils/securityNotificationText';
import { DeadNodesSection } from './security/DeadNodesSection';
import { PathHashCollisionsSection } from './security/PathHashCollisionsSection';
import { AdvertSignatureSection } from './security/AdvertSignatureSection';
import { NameReuseSection } from './security/NameReuseSection';
import { OwnKeyChangeCard } from './security/OwnKeyChangeCard';
import { ScannerStatusCard } from './security/ScannerStatusCard';
import { SecurityExportMenu } from './security/SecurityExportMenu';
import { SecurityDigestCard } from './security/SecurityDigestCard';
import { TopBroadcastersTable } from './security/TopBroadcastersTable';
import { ExcessivePacketsSection } from './security/ExcessivePacketsSection';
import { TimeOffsetSection } from './security/TimeOffsetSection';
import { useSecurityFormat } from './security/useSecurityFormat';
import securityStyles from './security/SecurityIssues.module.css';
import type { NotifyKind, NotifyState, SecurityIssueView } from './security/securityTypes';
import { notifyStateOf, useSecurityData } from './security/useSecurityData';
import { groupDuplicateKeyNodes, mismatchStatusLabel } from './security/securityHelpers';
import { useResolvedSourceId } from '../hooks/useResolvedSourceId';
import '../styles/SecurityTab.css';

type SecurityNode = SecurityIssueView;


interface SecurityTabProps {
  onTabChange?: (tab: TabType) => void;
  /**
   * Open a node by `mt:<n>` / `mc:<pk>` key. The host owns navigation
   * (Meshtastic selects the DM thread and switches tab; MeshCore opens Node
   * Details), so the tab only checks the viewer may read messages.
   */
  onOpenNode?: (nodeKey: string) => void;
  /**
   * Open a node's DM AND pre-fill the compose draft atomically. Must be used
   * (rather than separate select + setNewMessage calls) so the #4183
   * draft-scoping effect doesn't treat the switch as a conversation change
   * and wipe the pre-filled notification text.
   */
  onOpenDmWithDraft?: (nodeKey: string, message: string) => void;
  /** Source to inspect; defaults to the context source, else the primary. */
  sourceId?: string;
  /** Source type; anything not MeshCore gets the Meshtastic sections. */
  sourceType?: string;
  /** MeshCore device kind (number enum or label); the notification DM needs a Companion. */
  deviceType?: SecurityDeviceType;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ onOpenNode, onOpenDmWithDraft, sourceId: sourceIdProp, sourceType, deviceType }) => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  // Resolve a concrete sourceId (context source, else the primary) — the
  // security endpoints are source-scoped and now require one.
  const resolvedSourceId = useResolvedSourceId();
  const sourceId = sourceIdProp ?? resolvedSourceId;
  const caps = securityCapabilities(sourceType, deviceType);
  const { formatDate, formatRelativeTime } = useSecurityFormat();
  const isMeshCore = !!sourceType && !caps.lowEntropy;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const {
    issues, scannerStatus, loading, error, setError, notConnected, scanning, mismatchEvents, deadNodes, deadThresholdDays,
    deadNodesForbidden, findings, findingsForbidden, acknowledging, issuesForbidden, fetchSecurityData, triggerScan,
    handleExport, acknowledgeOwnKey,
  } = useSecurityData(sourceId, isMeshCore, caps);

  const canWrite = hasPermission('security', 'write');
  const canWriteNodes = hasPermission('nodes', 'write', { sourceId });
  const canEditSettings = hasPermission('settings', 'write');


  const handleNodeClick = useCallback((nodeKey: string) => {
    // Check if user has permission to view messages before navigating
    if (!hasPermission('messages', 'read')) {
      setError(t('security.no_permission_messages'));
      return;
    }
    onOpenNode?.(nodeKey);
  }, [onOpenNode, hasPermission, t, setError]);

  const handleOpenFindingNode = useCallback((nodeKey: string) => {
    if (!hasPermission('messages', 'read')) {
      setError(t('security.no_permission_messages'));
      return;
    }
    onOpenNode?.(nodeKey);
  }, [onOpenNode, hasPermission, t, setError]);

  /**
   * Open the node's DM with a pre-filled draft. The user reads it and presses
   * Send: nothing here sends. The host selects the node and sets the draft
   * atomically (survives the #4183 draft-scoping clear).
   */
  const openNotification = useCallback((node: SecurityNode, message: string) => {
    if (!hasPermission('messages', 'write', { sourceId })) {
      setError(t('security.no_permission_send'));
      return;
    }
    onOpenDmWithDraft?.(node.nodeKey, message);
  }, [onOpenDmWithDraft, hasPermission, sourceId, t, setError]);

  const handleSendNotification = useCallback((node: SecurityNode, duplicateCount?: number) => {
    if (node.keyIsLowEntropy) {
      openNotification(node, securityNotificationText('lowEntropy'));
    } else if (node.duplicateKeyDetected && duplicateCount) {
      openNotification(node, securityNotificationText('duplicateKey', { duplicateCount }));
    } else {
      openNotification(node, '');
    }
  }, [openNotification]);

  const sendKindNotification = useCallback((node: SecurityNode, kind: NotifyKind) => {
    openNotification(
      node,
      kind === 'excessivePackets'
        ? securityNotificationText('excessivePackets', { packetsPerHour: node.packetRatePerHour })
        : securityNotificationText('timeOffset', { offsetSeconds: node.timeOffsetSeconds }),
    );
  }, [openNotification]);

  /**
   * Whether a row gets the "Send notification" button. Needs a DM-capable
   * source (`caps.notifyDm`), a host that opens the draft, and messages:write on
   * this source. MeshCore also needs a chat contact (Repeaters and Room Servers
   * do not read DMs) that is in the radio's table, and warns when the DM would flood.
   */
  const notifyStateFor = useCallback(
    (node: SecurityNode): NotifyState =>
      notifyStateOf(node, caps.notifyDm && !!onOpenDmWithDraft && hasPermission('messages', 'write', { sourceId }), t),
    [caps.notifyDm, onOpenDmWithDraft, hasPermission, sourceId, t],
  );

  const getMismatchStatusLabel = (action: string): string => mismatchStatusLabel(action, t);

  if (loading) {
    return (
      <div className="security-tab">
        <div className="loading">{t('security.loading')}</div>
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="security-tab">
        <SourceNotConnectedNotice />
      </div>
    );
  }

  if (error) {
    return (
      <div className="security-tab">
        <div className="error">{t('security.error_loading', { error })}</div>
        <button onClick={fetchSecurityData}>{t('security.retry')}</button>
      </div>
    );
  }

  const deadNodesSection = caps.deadNodes && sourceId ? (
    <DeadNodesSection
      nodes={deadNodes}
      thresholdDays={deadThresholdDays}
      sourceId={sourceId}
      isMeshCore={isMeshCore}
      forbidden={deadNodesForbidden}
      canDelete={canWrite && canWriteNodes}
      canEditThreshold={canEditSettings}
      onChanged={fetchSecurityData}
    />
  ) : null;

  const toggleExpanded = (nodeKey: string) => setExpandedKey(prev => (prev === nodeKey ? null : nodeKey));
  const issueNodes = issues?.nodes ?? [];
  const newRowNotify = onOpenDmWithDraft
    ? {
        excessive: (node: SecurityNode) => sendKindNotification(node, 'excessivePackets'),
        offset: (node: SecurityNode) => sendKindNotification(node, 'timeOffset'),
      }
    : null;

  if (isMeshCore) {
    return (
      <div className="security-tab">
        <div className="security-header">
          <div className="header-content">
            <div>
              <h2>{t('security.title')}</h2>
              <p>{t('security.mc_description', 'Checks on the contacts this source has heard.')}</p>
            </div>
            {caps.scanner && !issuesForbidden && <SecurityExportMenu onExport={handleExport} />}
          </div>
        </div>
        {issuesForbidden ? (
          <p className="no-issues" data-testid="security-issues-forbidden">
            {t('security.mc_no_node_access', 'You do not have access to this source\'s nodes.')}
          </p>
        ) : (
          <>
            {caps.scanner && (
              <ScannerStatusCard status={scannerStatus} canWrite={canWrite} scanning={scanning} onScan={triggerScan} />
            )}
            {issues?.packetLogEnabled === false && (
              <p className={securityStyles.hint} data-testid="security-packet-log-off">
                {t('security.mc_packet_log_off', 'Enable the MeshCore Packet Monitor to measure rates')}
              </p>
            )}
            {caps.digest && canWrite && <SecurityDigestCard sourceId={sourceId} />}
            {issues && (
              <div className="security-stats">
                <div className="stat-card total">
                  <div className="stat-value">{issues.total}</div>
                  <div className="stat-label">{t('security.nodes_with_issues')}</div>
                </div>
                {caps.spam && (
                  <div className="stat-card excessive-packets">
                    <div className="stat-value">{issues.excessivePacketsCount}</div>
                    <div className="stat-label">{t('security.have_excessive_packets')}</div>
                  </div>
                )}
                {caps.timeOffset && (
                  <div className="stat-card time-offset">
                    <div className="stat-value">{issues.timeOffsetCount}</div>
                    <div className="stat-label">{t('security.have_time_offset')}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {findingsForbidden ? (
          <p className="no-issues" data-testid="security-findings-forbidden">
            {t('security.mc_no_node_access', 'You do not have access to this source\'s nodes.')}
          </p>
        ) : findings && (
          <>
            {caps.ownKeyChange && (
              <OwnKeyChangeCard
                ownKey={findings.ownKey}
                canAcknowledge={canWrite}
                acknowledging={acknowledging}
                onAcknowledge={acknowledgeOwnKey}
              />
            )}
            {caps.pathHashCollisions && (
              <PathHashCollisionsSection collisions={findings.pathHashCollisions} onOpenNode={onOpenNode ? handleOpenFindingNode : undefined} />
            )}
            {caps.advertSignatures && (
              <AdvertSignatureSection failures={findings.signatureFailures} onOpenNode={onOpenNode ? handleOpenFindingNode : undefined} />
            )}
            {caps.nameReuse && (
              <NameReuseSection groups={findings.nameReuse} onOpenNode={onOpenNode ? handleOpenFindingNode : undefined} />
            )}
          </>
        )}
        {issues && !issuesForbidden && (
          <>
            {caps.spam && (
              <>
                <TopBroadcastersTable broadcasters={issues.topBroadcasters} onOpenNode={handleNodeClick} />
                <ExcessivePacketsSection
                  count={issues.excessivePacketsCount}
                  nodes={issueNodes}
                  expandedKey={expandedKey}
                  onToggle={toggleExpanded}
                  onOpenNode={handleNodeClick}
                  notifyState={notifyStateFor}
                  onNotify={newRowNotify?.excessive}
                />
              </>
            )}
            {caps.timeOffset && (
              <TimeOffsetSection
                count={issues.timeOffsetCount}
                nodes={issueNodes}
                expandedKey={expandedKey}
                onToggle={toggleExpanded}
                onOpenNode={handleNodeClick}
                notifyState={notifyStateFor}
                onNotify={newRowNotify?.offset}
              />
            )}
          </>
        )}
        {deadNodesSection}
      </div>
    );
  }

  return (
    <div className="security-tab">
      <div className="security-header">
        <div className="header-content">
          <div>
            <h2>{t('security.title')}</h2>
            <p>{t('security.description')}</p>
          </div>
          <SecurityExportMenu onExport={handleExport} />
        </div>
      </div>

      <ScannerStatusCard status={scannerStatus} canWrite={canWrite} scanning={scanning} onScan={triggerScan} />

      {/* Security Digest */}
      {canWrite && <SecurityDigestCard sourceId={sourceId} />}

      {/* Summary Statistics */}
      <div className="security-stats">
        <div className="stat-card total">
          <div className="stat-value">{issues?.total || 0}</div>
          <div className="stat-label">{t('security.nodes_with_issues')}</div>
        </div>
        <div className="stat-card low-entropy">
          <div className="stat-value">{issues?.lowEntropyCount || 0}</div>
          <div className="stat-label">{t('security.have_low_entropy')}</div>
        </div>
        <div className="stat-card duplicate">
          <div className="stat-value">{issues?.duplicateKeyCount || 0}</div>
          <div className="stat-label">{t('security.have_duplicate')}</div>
        </div>
        <div className="stat-card excessive-packets">
          <div className="stat-value">{issues?.excessivePacketsCount || 0}</div>
          <div className="stat-label">{t('security.have_excessive_packets')}</div>
        </div>
        <div className="stat-card time-offset">
          <div className="stat-value">{issues?.timeOffsetCount || 0}</div>
          <div className="stat-label">{t('security.have_time_offset')}</div>
        </div>
      </div>
      {issues && issues.total > 0 && (issues.lowEntropyCount + issues.duplicateKeyCount > issues.total) && (
        <div className="info-note" style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', fontStyle: 'italic'}}>
          {t('security.both_issues_note')}
        </div>
      )}

      {/* Issues List */}
      <div className="security-issues">
        {!issues || issues.total === 0 ? (
          <div className="no-issues">
            <p>{t('security.no_issues')}</p>
            <p className="help-text">
              {t('security.scanner_checks')}
            </p>
          </div>
        ) : (
          <>
            {/* Low-Entropy Keys Section */}
            {issues.lowEntropyCount > 0 && (
              <div className="issues-section">
                <h3>{t('security.low_entropy_count', { count: issues.lowEntropyCount })}</h3>
                <div className="issues-list">
                  {issues.nodes.filter(node => node.keyIsLowEntropy).map((node) => (
              <div key={node.nodeKey} className="issue-card">
                <div
                  className="issue-header"
                  onClick={() => toggleExpanded(node.nodeKey)}
                >
                  <div className="node-info">
                    <div className="node-name">
                      <span
                        className="node-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNodeClick(node.nodeKey);
                        }}
                      >
                        {node.longName || node.shortName} ({node.shortName})
                      </span>
                    </div>
                    <div className="node-id">
                      Node #{node.nodeNum.toString(16).toUpperCase()}
                      {node.hwModel !== undefined && node.hwModel !== 0 && (
                        <span className="hw-model"> - {getHardwareModelName(node.hwModel)}</span>
                      )}
                    </div>
                    <div className="node-last-seen">
                      {t('security.last_seen', { time: formatRelativeTime(node.lastHeard) })}
                    </div>
                  </div>
                  <div className="issue-types">
                    {node.keyIsLowEntropy && (
                      <span className="badge low-entropy">{t('security.badge_low_entropy')}</span>
                    )}
                    {node.duplicateKeyDetected && (
                      <span className="badge duplicate">{t('security.badge_duplicate')}</span>
                    )}
                  </div>
                  <button
                    className="send-notification-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendNotification(node);
                    }}
                    title={t('security.send_notification_title')}
                  >
                    <UiIcon name="forward" size={14} />
                  </button>
                  <div className="expand-icon">
                    <UiIcon name={expandedKey === node.nodeKey ? 'chevronDown' : 'forward'} />
                  </div>
                </div>

                {expandedKey === node.nodeKey && (
                  <div className="issue-details">
                    <div className="detail-row">
                      <span className="detail-label">{t('security.last_heard')}:</span>
                      <span className="detail-value">{formatDate(node.lastHeard)}</span>
                    </div>
                    {node.keySecurityIssueDetails && (
                      <div className="detail-row">
                        <span className="detail-label">{t('security.details')}:</span>
                        <span className="detail-value">{node.keySecurityIssueDetails}</span>
                      </div>
                    )}
                    {node.publicKey && (
                      <div className="detail-row">
                        <span className="detail-label">{t('security.public_key')}:</span>
                        <span className="detail-value key-hash">
                          {node.publicKey.substring(0, 32)}...
                        </span>
                      </div>
                    )}
                    <div className="detail-row recommendations">
                      <span className="detail-label">{t('security.recommendations')}:</span>
                      <ul>
                        {node.keyIsLowEntropy && (
                          <li>{t('security.recommendation_weak_key')}</li>
                        )}
                        {node.duplicateKeyDetected && (
                          <li>{t('security.recommendation_shared_key')}</li>
                        )}
                        <li>{t('security.recommendation_reconfigure')}</li>
                        <li>{t('security.recommendation_docs')}</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
                </div>
              </div>
            )}

            {/* Duplicate Keys Section - Grouped by Public Key */}
            {issues.duplicateKeyCount > 0 && (
              <div className="issues-section">
                <h3>{t('security.duplicate_count', { count: issues.duplicateKeyCount })}</h3>
                {groupDuplicateKeyNodes(issues.nodes).map((group, groupIndex) => (
                  <div key={groupIndex} className="duplicate-group">
                    <div className="duplicate-group-header">
                      <div className="group-title">
                        <span className="badge duplicate">{t('security.shared_key')}</span>
                        <span className="key-hash">{group.publicKey.substring(0, 32)}...</span>
                      </div>
                      <div className="node-count">{t('security.nodes_sharing', { count: group.nodes.length })}</div>
                    </div>
                    <div className="duplicate-node-list">
                      {group.nodes.map((node) => (
                        <div key={node.nodeKey} className="duplicate-node-item">
                          <div className="duplicate-node-info">
                            <span
                              className="node-link"
                              onClick={() => handleNodeClick(node.nodeKey)}
                            >
                              {node.longName || node.shortName} ({node.shortName})
                            </span>
                            <div className="node-last-seen">
                              {t('security.last_seen', { time: formatRelativeTime(node.lastHeard) })}
                            </div>
                          </div>
                          <div className="duplicate-node-actions">
                            <span className="node-id">
                              #{node.nodeNum.toString(16).toUpperCase()}
                              {node.hwModel !== undefined && node.hwModel !== 0 && (
                                <span className="hw-model"> - {getHardwareModelName(node.hwModel)}</span>
                              )}
                            </span>
                            <button
                              className="send-notification-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendNotification(node, group.nodes.length - 1);
                              }}
                              title={t('security.send_notification_title')}
                            >
                              <UiIcon name="forward" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="group-recommendations">
                      <strong>{t('security.group_recommendation')}</strong> {t('security.group_recommendation_text')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Top Broadcasters Table */}
            <TopBroadcastersTable broadcasters={issues.topBroadcasters} onOpenNode={handleNodeClick} />

            {/* Excessive Packets Section */}
            <ExcessivePacketsSection
              count={issues.excessivePacketsCount}
              nodes={issueNodes}
              expandedKey={expandedKey}
              onToggle={toggleExpanded}
              onOpenNode={handleNodeClick}
              notifyState={notifyStateFor}
              onNotify={newRowNotify?.excessive}
            />

            {/* Time Offset Section */}
            <TimeOffsetSection
              count={issues.timeOffsetCount}
              nodes={issueNodes}
              expandedKey={expandedKey}
              onToggle={toggleExpanded}
              onOpenNode={handleNodeClick}
              notifyState={notifyStateFor}
              onNotify={newRowNotify?.offset}
            />
            {deadNodesSection}

            {/* Key Mismatch Events Section */}
            <div className="issues-section">
              <h3>{t('security.key_mismatch_title')}</h3>
              {mismatchEvents.length === 0 ? (
                <div className="no-issues">
                  <p>{t('security.key_mismatch_empty')}</p>
                </div>
              ) : (
                <div className="security-table-scroll">
                  <table className="top-broadcasters-table">
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
                      {mismatchEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{event.nodeName || `!${event.nodeNum.toString(16).padStart(8, '0')}`}</td>
                          <td>{new Date(event.timestamp).toLocaleString()}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.oldKeyFragment || '-'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.newKeyFragment || '-'}</td>
                          <td>{getMismatchStatusLabel(event.action)}</td>
                          <td>{event.action === 'fixed' ? new Date(event.timestamp).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
