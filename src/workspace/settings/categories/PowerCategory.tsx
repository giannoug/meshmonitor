/**
 * Device › Power: today's Power section (PowerConfigSection) on the row kit,
 * with its ranges (ADC multiplier 0–10 in 0.01 steps, INA address 0–127 under
 * Advanced) and today's duration hints. Edits queue as the `power` section.
 */
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import { useDuration, useRows } from './rows';

const MAX = 4294967295;

export default function PowerCategory() {
  const r = useRows('power', 'power');
  const duration = useDuration();
  if (!r) return <StateView kind="loading" />;
  const { s, t } = r;
  const secs = (key: 'onBatteryShutdownAfterSecs' | 'waitBluetoothSecs' | 'sdsSecs' | 'lsSecs', label: string) =>
    r.number(key, label, { min: 0, max: MAX, help: t(`${label}_description`) + duration(s[key]) });
  const advanced = [r.number('deviceBatteryInaAddress', 'power_config.ina_address', { min: 0, max: 127 })];

  return (
    <>
      <SettingGroup>
        {r.toggle('isPowerSaving', 'power_config.power_saving')}
        {secs('onBatteryShutdownAfterSecs', 'power_config.shutdown_on_battery')}
        {r.number('adcMultiplierOverride', 'power_config.adc_multiplier', { min: 0, max: 10, step: 0.01 })}
        {secs('waitBluetoothSecs', 'power_config.bluetooth_wait')}
        {secs('sdsSecs', 'power_config.super_deep_sleep')}
        {secs('lsSecs', 'power_config.light_sleep')}
        {r.number('minWakeSecs', 'power_config.min_wake', { min: 0, max: MAX })}
      </SettingGroup>
      <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>
    </>
  );
}
