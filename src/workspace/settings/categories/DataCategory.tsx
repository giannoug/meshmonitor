/**
 * In MeshMonitor › Data (boards 12-12 / 12-23, Task 5.8): today's Reset UI
 * Positions, Settings Management and Danger Zone of the source's Settings.
 * Every action deletes rows in MeshMonitor's database (or this browser's
 * layout) and sends nothing on the mesh. Each destructive one asks in a
 * ConfirmSheet with today's words (today's browser confirm), plainly.
 *
 * - Erase nodes, Purge telemetry and Reset traceroutes act on this source;
 *   Purge messages purges every source, as today's call does.
 * - Clean outliers: today's dialog, admins only.
 * - After a purge every query reads again (today reloaded the page after 1.5 s);
 *   after Reset to Defaults the page reloads, because SettingsContext reads the
 *   defaults only on load.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import TelemetryOutlierDialog from '../../../components/TelemetryOutlierDialog/TelemetryOutlierDialog';
import { getTelemetryLabel } from '../../../components/TelemetryChart';
import { useAuth } from '../../../contexts/AuthContext';
import { useSource } from '../../../contexts/SourceContext';
import apiService from '../../../services/api';
import { logger } from '../../../utils/logger';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import DangerZone from '../../patterns/DangerZone';
import SendsLine from '../../patterns/SendsLine';
import SettingGroup from '../kit/SettingGroup';
import { useReadOnly } from '../kit/useFieldRegistry';
import type { CategoryProps } from '../categories';
import { ActionRow } from './maintenanceShared';
import { AutosavePage } from './autosave';
import pages from './SettingsPages.module.css';

type Action = 'reset' | 'nodes' | 'telemetry' | 'messages' | 'traceroutes';

/** Today's draggable panels' stored positions (SettingsTab's Reset Positions). */
const UI_POSITION_KEYS = [
  'nodesSidebarPosition',
  'nodesSidebarSize',
  'mapControlsPosition',
  'draggable_position_map-legend',
  'draggable_position_tileset-selector',
];

export default function DataCategory({ sourceId }: CategoryProps) {
  return (
    <AutosavePage scope={null} needsSettings={false}>
      <DataRows sourceId={sourceId} />
    </AutosavePage>
  );
}

function DataRows({ sourceId }: { sourceId: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { authStatus } = useAuth();
  const { sourceName } = useSource();
  const queryClient = useQueryClient();
  const readOnly = useReadOnly();
  const isAdmin = authStatus?.user?.isAdmin ?? false;
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [outliers, setOutliers] = useState(false);
  const close = () => setPending(null);

  /** Today's confirm text: the title, "Impact:", the list, "cannot be undone". */
  const words: Record<Action, { title: string; items: string[]; confirm: string; run(): Promise<unknown>; ok: string; failed: string }> = {
    reset: {
      title: t('settings.confirm_reset_title'),
      items: [
        'max_age', 'temp', 'dist', 'telemetry', 'sort', 'time', 'date', 'tileset', 'pins', 'packet', 'max_packets', 'packet_age',
      ].map((k) => t(`settings.confirm_reset_${k}`)),
      confirm: t('settings.reset_defaults'),
      run: () => apiService.delete('/api/settings'),
      ok: t('settings.reset_success'),
      failed: t('settings.reset_failed'),
    },
    nodes: {
      title: t('settings.confirm_purge_nodes_title_source'),
      items: [
        t('settings.confirm_purge_nodes_item1_source'),
        t('settings.confirm_purge_nodes_item2_source'),
        t('settings.confirm_purge_nodes_item3'),
        t('settings.confirm_purge_nodes_item4'),
      ],
      confirm: t('settings.erase_nodes_button'),
      run: () => apiService.purgeNodes(0, sourceId),
      ok: t('toast.nodes_purged'),
      failed: t('toast.node_purge_failed'),
    },
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
      title: t('settings.confirm_purge_messages_title'),
      items: [t('settings.confirm_purge_messages_item1'), t('settings.confirm_purge_messages_item2'), t('settings.confirm_purge_messages_item3')],
      confirm: t('settings.purge_messages_button'),
      run: () => apiService.purgeMessages(0),
      ok: t('messages.purged_success'),
      failed: t('messages.error_purging'),
    },
    traceroutes: {
      title: t('settings.confirm_purge_traceroutes_title'),
      items: [1, 2, 3, 4].map((n) => t(`settings.confirm_purge_traceroutes_item${n}`)),
      confirm: t('settings.reset_traceroutes_button'),
      run: () => apiService.purgeTraceroutes(sourceId),
      ok: t('toast.traceroutes_purged'),
      failed: t('toast.traceroutes_purge_failed'),
    },
  };

  const run = async (action: Action) => {
    const w = words[action];
    setBusy(true);
    try {
      await w.run();
      showToast(w.ok, 'success');
      if (action === 'reset') window.location.reload();
      else await queryClient.invalidateQueries();
    } catch (error) {
      logger.error(`Data action ${action} failed:`, error);
      showToast(w.failed, 'error');
    } finally {
      setBusy(false);
      close();
    }
  };

  const ask = (action: Action, label: string, danger = true) => (
    <button
      type="button"
      className={danger ? `${pages.button} ${pages.dangerButton}` : pages.button}
      disabled={readOnly || busy}
      onClick={() => setPending(action)}
    >
      {label}
    </button>
  );

  const w = pending ? words[pending] : null;
  return (
    <>
      <SettingGroup title={t('workspace.settings.data.resets')}>
        <ActionRow id="data.reset_ui" label={t('settings.reset_ui_positions')} help={t('settings.reset_ui_positions_description')}>
          <button
            type="button"
            className={pages.button}
            onClick={() => {
              UI_POSITION_KEYS.forEach((k) => localStorage.removeItem(k));
              showToast(t('settings.reset_ui_positions_success'), 'success');
            }}
          >
            {t('settings.reset_ui_positions_button')}
          </button>
        </ActionRow>
        <ActionRow id="data.reset_defaults" label={t('settings.settings_management')} help={t('workspace.settings.data.reset_help')}>
          {ask('reset', t('settings.reset_defaults'), false)}
        </ActionRow>
      </SettingGroup>

      <p className={pages.note}>
        <UiIcon name="info" size={16} />
        <span>
          {t('workspace.settings.data.scope', { device: sourceName ?? '' })} {t('settings.danger_zone_description')}
        </span>
      </p>
      <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>

      <DangerZone
        title={
          <span className={pages.inline}>
            <UiIcon name="alert" size={16} /> {t('settings.danger_zone')}
          </span>
        }
      >
        <ActionRow id="data.erase_nodes" label={t('settings.erase_nodes_title')} help={t('settings.erase_nodes_description_source')}>
          {ask('nodes', t('settings.erase_nodes_button'))}
        </ActionRow>
        <ActionRow id="data.purge_telemetry" label={t('settings.purge_telemetry_title')} help={t('settings.purge_telemetry_description_source')}>
          {ask('telemetry', t('settings.purge_telemetry_button'))}
        </ActionRow>
        {isAdmin && (
          <ActionRow id="data.clean_outliers" label={t('settings.clean_outliers_title')} help={t('settings.clean_outliers_description')}>
            <button type="button" className={`${pages.button} ${pages.dangerButton}`} disabled={busy} onClick={() => setOutliers(true)}>
              {t('settings.clean_outliers_button')}
            </button>
          </ActionRow>
        )}
        <ActionRow id="data.purge_messages" label={t('settings.purge_messages_title')} help={t('settings.purge_messages_description')}>
          {ask('messages', t('settings.purge_messages_button'))}
        </ActionRow>
        <ActionRow id="data.reset_traceroutes" label={t('settings.reset_traceroutes_title')} help={t('settings.reset_traceroutes_description')}>
          {ask('traceroutes', t('settings.reset_traceroutes_button'))}
        </ActionRow>
      </DangerZone>

      <ConfirmSheet
        open={!!w}
        title={w?.title ?? ''}
        body={
          w && (
            <>
              <p className={pages.para}>{pending === 'reset' ? t('settings.confirm_reset_defaults') : t('settings.confirm_purge_nodes_impact')}</p>
              <ul className={pages.list}>
                {w.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p className={pages.para}>{pending === 'reset' ? t('settings.confirm_reset_affects') : t('settings.confirm_cannot_undo')}</p>
            </>
          )
        }
        confirmLabel={w?.confirm ?? ''}
        danger={pending !== 'reset'}
        busy={busy}
        onConfirm={() => run(pending!)}
        onCancel={close}
      />
      {isAdmin && (
        <TelemetryOutlierDialog
          isOpen={outliers}
          onClose={() => setOutliers(false)}
          sourceId={sourceId}
          sources={[{ id: sourceId, name: sourceName ?? sourceId }]}
          getTypeLabel={getTelemetryLabel}
        />
      )}
    </>
  );
}
