/**
 * useMeshCoreNodeDisplayDraft: the MeshCore Node Display section's draft and
 * save (#4412, #6258), moved as is out of MeshCoreNodeDisplaySection (Rule X,
 * Task 7.4) so the Workspace's Display page draws its own rows and saves from
 * its own dock. The section keeps today's SaveBar registration.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCsrfFetch } from '../../../hooks/useCsrfFetch';
import { useToast } from '../../ToastContainer';
import { useAuth } from '../../../contexts/AuthContext';
import { useNodeDisplaySettings, useSignFlipFormSettings, nodeDisplaySettingsQueryKey } from '../../../hooks/useNodeDisplaySettings';
import { useSettingsOptional } from '../../../contexts/SettingsContext';
import { clampSignFlipRangeKm } from '../../../utils/signFlipPosition';
import { writeNodeDisplayLocal } from '../../../utils/nodeDisplayStorage';
import { type NodeDisplaySettingKey } from '../../../constants/nodeDisplayDefaults';

/**
 * The four Node Display keys with a MeshCore consumer (#4412 Phase 4 spec §2
 * D3). Hide-incomplete and the three dimming keys also have MeshCore consumers
 * since #6258 (MeshCoreNodesView / MeshCoreMap); they ride in the draft as
 * their own fields. Only `localStatsIntervalMinutes` and `nodeHopsCalculation`
 * remain Meshtastic-only and are deliberately omitted here.
 *
 * `satisfies` binds this list to the epic's key union, so deleting a key
 * from nodeDisplayDefaults.ts breaks the build here instead of drifting
 * silently.
 */
export const MESHCORE_NODE_DISPLAY_KEYS = [
  'maxNodeAgeHours',
  'inactiveNodeThresholdHours',
  'inactiveNodeCheckIntervalMinutes',
  'inactiveNodeCooldownHours',
] as const satisfies readonly NodeDisplaySettingKey[];

/**
 * #4899: the Infrastructure age cutoff is a standalone per-source setting (NOT
 * one of the frozen ten Node Display keys), so it rides alongside the four
 * MeshCore keys in the draft and save body rather than in
 * `MESHCORE_NODE_DISPLAY_KEYS`.
 */
export type MeshCoreNodeDisplayDraft =
  Record<typeof MESHCORE_NODE_DISPLAY_KEYS[number], number>
  & { maxInfraNodeAgeHours: number }
  // Hide-incomplete + map-marker dimming (#6258), also per source.
  & {
    hideIncompleteNodes: boolean;
    nodeDimmingEnabled: boolean;
    nodeDimmingStartHours: number;
    nodeDimmingMinOpacity: number;
  }
  // Sign-flip correction (#5363), also per source.
  & {
    signFlipCorrectionEnabled: boolean;
    signFlipCorrectionRangeKm: number;
    signFlipReferenceLatitude: string;
    signFlipReferenceLongitude: string;
  };

export type MeshCoreNodeDisplayNumericKey =
  typeof MESHCORE_NODE_DISPLAY_KEYS[number]
  | 'maxInfraNodeAgeHours'
  | 'nodeDimmingStartHours'
  | 'nodeDimmingMinOpacity';

const DISPLAY_EXTRA_DRAFT_KEYS = [
  'hideIncompleteNodes',
  'nodeDimmingEnabled',
  'nodeDimmingStartHours',
  'nodeDimmingMinOpacity',
] as const;

const SIGN_FLIP_DRAFT_KEYS = [
  'signFlipCorrectionEnabled',
  'signFlipCorrectionRangeKm',
  'signFlipReferenceLatitude',
  'signFlipReferenceLongitude',
] as const;

/**
 * MeshCore Node Display settings section (#4412 Phase 4 WP2).
 *
 * Persists through the SAME per-source `/api/settings?sourceId=` endpoints
 * Phases 1-3 built for the Meshtastic `SettingsTab` — there is no
 * MeshCore-specific route for this data because these are not
 * MeshCore-specific settings; they are four of the ten rows in the shared
 * `settings` table. See PER_SOURCE_NODE_DISPLAY_PHASE4_SPEC.md D1.
 *
 * Reads through `useNodeDisplaySettings(sourceId)` so this section, the
 * Nodes list and the map all share one TanStack cache entry and can never
 * disagree.
 */
export function useMeshCoreNodeDisplayDraft(baseUrl: string, sourceId: string) {
  const { t } = useTranslation();
  const csrfFetch = useCsrfFetch();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = hasPermission('settings', 'write', { sourceId });

  const settings = useNodeDisplaySettings(sourceId);
  const signFlip = useSignFlipFormSettings(sourceId);
  // Optional: this section is also rendered without a SettingsProvider in tests.
  const distanceUnit = useSettingsOptional()?.distanceUnit ?? 'km';

  const buildDraft = useCallback((): MeshCoreNodeDisplayDraft => ({
    maxNodeAgeHours: settings.maxNodeAgeHours,
    maxInfraNodeAgeHours: settings.maxInfraNodeAgeHours,
    inactiveNodeThresholdHours: settings.inactiveNodeThresholdHours,
    inactiveNodeCheckIntervalMinutes: settings.inactiveNodeCheckIntervalMinutes,
    inactiveNodeCooldownHours: settings.inactiveNodeCooldownHours,
    hideIncompleteNodes: settings.hideIncompleteNodes,
    nodeDimmingEnabled: settings.nodeDimmingEnabled,
    nodeDimmingStartHours: settings.nodeDimmingStartHours,
    nodeDimmingMinOpacity: settings.nodeDimmingMinOpacity,
    signFlipCorrectionEnabled: signFlip.enabled,
    signFlipCorrectionRangeKm: signFlip.rangeKm,
    signFlipReferenceLatitude: signFlip.referenceLatitude,
    signFlipReferenceLongitude: signFlip.referenceLongitude,
  }), [
    settings.maxNodeAgeHours,
    settings.maxInfraNodeAgeHours,
    settings.inactiveNodeThresholdHours,
    settings.inactiveNodeCheckIntervalMinutes,
    settings.inactiveNodeCooldownHours,
    settings.hideIncompleteNodes,
    settings.nodeDimmingEnabled,
    settings.nodeDimmingStartHours,
    settings.nodeDimmingMinOpacity,
    signFlip.enabled,
    signFlip.rangeKm,
    signFlip.referenceLatitude,
    signFlip.referenceLongitude,
  ]);

  const [draft, setDraft] = useState<MeshCoreNodeDisplayDraft>(buildDraft);
  const [initial, setInitial] = useState<MeshCoreNodeDisplayDraft>(buildDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Re-seed once the query resolves (the hook returns hardcoded defaults
  // until then) — same re-seed discipline as SettingsTab's buildBaseline.
  useEffect(() => {
    const next = buildDraft();
    setDraft(next);
    setInitial(next);
  }, [buildDraft]);

  useEffect(() => {
    setHasChanges(
      MESHCORE_NODE_DISPLAY_KEYS.some((k) => draft[k] !== initial[k])
      || draft.maxInfraNodeAgeHours !== initial.maxInfraNodeAgeHours
      || DISPLAY_EXTRA_DRAFT_KEYS.some((k) => draft[k] !== initial[k])
      || SIGN_FLIP_DRAFT_KEYS.some((k) => draft[k] !== initial[k]),
    );
  }, [draft, initial]);

  const update = (key: MeshCoreNodeDisplayNumericKey, value: number) => {
    // NumberInput emits valid numbers only (#5649), so NaN cannot arrive from
    // a field any more. The guard stays as a backstop: NaN in state would
    // serialize as "NaN" in the save POST body (#4433 review).
    setDraft((prev) => ({ ...prev, [key]: Number.isNaN(value) ? prev[key] : value }));
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await csrfFetch(`${baseUrl}/api/settings?sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(MESHCORE_NODE_DISPLAY_KEYS.map((k) => [k, String(draft[k])])),
          // #4899: standalone key, POSTed alongside the four frozen ones.
          maxInfraNodeAgeHours: String(draft.maxInfraNodeAgeHours),
          // #6258: hide-incomplete + dimming, per source ('1'/'0' like SettingsTab).
          hideIncompleteNodes: draft.hideIncompleteNodes ? '1' : '0',
          nodeDimmingEnabled: draft.nodeDimmingEnabled ? '1' : '0',
          nodeDimmingStartHours: String(draft.nodeDimmingStartHours),
          nodeDimmingMinOpacity: String(draft.nodeDimmingMinOpacity),
          // #5363: sign-flip correction, per source like the rest.
          signFlipCorrectionEnabled: draft.signFlipCorrectionEnabled ? 'true' : 'false',
          signFlipCorrectionRangeKm: String(clampSignFlipRangeKm(draft.signFlipCorrectionRangeKm)),
          signFlipReferenceLatitude: draft.signFlipReferenceLatitude.trim(),
          signFlipReferenceLongitude: draft.signFlipReferenceLongitude.trim(),
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          showToast(t('settings.node_display.insufficient_permissions', 'Insufficient permissions'), 'error');
          return;
        }
        throw new Error(`Server returned ${res.status}`);
      }
      for (const k of MESHCORE_NODE_DISPLAY_KEYS) {
        writeNodeDisplayLocal(sourceId, k, String(draft[k]));
      }
      writeNodeDisplayLocal(sourceId, 'hideIncompleteNodes', draft.hideIncompleteNodes ? '1' : '0');
      writeNodeDisplayLocal(sourceId, 'nodeDimmingEnabled', draft.nodeDimmingEnabled ? '1' : '0');
      writeNodeDisplayLocal(sourceId, 'nodeDimmingStartHours', String(draft.nodeDimmingStartHours));
      writeNodeDisplayLocal(sourceId, 'nodeDimmingMinOpacity', String(draft.nodeDimmingMinOpacity));
      // Mandatory: without this the Nodes list and map keep filtering on the
      // stale cutoff until the next full page reload (#4412 Phase 4 spec R3).
      await queryClient.invalidateQueries({ queryKey: nodeDisplaySettingsQueryKey(sourceId) });
      setInitial(draft);
      setHasChanges(false);
      showToast(t('settings.node_display.settings_saved', 'Settings saved'), 'success');
    } catch (err) {
      console.error('Failed to save MeshCore Node Display settings:', err);
      showToast(t('settings.node_display.settings_save_failed', 'Failed to save settings'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [draft, baseUrl, sourceId, csrfFetch, queryClient, showToast, t]);

  const handleDismiss = useCallback(() => {
    setDraft(initial);
    setHasChanges(false);
  }, [initial]);

  return { canWrite, distanceUnit, draft, setDraft, initial, isSaving, hasChanges, update, handleSave, handleDismiss };
}
