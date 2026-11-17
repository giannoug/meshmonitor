/**
 * You › Preferences › MeshCore Messaging (Task 6.3): today's MeshCore
 * Messaging section of global Settings on the settings kit, saving as you
 * go. No board draws it here; s13n5 puts it in Server › General, which Task
 * 6.4 redraws, so until then it keeps today's place in the preference list.
 *
 * Mesh impact: the channel auto-retry is today's opt-in, one-shot resend of
 * an automated channel send that heard no repeater in 30 s; its row carries
 * the Sends line. The CLI timeout and cross-source hop names send nothing.
 */
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';
import SendsLine from '../../patterns/SendsLine';
import SettingGroup from '../../settings/kit/SettingGroup';
import { AutoNumber, AutoToggle } from '../../settings/categories/autosave';
import PrefsFrame from './PrefsFrame';
import { int, on01 } from './prefValues';

const cliTimeout = (raw?: string) => Math.min(60, Math.max(1, int(15)(raw)));

export default function MeshCoreMessagingPage() {
  const { t } = useTranslation();
  const s = useSettings();
  return (
    <PrefsFrame categoryId="meshcore-messaging" title={t('settings.meshcore_messaging', 'MeshCore Messaging')} icon="messages">
      <SettingGroup>
        <AutoToggle
          k="meshcoreChannelRetryEnabled"
          id="meshcore-messaging.meshcoreChannelRetryEnabled"
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
          id="meshcore-messaging.meshcoreCliTimeoutSeconds"
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
          id="meshcore-messaging.meshcoreCrossSourceHopResolution"
          label={t('settings.meshcore_cross_source_hops_label', 'Use other sources to resolve unknown hops')}
          help={t(
            'settings.meshcore_cross_source_hops_description',
            'When a relay hash in a MeshCore message route matches none of this source\'s contacts, look it up in the other MeshCore sources you can read, including MQTT feeds (MQTT nodes count only once a signed advert from them has checked out). Those names are marked "via <source>", and a hash that several nodes share is shown as a guess with a question mark. Display only: nothing is sent. Off by default.',
          )}
          {...on01(false)}
        />
      </SettingGroup>
    </PrefsFrame>
  );
}
