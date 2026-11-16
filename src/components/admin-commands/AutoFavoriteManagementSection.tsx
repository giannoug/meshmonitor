import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLE_NAMES } from '../../constants/index';
import { SELECTABLE_ROLES, useAutoFavoriteTarget } from './useAutoFavoriteTarget';
import { UiIcon, type UiIconName } from '../icons';
import { NumberInput } from '../common/NumberInput';
import { NumberInputScope } from '../common/NumberInputScope';
import { useNumberInputScope } from '../common/numberInputScopeContext';

/**
 * Automated Remote Favorites Management (issue #2608).
 *
 * Per-target config UI shown on the Remote Admin tab. Lets the operator have
 * MeshMonitor keep the favorites list up to date on a remote infrastructure
 * node — discovering its neighbors from NeighborInfo and/or passing traceroutes
 * and blindly pushing set-favorite admin commands over LoRa.
 */

interface AutoFavoriteManagementSectionProps {
  selectedNodeNum: number | null;
  sourceId: string | null;
  nodes: any[];
}


const AutoFavoriteManagementSection: React.FC<AutoFavoriteManagementSectionProps> = ({ selectedNodeNum, sourceId, nodes }) => {
  const { t } = useTranslation();
  const nodeNameByNum = useMemo(() => {
    const map = new Map<number, string>();
    for (const n of nodes) {
      if (typeof n.nodeNum === 'number') map.set(n.nodeNum, n.longName || n.shortName || `!${n.nodeNum.toString(16).padStart(8, '0')}`);
    }
    return map;
  }, [nodes]);

  const nodeLabel = useCallback((nodeNum: number) => {
    return nodeNameByNum.get(nodeNum) || `!${nodeNum.toString(16).padStart(8, '0')}`;
  }, [nodeNameByNum]);

  const { config, isLoading, isSaving, isRunning, update, toggleRole, handleSave: save, handleRunNow: run } = useAutoFavoriteTarget(selectedNodeNum, sourceId);

  // #5649: these are mesh timers. A blank or below-minimum value is never saved.
  const numberScope = useNumberInputScope();
  const numbersInvalid = numberScope.invalid;

  const handleSave = useCallback(async () => {
    if (numbersInvalid) return;
    await save();
  }, [numbersInvalid, save]);

  const handleRunNow = useCallback(async () => {
    if (selectedNodeNum === null || !sourceId) return;
    if (!confirm(t('auto_favorite.run_now_confirm', 'Run one discovery + favorite cycle now? This sends several packets over the mesh.'))) {
      return;
    }
    await run();
  }, [selectedNodeNum, sourceId, t, run]);

  const formatTime = (ts: number | null) => {
    if (!ts) return t('auto_favorite.never', 'Never');
    return new Date(ts).toLocaleString();
  };

  // Render a small badge for the most recent favorite-command ACK result.
  const ackBadge = (status: string | null) => {
    if (!status) return null;
    let color: string;
    let label: string;
    let icon: UiIconName;
    if (status === 'confirmed') { color = 'var(--color-success)'; icon = 'check'; label = t('auto_favorite.ack_confirmed', 'confirmed'); }
    else if (status === 'timeout') { color = 'var(--color-warning)'; icon = 'timer'; label = t('auto_favorite.ack_timeout', 'no ack'); }
    else { color = 'var(--color-error)'; icon = 'error'; label = status; }
    return (
      <span title={t('auto_favorite.ack_tooltip', 'Result of the last favorite command’s routing ACK')}
        style={{ color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        <UiIcon name={icon} size={13} /> {label}
      </span>
    );
  };

  const checkboxRow = (label: string, description: string, checked: boolean, onChange: (v: boolean) => void) => (
    <div className="setting-item">
      {/* flexDirection:'row' overrides the global `.setting-item label`
          column layout so the checkbox sits beside the label, not above it. */}
      <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', marginBottom: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ marginTop: '0.2rem', flexShrink: 0 }}
        />
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span>{label}</span>
          <span className="setting-description">{description}</span>
        </span>
      </label>
    </div>
  );

  const numberRow = (label: string, description: string, value: number, min: number, onChange: (v: number) => void) => (
    <div className="setting-item">
      <label>
        {label}
        <span className="setting-description">{description}</span>
      </label>
      <NumberInput
        integer
        className="setting-input"
        min={min}
        value={value}
        onChange={onChange}
        style={{ maxWidth: '160px' }}
      />
    </div>
  );

  return (
    <NumberInputScope scope={numberScope}>
    <div id="admin-auto-favorites" className="settings-section">
      <h3><UiIcon name="favorite" /> {t('auto_favorite.title', 'Automatic Favorites Management')}</h3>

      <p style={{ color: 'var(--color-text-subtle)', marginBottom: '0.75rem' }}>
        {t('auto_favorite.description',
          'Automatically keep the favorites list up to date on this remote node. MeshMonitor discovers the node’s neighbors (from NeighborInfo broadcasts and/or traceroutes that pass through it) and sends set-favorite commands via Remote Admin, preserving zero-hop routing as your mesh changes.')}
      </p>

      <div style={{
        border: '1px solid var(--color-surface-active)',
        background: 'var(--color-bg-raised)',
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        color: 'var(--color-text-muted)',
        fontSize: '0.9rem',
        lineHeight: 1.5,
      }}>
        <strong><UiIcon name="alert" /> {t('auto_favorite.caveats_title', 'Before you enable this')}</strong>
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          <li>
            {t('auto_favorite.caveat_ack',
              'Each favorite command is acknowledged: the remote node returns a routing ACK confirming it received and processed the command (shown per favorite below), or an error if it was rejected. One caveat — the ACK confirms the remote processed the request; if the favorited node is not yet in the remote node’s database the change is a no-op there. The "re-favorite per cycle" option re-sends previously assigned favorites (un-confirmed ones first) to recover any whose command was dropped or never acknowledged.')}
          </li>
          <li>
            {t('auto_favorite.caveat_heavy',
              'This is a heavy operation. Each favorite requires multiple packets per transaction (including a session-passkey handshake) plus a wait for the ACK, so use it sparingly — keep the per-cycle limits low and the interval long.')}
          </li>
        </ul>
      </div>

      {selectedNodeNum === null || !sourceId ? (
        <p style={{ color: 'var(--color-text-subtle)' }}>
          {t('auto_favorite.select_target', 'Select a target node above to configure automatic favorites management.')}
        </p>
      ) : isLoading || !config ? (
        <p style={{ color: 'var(--color-text-subtle)' }}>{t('auto_favorite.loading', 'Loading…')}</p>
      ) : (
        <>
          {checkboxRow(
            t('auto_favorite.enabled', 'Enable automatic favorites management'),
            t('auto_favorite.enabled_desc', 'Run discovery + favorite cycles for this target on the schedule below.'),
            config.enabled,
            (v) => update({ enabled: v })
          )}

          <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            {t('auto_favorite.discovery_modes', 'Discovery modes')}
          </h4>
          {checkboxRow(
            t('auto_favorite.use_neighborinfo', 'Use NeighborInfo'),
            t('auto_favorite.use_neighborinfo_desc', 'Periodically request NeighborInfo from the target and favorite newly discovered neighbors. The target must have the NeighborInfo module enabled.'),
            config.useNeighborInfo,
            (v) => update({ useNeighborInfo: v })
          )}
          {config.useNeighborInfo && numberRow(
            t('auto_favorite.max_neighbor_age', 'Maximum neighbor age (hours)'),
            t('auto_favorite.max_neighbor_age_desc', 'If a NeighborInfo record for this node is already on file and newer than this, reuse it instead of requesting another — saving airtime. Set to 0 to always request fresh. Default 24 hours.'),
            config.maxNeighborAgeHours, 0,
            (v) => update({ maxNeighborAgeHours: v })
          )}
          {checkboxRow(
            t('auto_favorite.use_traceroutes', 'Use Traceroutes'),
            t('auto_favorite.use_traceroutes_desc', 'Identify the target’s neighbors from any traceroutes that pass through it, and favorite them.'),
            config.useTraceroutes,
            (v) => update({ useTraceroutes: v })
          )}

          <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            {t('auto_favorite.timing_limits', 'Timing & limits')}
          </h4>
          {numberRow(
            t('auto_favorite.interval_hours', 'Cycle interval (hours)'),
            t('auto_favorite.interval_hours_desc', 'How often to request neighbor info and run a favorite cycle. Default 24 hours.'),
            config.intervalHours, 1,
            (v) => update({ intervalHours: v })
          )}
          {numberRow(
            t('auto_favorite.max_new', 'Maximum new neighbors per cycle'),
            t('auto_favorite.max_new_desc', 'Cap on how many newly discovered neighbors are favorited each cycle. Default 1.'),
            config.maxNewPerCycle, 0,
            (v) => update({ maxNewPerCycle: v })
          )}
          {numberRow(
            t('auto_favorite.max_refavorite', 'Maximum re-favorite per cycle'),
            t('auto_favorite.max_refavorite_desc', 'Re-send this many previously assigned favorites each cycle to re-assert assignments that may have been dropped. Default 1.'),
            config.maxRefavoritePerCycle, 0,
            (v) => update({ maxRefavoritePerCycle: v })
          )}

          <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            {t('auto_favorite.eligible_roles', 'Eligible neighbor roles')}
          </h4>
          <p className="setting-description" style={{ marginTop: 0 }}>
            {t('auto_favorite.eligible_roles_desc', 'Only neighbors with one of these roles will be favorited.')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            {SELECTABLE_ROLES.map((role) => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.eligibleRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span>{ROLE_NAMES[role] || `Role ${role}`}</span>
              </label>
            ))}
          </div>

          <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
            {t('auto_favorite.status', 'Status')}
          </h4>
          <div className="setting-description" style={{ marginBottom: '0.75rem' }}>
            <div>{t('auto_favorite.last_run', 'Last cycle')}: {formatTime(config.lastRunAt)}</div>
            <div>{t('auto_favorite.last_neighbor_request', 'Last NeighborInfo request')}: {formatTime(config.lastNeighborRequestAt)}</div>
            <div>{t('auto_favorite.managed_count', 'Favorites managed on this target')}: {config.assignments.length}</div>
          </div>
          {config.assignments.length > 0 && (
            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid var(--color-surface-hover)',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}>
              {config.assignments.map((a) => (
                <div key={a.favoriteNodeNum} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.75rem',
                  borderBottom: '1px solid var(--color-surface)',
                  fontSize: '0.85rem',
                }}>
                  <span>{nodeLabel(a.favoriteNodeNum)}</span>
                  <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    {ackBadge(a.lastAckStatus)}
                    <span style={{ color: 'var(--color-text-subtle)' }}>
                      {t('auto_favorite.last_sent', 'last sent')}: {formatTime(a.lastAssignedAt)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving || numbersInvalid}
              style={{ opacity: isSaving || numbersInvalid ? 0.6 : 1 }}
            >
              {isSaving ? t('auto_favorite.saving', 'Saving…') : t('auto_favorite.save', 'Save Settings')}
            </button>
            <button
              className="btn"
              onClick={handleRunNow}
              disabled={isRunning}
              style={{ opacity: isRunning ? 0.6 : 1 }}
              title={t('auto_favorite.run_now_title', 'Run one cycle immediately (sends packets over the mesh)')}
            >
              {isRunning ? t('auto_favorite.running', 'Running…') : <><UiIcon name="play" /> {t('auto_favorite.run_now', 'Run Cycle Now')}</>}
            </button>
          </div>
        </>
      )}
    </div>
    </NumberInputScope>
  );
};

export default AutoFavoriteManagementSection;
