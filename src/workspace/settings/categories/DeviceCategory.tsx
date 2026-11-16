/**
 * Device › Device: today's Device Configuration section (DeviceConfigSection)
 * on the row kit, with its ranges and checks: NodeInfo every 3600 s or more
 * (0 = firmware default), choosing ROUTER asks first with today's words, a
 * rebroadcast mode other than ALL carries today's warning, and the GPIO pins
 * sit under Advanced. Edits queue as the `device` section.
 */
import { useState } from 'react';
import { BUZZER_MODE_OPTIONS, REBROADCAST_MODE_OPTIONS, ROLE_OPTIONS, TIMEZONE_PRESETS } from '../../../components/configuration/constants';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import { named, useRows } from './rows';
import { Warn } from './RowParts';
import styles from './SettingsPages.module.css';

const ROUTER = 2;

export default function DeviceCategory() {
  const r = useRows('device', 'device');
  const [routerConfirm, setRouterConfirm] = useState(false);
  if (!r) return <StateView kind="loading" />;
  const { s, t } = r;
  const role = ROLE_OPTIONS.find((o) => o.value === s.role);
  const [routerTitle, ...routerBody] = t('device_config.router_warning').split('\n\n');
  const tzOptions = [
    { value: '', label: t('device_config.timezone_not_set') },
    ...TIMEZONE_PRESETS.map((tz) => ({ value: tz.value, label: `${tz.label} (${tz.region})` })),
    ...(s.tzdef && !TIMEZONE_PRESETS.some((tz) => tz.value === s.tzdef) ? [{ value: s.tzdef, label: `${s.tzdef} · ${t('device_config.custom_timezone')}` }] : []),
  ];
  const advanced = [
    r.number('buttonGpio', 'device_config.button_gpio', { min: 0, max: 255 }),
    r.number('buzzerGpio', 'device_config.buzzer_gpio', { min: 0, max: 255 }),
  ];

  return (
    <>
      <SettingGroup>
        {r.select('role', 'device_config.device_role', ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.name })), {
          onChange: (v) => (v === ROUTER ? setRouterConfirm(true) : s.setRole(v)),
          extra: (
            <>
              {' '}
              <a className={styles.link} href="https://meshtastic.org/docs/configuration/radio/device/#roles" target="_blank" rel="noopener noreferrer">
                {t('common.more_info')}
              </a>
              {role && <Warn tone="note">{`${role.shortDesc} ${role.description}`}</Warn>}
            </>
          ),
        })}
        {r.number('nodeInfoBroadcastSecs', 'device_config.node_info_broadcast', {
          min: 3600,
          max: 4294967295,
          alsoValid: [0],
          zeroHint: t('zero_hint.node_info_broadcast'),
        })}
        {r.select('tzdef', 'device_config.timezone', tzOptions)}
        {r.text('tzdef', 'device_config.custom_timezone', { id: 'tzdefCustom', mono: true })}
        {r.select('rebroadcastMode', 'device_config.rebroadcast_mode', named(REBROADCAST_MODE_OPTIONS), {
          extra:
            s.rebroadcastMode !== 0 && (
              <Warn>
                {t(
                  'device_config.rebroadcast_warning',
                  "This mode may prevent the Channel Database from decrypting packets from distant nodes, as encrypted packets won't be forwarded to MeshMonitor for analysis.",
                )}
              </Warn>
            ),
        })}
        {r.select('buzzerMode', 'device_config.buzzer_mode', named(BUZZER_MODE_OPTIONS))}
        {r.toggle('doubleTapAsButtonPress', 'device_config.double_tap_as_button')}
        {r.toggle('disableTripleClick', 'device_config.disable_triple_click')}
        {r.toggle('ledHeartbeatDisabled', 'device_config.led_heartbeat_disabled')}
      </SettingGroup>
      <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>
      <ConfirmSheet
        open={routerConfirm}
        title={routerTitle}
        body={routerBody.join('\n\n')}
        confirmLabel={t('common.ok')}
        onConfirm={() => {
          s.setRole(ROUTER);
          setRouterConfirm(false);
        }}
        onCancel={() => setRouterConfirm(false)}
      />
    </>
  );
}
