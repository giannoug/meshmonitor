import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCsrfFetch } from '../hooks/useCsrfFetch';
import { useSourceQuery } from '../hooks/useSourceQuery';
import { useSaveBar } from '../hooks/useSaveBar';
import { useToast } from './ToastContainer';
import { UiIcon } from './icons';
import { NumberInput } from './common/NumberInput';
import { NumberInputScope } from './common/NumberInputScope';
import { useNumberInputScope } from './common/numberInputScopeContext';
import { getRoleName } from '../utils/nodeHelpers';
import {
  airtimeStatusView,
  formatPercent,
  nodeLabel,
  type AirtimeSource,
  type AirtimeStatus,
  type NeighborMode,
} from './airtimeCutoffStatus';

interface AirtimeCutoffSectionProps {
  baseUrl: string;
}

/** An infrastructure node the manual picker may offer (never MQTT-heard). */
interface AirtimeCandidate {
  nodeNum: number;
  nodeId: string | null;
  longName: string | null;
  shortName: string | null;
  role: number;
  hopsAway: number | null;
  rssi: number | null;
  channelUtilization: number | null;
  channelUtilizationAt: number | null;
}


const DEFAULT_THRESHOLD = 30;
const DEFAULT_SOURCE: AirtimeSource = 'local';
const DEFAULT_MAX_HOPS = 0;
const MAX_HOPS_CAP = 7;
const STATUS_POLL_MS = 15000;
const DEFAULT_MODE: NeighborMode = 'auto';
// Issue #6007: average 3-5 nodes; the server clamps to the same range.
const MIN_SAMPLES = 3;
const MAX_SAMPLES = 5;
const DEFAULT_SAMPLES = 3;

const clampSamples = (n: number): number =>
  Number.isFinite(n) ? Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.floor(n))) : DEFAULT_SAMPLES;

/** Parse the stored manual pick list (JSON array of node numbers). */
const parseNodeList = (raw: unknown): number[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(Number).filter((n, i, all) => Number.isInteger(n) && n > 0 && all.indexOf(n) === i);
  } catch {
    return [];
  }
};

const sameList = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);


/**
 * "Cutoff Airtime Utilization Threshold" — pauses all transmitting automations
 * (auto-traceroute, auto-announce, timers, etc.) whenever the connected node's
 * self-reported Channel Utilization exceeds the configured threshold, so bots
 * back off while real traffic is heavy. 0 disables the feature.
 */
const AirtimeCutoffSection: React.FC<AirtimeCutoffSectionProps> = ({ baseUrl }) => {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const sourceQuery = useSourceQuery();
  const { showToast } = useToast();

  const [localThreshold, setLocalThreshold] = useState(DEFAULT_THRESHOLD);
  const [initialThreshold, setInitialThreshold] = useState<number | null>(null);
  const [localSource, setLocalSource] = useState<AirtimeSource>(DEFAULT_SOURCE);
  const [initialSource, setInitialSource] = useState<AirtimeSource | null>(null);
  const [localMaxHops, setLocalMaxHops] = useState(DEFAULT_MAX_HOPS);
  const [initialMaxHops, setInitialMaxHops] = useState<number | null>(null);
  const [localMode, setLocalMode] = useState<NeighborMode>(DEFAULT_MODE);
  const [initialMode, setInitialMode] = useState<NeighborMode | null>(null);
  const [localSamples, setLocalSamples] = useState(DEFAULT_SAMPLES);
  const [initialSamples, setInitialSamples] = useState<number | null>(null);
  const [localNodes, setLocalNodes] = useState<number[]>([]);
  const [initialNodes, setInitialNodes] = useState<number[] | null>(null);
  const [candidates, setCandidates] = useState<AirtimeCandidate[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<AirtimeStatus | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`);
      if (res.ok) {
        const settings = await res.json();
        const raw = parseInt(settings.automationAirtimeCutoffThreshold ?? String(DEFAULT_THRESHOLD), 10);
        const threshold = Number.isFinite(raw) && raw >= 0 && raw <= 100 ? raw : DEFAULT_THRESHOLD;
        const source: AirtimeSource = settings.automationAirtimeCutoffSource === 'neighbors' ? 'neighbors' : DEFAULT_SOURCE;
        const rawHops = parseInt(settings.automationAirtimeCutoffNeighborMaxHops ?? String(DEFAULT_MAX_HOPS), 10);
        const maxHops = Number.isFinite(rawHops) && rawHops >= 0 && rawHops <= MAX_HOPS_CAP ? rawHops : DEFAULT_MAX_HOPS;
        setLocalThreshold(threshold);
        setInitialThreshold(threshold);
        setLocalSource(source);
        setInitialSource(source);
        setLocalMaxHops(maxHops);
        setInitialMaxHops(maxHops);
        const mode: NeighborMode = settings.automationAirtimeCutoffNeighborMode === 'manual' ? 'manual' : DEFAULT_MODE;
        const samples = clampSamples(parseInt(settings.automationAirtimeCutoffNeighborSampleCount ?? String(DEFAULT_SAMPLES), 10));
        const nodes = parseNodeList(settings.automationAirtimeCutoffNeighborNodes);
        setLocalMode(mode);
        setInitialMode(mode);
        setLocalSamples(samples);
        setInitialSamples(samples);
        setLocalNodes(nodes);
        setInitialNodes(nodes);
      }
    } catch (error) {
      console.error('Failed to fetch airtime cutoff settings:', error);
    }
  }, [baseUrl, csrfFetch, sourceQuery]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/automation/airtime-status${sourceQuery}`);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch airtime cutoff status:', error);
    }
  }, [baseUrl, csrfFetch, sourceQuery]);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await csrfFetch(`${baseUrl}/api/automation/airtime-candidates${sourceQuery}`);
      if (res.ok) {
        const body = await res.json();
        setCandidates(Array.isArray(body?.data?.candidates) ? body.data.candidates : []);
      }
    } catch (error) {
      console.error('Failed to fetch airtime cutoff candidates:', error);
    }
  }, [baseUrl, csrfFetch, sourceQuery]);

  useEffect(() => {
    void fetchSettings();
    void fetchStatus();
  }, [fetchSettings, fetchStatus]);

  // The manual picker needs the eligible nodes; load them only when shown.
  const pickerShown = localSource === 'neighbors' && localMode === 'manual';
  useEffect(() => {
    if (pickerShown) void fetchCandidates();
  }, [pickerShown, fetchCandidates]);

  // Poll the live status so the banner reflects current utilization.
  useEffect(() => {
    const id = setInterval(fetchStatus, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    if (
      initialThreshold === null || initialSource === null || initialMaxHops === null ||
      initialMode === null || initialSamples === null || initialNodes === null
    ) return;
    setHasChanges(
      localThreshold !== initialThreshold ||
      localSource !== initialSource ||
      localMaxHops !== initialMaxHops ||
      localMode !== initialMode ||
      localSamples !== initialSamples ||
      !sameList(localNodes, initialNodes),
    );
  }, [
    localThreshold, initialThreshold, localSource, initialSource, localMaxHops, initialMaxHops,
    localMode, initialMode, localSamples, initialSamples, localNodes, initialNodes,
  ]);

  const manualCountInvalid = localSource === 'neighbors' && localMode === 'manual' &&
    (localNodes.length < MIN_SAMPLES || localNodes.length > MAX_SAMPLES);

  const handleSave = useCallback(async () => {
    if (manualCountInvalid) {
      showToast(
        t('automation.airtime_cutoff.manual_count_error', 'Pick {{min}} to {{max}} infrastructure nodes for manual mode', { min: MIN_SAMPLES, max: MAX_SAMPLES }),
        'error',
      );
      return;
    }
    setIsSaving(true);
    const samples = clampSamples(localSamples);
    try {
      const response = await csrfFetch(`${baseUrl}/api/settings${sourceQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automationAirtimeCutoffThreshold: String(localThreshold),
          automationAirtimeCutoffSource: localSource,
          automationAirtimeCutoffNeighborMaxHops: String(localMaxHops),
          automationAirtimeCutoffNeighborMode: localMode,
          automationAirtimeCutoffNeighborSampleCount: String(samples),
          automationAirtimeCutoffNeighborNodes: JSON.stringify(localNodes),
        }),
      });
      if (response.ok) {
        setInitialThreshold(localThreshold);
        setInitialSource(localSource);
        setInitialMaxHops(localMaxHops);
        setInitialMode(localMode);
        setLocalSamples(samples);
        setInitialSamples(samples);
        setInitialNodes(localNodes);
        setHasChanges(false);
        showToast(t('automation.airtime_cutoff.saved', 'Airtime cutoff settings saved'), 'success');
        void fetchStatus();
      } else {
        showToast(t('automation.airtime_cutoff.save_error', 'Failed to save settings'), 'error');
      }
    } catch {
      showToast(t('automation.airtime_cutoff.save_error', 'Failed to save settings'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    baseUrl, csrfFetch, sourceQuery, localThreshold, localSource, localMaxHops,
    localMode, localSamples, localNodes, manualCountInvalid, showToast, t, fetchStatus,
  ]);

  const resetChanges = useCallback(() => {
    if (initialThreshold !== null) setLocalThreshold(initialThreshold);
    if (initialSource !== null) setLocalSource(initialSource);
    if (initialMaxHops !== null) setLocalMaxHops(initialMaxHops);
    if (initialMode !== null) setLocalMode(initialMode);
    if (initialSamples !== null) setLocalSamples(initialSamples);
    if (initialNodes !== null) setLocalNodes(initialNodes);
  }, [initialThreshold, initialSource, initialMaxHops, initialMode, initialSamples, initialNodes]);

  const togglePick = useCallback((nodeNum: number) => {
    setLocalNodes((prev) => {
      if (prev.includes(nodeNum)) return prev.filter((n) => n !== nodeNum);
      if (prev.length >= MAX_SAMPLES) return prev;
      return [...prev, nodeNum];
    });
  }, []);

  const numberScope = useNumberInputScope();
  useSaveBar({
    numberScope,
    id: 'airtime-cutoff',
    sectionName: t('automation.airtime_cutoff.title', 'Cutoff Airtime Utilization Threshold'),
    hasChanges,
    isSaving,
    onSave: handleSave,
    onDismiss: resetChanges,
  });

  // Today's status words, shared with the Workspace page (airtimeCutoffStatus, Task 8.3 Rule X).
  const view = airtimeStatusView(t, status, { threshold: localThreshold, source: localSource, maxHops: localMaxHops });
  const { disabled, gated, fillLine } = view;

  const formatAge = (at: number | null): string => {
    if (at == null) return t('automation.airtime_cutoff.age_unknown', 'no reading');
    const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (mins < 60) return t('automation.airtime_cutoff.age_minutes', '{{n}} min ago', { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 48) return t('automation.airtime_cutoff.age_hours', '{{n}} h ago', { n: hours });
    return t('automation.airtime_cutoff.age_days', '{{n}} d ago', { n: Math.round(hours / 24) });
  };

  // Banner colour: red when paused, green when active, neutral when disabled/unknown.
  // The neutral sibling of the error/success roles below. Uses the text role
  // because the value lands on `color:` as well as the two border rules.
  const bannerColor = disabled
    ? 'var(--color-text-faint)'
    : gated
      ? 'var(--color-error)'
      : 'var(--color-success)';

  return (
    <NumberInputScope scope={numberScope}>
    <>
      <div className="automation-section-header" style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem 1.25rem',
        background: 'var(--color-surface-hover)',
        border: '1px solid var(--color-surface-active)',
        borderRadius: '8px'
      }}>
        <h2 style={{ margin: 0 }}>
          {t('automation.airtime_cutoff.title', 'Cutoff Airtime Utilization Threshold')}
        </h2>
      </div>

      <div className="settings-section">
        <p style={{ marginLeft: '0.25rem', marginBottom: '1rem', color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
          {t('automation.airtime_cutoff.description',
            'Pauses all automations (auto-traceroute, auto-announce, timers, etc.) whenever the connected node\'s Channel Utilization rises above this threshold, so bots stop adding traffic while the mesh is busy with real activity. Automations resume automatically once utilization drops back below the threshold. Set to 0 to disable.')}
        </p>

        {/* Live status banner */}
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.6rem 1rem',
          background: 'var(--color-surface)',
          border: `1px solid ${bannerColor}`,
          borderLeft: `4px solid ${bannerColor}`,
          borderRadius: '6px',
          color: bannerColor,
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {!disabled && <UiIcon name={gated ? 'pause' : 'check'} size={15} style={{ marginRight: '0.4rem' }} />}
          {view.line}
          {view.suffix && (
            <span style={{ fontWeight: 400, opacity: 0.85 }}>
              {' '}{view.suffix}
            </span>
          )}
          {fillLine && (
            <div data-testid="airtime-fill-line" style={{ fontWeight: 400, marginTop: '0.25rem' }}>{fillLine}</div>
          )}
          {view.skippedLine && (
            <div data-testid="airtime-skipped-line" style={{ fontWeight: 400, marginTop: '0.25rem' }}>
              {view.skippedLine}
            </div>
          )}
        </div>

        {/* Infrastructure nodes contributing to the neighbour-averaged reading */}
        {view.contributors.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '0.4rem', color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 600 }}>
              {t('automation.airtime_cutoff.contributors_label', 'Infrastructure nodes in calculation')}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {view.contributors.map((node) => {
                const name = node.name;
                return (
                  <li
                    key={node.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.45rem 0.75rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-surface-active)',
                      borderRadius: '6px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                    <span style={{ color: 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>
                      {node.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Measurement source */}
        <div className="setting-item">
          <label htmlFor="airtimeCutoffSource">
            {t('automation.airtime_cutoff.source_label', 'Measure Channel Utilization from')}
            <span className="setting-description">
              {t('automation.airtime_cutoff.source_hint',
                'Local node uses the connected node\'s own Channel Utilization. Nearby infrastructure averages the Channel Utilization of nearby router/repeater nodes (the strongest RSSI, or the ones you pick) — useful when your node is well-placed and under-reports the wider mesh.')}
            </span>
          </label>
          <select
            id="airtimeCutoffSource"
            value={localSource}
            onChange={(e) => setLocalSource(e.target.value === 'neighbors' ? 'neighbors' : 'local')}
            className="setting-input"
          >
            <option value="local">{t('automation.airtime_cutoff.source_local_option', 'Local node (own Channel Utilization)')}</option>
            <option value="neighbors">{t('automation.airtime_cutoff.source_neighbors_option', 'Nearby infrastructure (average of routers)')}</option>
          </select>
        </div>

        {/* Neighbour selection mode (issue #6007) */}
        {localSource === 'neighbors' && (
          <div className="setting-item">
            <label htmlFor="airtimeCutoffNeighborMode">
              {t('automation.airtime_cutoff.mode_label', 'Choose infrastructure nodes')}
              <span className="setting-description">
                {t('automation.airtime_cutoff.mode_hint',
                  'Auto averages the strongest-RSSI routers. Manual averages only the nodes you pick. Nodes heard over MQTT never count. When fewer nodes qualify than wanted, the higher of the local Channel Utilization and their average is used.')}
              </span>
            </label>
            <select
              id="airtimeCutoffNeighborMode"
              value={localMode}
              onChange={(e) => setLocalMode(e.target.value === 'manual' ? 'manual' : 'auto')}
              className="setting-input"
            >
              <option value="auto">{t('automation.airtime_cutoff.mode_auto_option', 'Auto (strongest RSSI)')}</option>
              <option value="manual">{t('automation.airtime_cutoff.mode_manual_option', 'Manual (selected nodes)')}</option>
            </select>
          </div>
        )}

        {/* Auto mode: how many strongest nodes to average (3-5) */}
        {localSource === 'neighbors' && localMode === 'auto' && (
          <div className="setting-item">
            <label htmlFor="airtimeCutoffNeighborSampleCount">
              {t('automation.airtime_cutoff.sample_count_label', 'Number of infrastructure nodes to average')}
              <span className="setting-description">
                {t('automation.airtime_cutoff.sample_count_hint', 'Between {{min}} and {{max}}; default {{def}}.', { min: MIN_SAMPLES, max: MAX_SAMPLES, def: DEFAULT_SAMPLES })}
              </span>
            </label>
            <NumberInput
              id="airtimeCutoffNeighborSampleCount"
              min={MIN_SAMPLES}
              max={MAX_SAMPLES}
              value={localSamples}
              integer
              onChange={setLocalSamples}
              className="setting-input"
            />
          </div>
        )}

        {/* Manual mode: pick 3-5 eligible infrastructure nodes */}
        {pickerShown && (
          <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label>
              {t('automation.airtime_cutoff.picker_label', 'Infrastructure nodes to average')}
              <span className="setting-description">
                {t('automation.airtime_cutoff.picker_hint',
                  'Pick {{min}} to {{max}} Router, Router Late or Client Base nodes. Nodes heard over MQTT are not listed. A pick with no Channel Utilization reading in the last 3 hours is skipped.',
                  { min: MIN_SAMPLES, max: MAX_SAMPLES })}
              </span>
            </label>
            <div
              data-testid="airtime-picker-count"
              style={{ fontSize: '12px', margin: '0.35rem 0', color: manualCountInvalid ? 'var(--color-error)' : 'var(--color-text-muted)' }}
            >
              {t('automation.airtime_cutoff.picker_count', '{{count}} selected (pick {{min}}-{{max}})', { count: localNodes.length, min: MIN_SAMPLES, max: MAX_SAMPLES })}
            </div>
            {candidates == null ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {t('automation.airtime_cutoff.picker_loading', 'Loading infrastructure nodes…')}
              </div>
            ) : candidates.length === 0 && localNodes.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {t('automation.airtime_cutoff.picker_empty', 'No eligible infrastructure nodes heard in the last day.')}
              </div>
            ) : (
              <ul data-testid="airtime-picker" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {candidates.map((c) => {
                  const checked = localNodes.includes(c.nodeNum);
                  const full = !checked && localNodes.length >= MAX_SAMPLES;
                  const inputId = `airtime-pick-${c.nodeNum}`;
                  return (
                    <li key={c.nodeNum}>
                      <label
                        htmlFor={inputId}
                        style={{
                          display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', textAlign: 'left', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', margin: 0, fontWeight: 400,
                          background: 'var(--color-surface)', border: '1px solid var(--color-surface-active)',
                          borderRadius: '6px', fontSize: '13px', cursor: full ? 'not-allowed' : 'pointer',
                          opacity: full ? 0.6 : 1,
                        }}
                      >
                        <input
                          id={inputId}
                          style={{ width: 'auto', margin: 0, flex: '0 0 auto' }}
                          type="checkbox"
                          checked={checked}
                          disabled={full}
                          onChange={() => togglePick(c.nodeNum)}
                        />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)', fontWeight: 500 }}>
                          {nodeLabel(c)}
                        </span>
                        <span style={{ color: 'var(--color-text-subtle)', whiteSpace: 'nowrap' }}>
                          {t('automation.airtime_cutoff.picker_detail', '{{role}} · {{hops}} · {{util}} ({{age}})', {
                            role: getRoleName(c.role) ?? String(c.role),
                            hops: c.hopsAway == null
                              ? t('automation.airtime_cutoff.hops_unknown', '? hops')
                              : t('automation.airtime_cutoff.hops_count', '{{n}} hop(s)', { n: c.hopsAway }),
                            util: c.channelUtilization == null ? '—' : `${formatPercent(c.channelUtilization)}%`,
                            age: formatAge(c.channelUtilizationAt),
                          })}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {/* Saved picks that are no longer eligible (e.g. now MQTT-only): shown so they can be removed */}
                {localNodes.filter((n) => !candidates.some((c) => c.nodeNum === n)).map((nodeNum) => (
                  <li key={`gone-${nodeNum}`}>
                    <label
                      htmlFor={`airtime-pick-${nodeNum}`}
                      style={{
                        display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', textAlign: 'left', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', margin: 0, fontWeight: 400,
                        border: '1px dashed var(--color-surface-active)', borderRadius: '6px', fontSize: '13px',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <input id={`airtime-pick-${nodeNum}`} style={{ width: 'auto', margin: 0, flex: '0 0 auto' }} type="checkbox" checked onChange={() => togglePick(nodeNum)} />
                      <span style={{ flex: 1 }}>{`!${nodeNum.toString(16).padStart(8, '0')}`}</span>
                      <span>{t('automation.airtime_cutoff.picker_not_eligible', 'not eligible now (skipped)')}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Neighbour candidate max-hops (auto mode only; manual picks name their nodes) */}
        {localSource === 'neighbors' && localMode === 'auto' && (
          <div className="setting-item">
            <label htmlFor="airtimeCutoffNeighborMaxHops">
              {t('automation.airtime_cutoff.max_hops_label', 'Maximum hops for neighbour candidates')}
              <span className="setting-description">
                {t(
                  'automation.airtime_cutoff.max_hops_hint',
                  '0 means directly heard only (default). Raise to 1 if a CLIENT_BASE or similar node relays routers to your local node. Try 1 first when the "waiting" message persists after several minutes (issue #4801).',
                )}
              </span>
            </label>
            <NumberInput
              id="airtimeCutoffNeighborMaxHops"
              min={0}
              max={MAX_HOPS_CAP}
              value={localMaxHops}
              integer
              onChange={setLocalMaxHops}
              className="setting-input"
            />
          </div>
        )}

        {/* Threshold input */}
        <div className="setting-item">
          <label htmlFor="airtimeCutoffThreshold">
            {t('automation.airtime_cutoff.threshold_label', 'Cutoff Airtime Utilization Threshold (%)')}
            <span className="setting-description">
              {t('automation.airtime_cutoff.threshold_hint',
                'Channel Utilization percent above which automations pause. 0 disables; default 30.')}
            </span>
          </label>
          <NumberInput
            id="airtimeCutoffThreshold"
            min={0}
            max={100}
            value={localThreshold}
            integer
            onChange={setLocalThreshold}
            className="setting-input"
          />
        </div>
      </div>
    </>
    </NumberInputScope>
  );
};

export default AirtimeCutoffSection;
