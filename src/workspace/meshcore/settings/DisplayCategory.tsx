/**
 * In MeshMonitor › Display (Task 7.4, note s8n4: "windows, inactive
 * thresholds, telemetry data; Purge messages in its danger zone"), on the row
 * kit over today's drafts (useMeshCoreNodeDisplayDraft and
 * useMeshCoreTelemetrySettingsDraft, moved out of today's sections, Rule X):
 * the node windows, the inactive-node trio, hide-incomplete, dimming,
 * sign-flipped positions, and the telemetry window and favourites'
 * retention. One bar saves both groups, each with today's one request, only
 * when it changed. The danger zone holds today's Purge telemetry (this
 * source), Clean outliers (admins) and Purge all messages, each asking first
 * in a ConfirmSheet with today's words; each is one request to MeshMonitor's
 * database.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import OutlierCleanupPage from '../../misc/OutlierCleanupPage';
import { useMeshCoreNodeDisplayDraft, type MeshCoreNodeDisplayNumericKey } from '../../../components/MeshCore/hooks/useMeshCoreNodeDisplayDraft';
import { useMeshCoreTelemetrySettingsDraft } from '../../../components/MeshCore/hooks/useMeshCoreTelemetrySettingsDraft';
import { useAuth } from '../../../contexts/AuthContext';
import { MAX_INFRA_NODE_AGE_HOURS_RANGE, NODE_DIMMING_RANGES, NODE_DISPLAY_RANGES, TELEMETRY_RETENTION_RANGES } from '../../../constants/nodeDisplayDefaults';
import { appBasename } from '../../../init';
import apiService from '../../../services/api';
import { kmToMiles } from '../../../utils/distance';
import { getTelemetryLabel } from '../../../components/TelemetryChart';
import { isSignFlipReferenceValid, SIGN_FLIP_RANGE_KM } from '../../../utils/signFlipPosition';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { McDock, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

const KM_PER_MILE = 1 / 0.621371;
type Danger = 'telemetry' | 'messages';

export default function DisplayCategory({ sourceId, readOnly }: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const off = useReadOnly(readOnly);
  const numbers = useNumberInputScope();
  const nd = useMeshCoreNodeDisplayDraft(appBasename, sourceId);
  const tm = useMeshCoreTelemetrySettingsDraft(appBasename, sourceId);
  const [pending, setPending] = useState<Danger | null>(null);
  const [busy, setBusy] = useState(false);
  const [outliers, setOutliers] = useState(false);
  const canPurgeMessages = hasPermission('messages', 'write', { sourceId });
  const miles = nd.distanceUnit === 'mi';
  const draft = nd.draft;
  const ro = off || !nd.canWrite;

  const label = {
    maxNodeAgeHours: t('settings.node_window_label', 'Node list & map window (hours)'),
    maxInfraNodeAgeHours: t('meshcore.settings.node_display.max_infra_age_label', 'Maximum Age of Infrastructure Nodes (hours)'),
    inactiveNodeThresholdHours: t('settings.inactive_node_threshold_label', 'Inactive Node Notification Threshold (hours)'),
    inactiveNodeCheckIntervalMinutes: t('settings.inactive_node_check_interval_label', 'Inactive Node Check Interval (minutes)'),
    inactiveNodeCooldownHours: t('settings.inactive_node_cooldown_label', 'Inactive Node Notification Cooldown (hours)'),
    hideIncompleteNodes: t('settings.hide_incomplete_nodes'),
    nodeDimmingEnabled: t('settings.node_dimming_enabled'),
    nodeDimmingStartHours: t('settings.node_dimming_start_hours'),
    nodeDimmingMinOpacity: t('settings.node_dimming_min_opacity'),
    signFlipCorrectionEnabled: t('settings.sign_flip.enabled', 'Correct sign-flipped positions'),
    signFlipCorrectionRangeKm: t('settings.sign_flip.range_label', 'Range ({{unit}})', { unit: miles ? 'mi' : 'km' }),
    signFlipReferenceLatitude: t('settings.sign_flip.latitude_placeholder', 'Latitude'),
    signFlipReferenceLongitude: t('settings.sign_flip.longitude_placeholder', 'Longitude'),
    telemetryVisualizationHours: t('settings.telemetry_hours_label'),
    favoriteTelemetryStorageDays: t('settings.fav_telemetry_label'),
  };
  const ndChanged = (Object.keys(draft) as Array<keyof typeof draft>).filter((k) => draft[k] !== nd.initial[k]);
  const changes = [...ndChanged.map((k) => label[k]), ...(tm.hasChanges ? [t('settings.telemetry', 'Telemetry')] : [])];
  const was = (k: keyof typeof draft) => (draft[k] !== nd.initial[k] ? String(nd.initial[k]) : undefined);

  const num = (k: MeshCoreNodeDisplayNumericKey, help: string, range: { min?: number; max?: number; step?: number }, off = false) => (
    <SettingRow id={`meshcore.display.${k}`} label={label[k]} help={help} was={was(k)}>
      <SettingNumber value={draft[k]} min={range.min} max={range.max} step={range.step ?? 1} readOnly={ro || off} onChange={(v) => nd.update(k, v)} />
    </SettingRow>
  );
  const toggle = (k: 'hideIncompleteNodes' | 'nodeDimmingEnabled' | 'signFlipCorrectionEnabled', help: string) => (
    <SettingRow id={`meshcore.display.${k}`} label={label[k]} help={help} was={draft[k] !== nd.initial[k] ? t(nd.initial[k] ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off') : undefined}>
      <SettingToggle checked={draft[k]} readOnly={ro} onChange={(v) => nd.setDraft((p) => ({ ...p, [k]: v }))} />
    </SettingRow>
  );

  const save = async () => {
    if (ndChanged.length) await nd.handleSave();
    if (tm.hasChanges) await tm.handleSave();
  };
  const discard = () => {
    nd.handleDismiss();
    tm.handleDismiss();
    numbers.reset();
  };
  const words: Record<Danger, { title: string; items: string[]; confirm: string; run(): Promise<unknown>; ok: string; failed: string }> = {
    telemetry: {
      title: t('settings.confirm_purge_telemetry_title_source'),
      items: [
        t('settings.confirm_purge_telemetry_item1_source'),
        t('settings.confirm_purge_telemetry_item2'),
        t('settings.confirm_purge_telemetry_item3'),
        t('settings.confirm_purge_telemetry_item4'),
      ],
      confirm: t('settings.purge_telemetry_button'),
      run: () => apiService.purgeTelemetry(0, sourceId),
      ok: t('toast.telemetry_purged'),
      failed: t('toast.telemetry_purge_failed'),
    },
    messages: {
      title: t('meshcore.settings.purge_all_messages', 'Purge all messages'),
      items: [],
      confirm: t('meshcore.settings.purge_all_messages', 'Purge all messages'),
      run: async () => {
        if (!(await d.actions.purgeAllMessages())) throw new Error('purge failed');
      },
      ok: t('meshcore.settings.purge_all_messages_done', 'All MeshCore messages purged'),
      failed: t('meshcore.settings.purge_all_messages_failed', 'Failed to purge messages'),
    },
  };
  const run = async (action: Danger) => {
    const w = words[action];
    setBusy(true);
    try {
      await w.run();
      showToast(w.ok, 'success');
      if (action === 'telemetry') await queryClient.invalidateQueries();
    } catch {
      showToast(w.failed, 'error');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };
  const w = pending ? words[pending] : null;
  const rangeShown = Math.round(miles ? kmToMiles(draft.signFlipCorrectionRangeKm) : draft.signFlipCorrectionRangeKm);

  return (
    <McPage>
      <NumberInputScope scope={numbers}>
        <SettingGroup title={t('workspace.meshcore.settings.windows')}>
          {num('maxNodeAgeHours', t('meshcore.settings.node_display.window_description'), NODE_DISPLAY_RANGES.maxNodeAgeHours!)}
          {num('maxInfraNodeAgeHours', t('meshcore.settings.node_display.max_infra_age_description', 'A separate age window for Repeaters and Room Servers.'), MAX_INFRA_NODE_AGE_HOURS_RANGE)}
          {toggle('hideIncompleteNodes', t('meshcore.settings.node_display.hide_incomplete_description', 'Hide nodes that have no advertised name or an unknown device type from the Nodes list and map. Favorites and your own node always show.'))}
          {toggle('nodeDimmingEnabled', t('meshcore.settings.node_dimming_description', 'Fade map markers as nodes go quiet.'))}
          {num('nodeDimmingStartHours', t('settings.node_dimming_start_hours_description'), NODE_DIMMING_RANGES.nodeDimmingStartHours, !draft.nodeDimmingEnabled)}
          {num('nodeDimmingMinOpacity', t('settings.node_dimming_min_opacity_description'), NODE_DIMMING_RANGES.nodeDimmingMinOpacity, !draft.nodeDimmingEnabled)}
        </SettingGroup>
        <SettingGroup title={t('workspace.meshcore.settings.inactive_nodes')}>
          {num('inactiveNodeThresholdHours', t('settings.inactive_node_threshold_description'), NODE_DISPLAY_RANGES.inactiveNodeThresholdHours!)}
          {num('inactiveNodeCheckIntervalMinutes', t('settings.inactive_node_check_interval_description'), NODE_DISPLAY_RANGES.inactiveNodeCheckIntervalMinutes!)}
          {num('inactiveNodeCooldownHours', t('settings.inactive_node_cooldown_description'), NODE_DISPLAY_RANGES.inactiveNodeCooldownHours!)}
        </SettingGroup>
        <SettingGroup title={t('settings.sign_flip.title', 'Sign-flipped positions')}>
          {toggle('signFlipCorrectionEnabled', t('settings.sign_flip.help'))}
          <SettingRow id="meshcore.display.signFlipCorrectionRangeKm" label={label.signFlipCorrectionRangeKm} help={<Warn>{t('settings.sign_flip.range_warning')}</Warn>} was={was('signFlipCorrectionRangeKm')}>
            <SettingNumber
              value={rangeShown}
              min={Math.ceil(miles ? kmToMiles(SIGN_FLIP_RANGE_KM.min) : SIGN_FLIP_RANGE_KM.min)}
              max={Math.floor(miles ? kmToMiles(SIGN_FLIP_RANGE_KM.max) : SIGN_FLIP_RANGE_KM.max)}
              readOnly={ro || !draft.signFlipCorrectionEnabled}
              onChange={(v) => nd.setDraft((p) => ({ ...p, signFlipCorrectionRangeKm: miles ? v * KM_PER_MILE : v }))}
            />
          </SettingRow>
          <SettingRow id="meshcore.display.signFlipReferenceLatitude" label={label.signFlipReferenceLatitude} help={t('settings.sign_flip.reference_help')} was={was('signFlipReferenceLatitude')}>
            <SettingText value={draft.signFlipReferenceLatitude} readOnly={ro || !draft.signFlipCorrectionEnabled} onChange={(v) => nd.setDraft((p) => ({ ...p, signFlipReferenceLatitude: v }))} />
          </SettingRow>
          <SettingRow
            id="meshcore.display.signFlipReferenceLongitude"
            label={label.signFlipReferenceLongitude}
            help={!isSignFlipReferenceValid(draft.signFlipReferenceLatitude, draft.signFlipReferenceLongitude) && <Warn tone="danger">{t('settings.sign_flip.reference_invalid')}</Warn>}
            was={was('signFlipReferenceLongitude')}
          >
            <SettingText value={draft.signFlipReferenceLongitude} readOnly={ro || !draft.signFlipCorrectionEnabled} onChange={(v) => nd.setDraft((p) => ({ ...p, signFlipReferenceLongitude: v }))} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title={t('settings.telemetry', 'Telemetry')}>
          <SettingRow id="meshcore.display.telemetryVisualizationHours" label={label.telemetryVisualizationHours} help={t('settings.telemetry_hours_description')}>
            <SettingNumber value={tm.draft.telemetryVisualizationHours} {...TELEMETRY_RETENTION_RANGES.telemetryVisualizationHours} readOnly={off || !tm.canWrite} onChange={(v) => tm.update('telemetryVisualizationHours', v)} />
          </SettingRow>
          <SettingRow id="meshcore.display.favoriteTelemetryStorageDays" label={label.favoriteTelemetryStorageDays} help={t('settings.fav_telemetry_description')}>
            <SettingNumber value={tm.draft.favoriteTelemetryStorageDays} {...TELEMETRY_RETENTION_RANGES.favoriteTelemetryStorageDays} readOnly={off || !tm.canWrite} onChange={(v) => tm.update('favoriteTelemetryStorageDays', v)} />
          </SettingRow>
        </SettingGroup>
      </NumberInputScope>

      {(d.isAdmin || canPurgeMessages) && (
        <DangerZone
          title={
            <span className={styles.inline}>
              <UiIcon name="alert" size={16} /> {t('config.danger_zone')}
            </span>
          }
        >
          {d.isAdmin && (
            <div className={styles.dangerRow}>
              <span className={styles.dangerText}>
                <span className={styles.rowLabel}>{t('settings.purge_telemetry_title')}</span>
                <span className={styles.muted}>{t('settings.purge_telemetry_description_source')}</span>
              </span>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => setPending('telemetry')}>
                {t('settings.purge_telemetry_button')}
              </button>
            </div>
          )}
          {d.isAdmin && (
            <div className={styles.dangerRow}>
              <span className={styles.dangerText}>
                <span className={styles.rowLabel}>{t('settings.clean_outliers_title')}</span>
                <span className={styles.muted}>{t('settings.clean_outliers_description')}</span>
              </span>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => setOutliers(true)}>
                {t('settings.clean_outliers_button')}
              </button>
            </div>
          )}
          {canPurgeMessages && (
            <div className={styles.dangerRow}>
              <span className={styles.dangerText}>
                <span className={styles.rowLabel}>{t('meshcore.settings.message_data', 'Message data')}</span>
                <span className={styles.muted}>
                  {t('meshcore.settings.purge_all_messages_desc', 'Permanently delete every stored MeshCore message (all channels and direct messages) for this source.')}
                </span>
              </span>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => setPending('messages')}>
                {busy && pending === 'messages' ? t('meshcore.settings.purging', 'Purging…') : t('meshcore.settings.purge_all_messages', 'Purge all messages')}
              </button>
            </div>
          )}
          <SendsLine>{t('workspace.meshcore.settings.sends_purge')}</SendsLine>
        </DangerZone>
      )}

      <ConfirmSheet
        open={!!w}
        title={w?.title ?? ''}
        body={
          w &&
          (pending === 'messages' ? (
            <p className={styles.para}>
              {t('meshcore.settings.confirm_purge_all_messages', 'Delete ALL MeshCore messages (every channel and DM) for this source? This cannot be undone.')}
            </p>
          ) : (
            <>
              <p className={styles.para}>{t('settings.confirm_purge_nodes_impact')}</p>
              <ul className={styles.result}>
                {w.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
              <p className={styles.para}>{t('settings.confirm_cannot_undo')}</p>
            </>
          ))
        }
        confirmLabel={w?.confirm ?? ''}
        danger
        busy={busy}
        submitOnEnter={false}
        onConfirm={() => run(pending!)}
        onCancel={() => setPending(null)}
      />
      {d.isAdmin && (
        <OutlierCleanupPage
          isOpen={outliers}
          onClose={() => setOutliers(false)}
          sourceId={sourceId}
          sources={[{ id: sourceId, name: d.deviceName }]}
          getTypeLabel={getTelemetryLabel}
        />
      )}

      <McDock
        changes={changes}
        page={t('workspace.meshcore.settings.display')}
        sends={t('workspace.settings.savebar.sends_nothing')}
        saveLabel={t('common.save', 'Save')}
        saving={nd.isSaving || tm.isSaving}
        blocked={off || numbers.invalid}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </McPage>
  );
}
