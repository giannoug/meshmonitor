/**
 * Server › General (board r4-server-general; Task 1.8 built the Layout and
 * Sources cards, Task 6.4 the rest). s13n5 puts these below r4's rows:
 *
 * - Default Landing Page (admins, as today's Appearance section).
 * - MeshCore Messaging: channel auto-retry, CLI reply timeout, cross-source
 *   hop names (today's section; settings:write, so a non-admin writer still
 *   reaches it here, Ruling 6.4 gates).
 * - Reticulum Settings: the destination retention cap (settings:write).
 *
 * Every row saves as you go (`POST /api/settings`, useAutosaveSetting).
 *
 * Mesh impact: the channel auto-retry is today's opt-in, one-shot resend of
 * an automated channel send that heard no repeater in 30 s; its row carries
 * the Sends line. Nothing else here sends on the mesh.
 */
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import SendsLine from '../patterns/SendsLine';
import SettingGroup from '../settings/kit/SettingGroup';
import { AutoNumber, AutoSelect, AutoToggle } from '../settings/categories/autosave';
import { useShellDevices } from '../shell/shellDevices';
import { int, on01, text } from '../you/preferences/prefValues';
import GeneralLayoutCard from './GeneralLayoutCard';
import ServerFrame from './ServerFrame';
import { useServerAccess } from './serverEntries';

const cliTimeout = (raw?: string) => Math.min(60, Math.max(1, int(15)(raw)));

/** Today's ReticulumRetentionSection: an unset or invalid cap reads as the server's default, 2000. */
const DEFAULT_DESTINATIONS_MAX = 2000;
const destinationsMax = (raw?: string) => {
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DESTINATIONS_MAX;
};

export default function GeneralPage() {
  const { t } = useTranslation();
  const { isAdmin } = useServerAccess();
  return (
    <ServerFrame categoryId="general" title={t('workspace.server.general')} scope={t('workspace.server.general_scope')} icon="settings" gate="write">
      <GeneralLayoutCard />
      {isAdmin && <LandingRow />}
      <MeshCoreRows />
      <SettingGroup title={t('reticulum.settings.title', 'Reticulum Settings')}>
        <AutoNumber
          k="reticulum_destinations_max"
          id="general.reticulum_destinations_max"
          label={t('reticulum.settings.destinations_max_label', 'Destination retention cap')}
          help={t(
            'reticulum.settings.destinations_max_description',
            'Maximum announced destinations kept per source. Once a source exceeds this, the oldest non-favorite destinations are pruned. Favorites are never pruned. This cap applies to every Reticulum source.',
          )}
          min={1}
          max={100000}
          parse={destinationsMax}
        />
      </SettingGroup>
    </ServerFrame>
  );
}

function LandingRow() {
  const { t } = useTranslation();
  const s = useSettings();
  const { sources } = useShellDevices();
  return (
    <SettingGroup title={t('workspace.server.landing')}>
      <AutoSelect
        stacked
        k="defaultLandingPage"
        id="general.defaultLandingPage"
        label={t('settings.default_landing_page_label', 'Default Landing Page')}
        help={t('settings.default_landing_page_description', 'Page shown to users at the root URL. The Sources button always returns to the Unified view.')}
        options={[
          { value: 'unified', label: t('settings.default_landing_page_unified', 'Unified View (default)') },
          { value: 'unified-messages', label: t('settings.default_landing_page_unified_messages', 'Unified Messages') },
          { value: 'unified-telemetry', label: t('settings.default_landing_page_unified_telemetry', 'Unified Telemetry') },
          { value: 'map-analysis', label: t('settings.default_landing_page_map_analysis', 'Map Analysis') },
          { value: 'reports', label: t('settings.default_landing_page_reports', 'Reports') },
          ...sources.map((src) => ({ value: src.id, label: src.name })),
        ]}
        parse={text(s.defaultLandingPage)}
        onSaved={(v) => s.setDefaultLandingPage(v)}
      />
    </SettingGroup>
  );
}

function MeshCoreRows() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <SettingGroup title={t('settings.meshcore_messaging', 'MeshCore Messaging')}>
      <AutoToggle
        k="meshcoreChannelRetryEnabled"
        id="general.meshcoreChannelRetryEnabled"
        label={t('settings.meshcore_channel_retry_enabled', 'Auto-retry automated MeshCore channel sends')}
        help={
          <>
            {t(
              'settings.meshcore_channel_retry_description',
              'When enabled, an AUTOMATED MeshCore channel/broadcast message (Automation Engine, Auto-Acknowledge, auto-responder, auto-announce and timer triggers) that hears no repeaters within 30 seconds is resent exactly once. User-initiated sends are never retried. This is opt-in, channel-only, and one-shot — distinct from the always-on retry for direct messages. You may occasionally see a duplicate on the mesh.',
            )}
            <SendsLine>{t('workspace.prefs.meshcore_retry_sends')}</SendsLine>
          </>
        }
        {...on01(false)}
        onSaved={s.setMeshcoreChannelRetryEnabled}
      />
      <AutoNumber
        k="meshcoreCliTimeoutSeconds"
        id="general.meshcoreCliTimeoutSeconds"
        label={t('settings.meshcore_cli_timeout_label', 'Remote CLI reply timeout (seconds)')}
        help={t(
          'settings.meshcore_cli_timeout_description',
          'How long the MeshCore CLI console (repeater/room-server remote admin and the local device console) waits for a reply before giving up, so you can re-fire a command. Lower it when your repeater is in direct range to avoid waiting the full default. Range 1–60s; default 15s.',
        )}
        min={1}
        max={60}
        parse={cliTimeout}
      />
      <AutoToggle
        k="meshcoreCrossSourceHopResolution"
        id="general.meshcoreCrossSourceHopResolution"
        label={t('settings.meshcore_cross_source_hops_label', 'Use other sources to resolve unknown hops')}
        help={t(
          'settings.meshcore_cross_source_hops_description',
          'When a relay hash in a MeshCore message route matches none of this source\'s contacts, look it up in the other MeshCore sources you can read, including MQTT feeds (MQTT nodes count only once a signed advert from them has checked out). Those names are marked "via <source>", and a hash that several nodes share is shown as a guess with a question mark. Display only: nothing is sent. Off by default.',
        )}
        {...on01(false)}
      />
    </SettingGroup>
  );
}
