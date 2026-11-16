/**
 * Device › Position: today's Position section (PositionConfigSection) on the
 * row kit, with its ranges: broadcast every 32 s or more (0 = firmware
 * default), the fixed position to 7 decimals with today's map picker, smart
 * broadcast's two minimums, the position flags and, under Advanced, the GPS
 * pins. Edits queue as the `position` section; Reload config keeps the fixed
 * coordinates, as today (radioSections KEEP_ON_RELOAD).
 */
import { useTranslation } from 'react-i18next';
import { GPS_MODE_OPTIONS, POSITION_FLAGS } from '../../../components/configuration/constants';
import { LocationPinPicker } from '../../../components/map/LocationPinPicker';
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import SettingRow from '../kit/SettingRow';
import SettingToggle from '../kit/SettingToggle';
import { useReadOnly } from '../kit/useFieldRegistry';
import { useRadioSaveQueue } from '../useRadioSaveQueue';
import { named, useRows } from './rows';
import styles from './SettingsPages.module.css';

const FIXED_COORD_DECIMALS = 7;
const FIXED_COORD_STEP = 1e-7;
const MAX = 4294967295;

export default function PositionCategory() {
  const r = useRows('position', 'position');
  const base = useRadioSaveQueue()?.baseline('position');
  const readOnly = useReadOnly();
  const { t } = useTranslation();
  if (!r) return <StateView kind="loading" />;
  const { s } = r;
  const flag = (bit: number, flags: unknown) => (Number(flags) & bit) !== 0;
  const toggleFlag = (bit: number) => s.setPositionFlags(s.positionFlags & bit ? s.positionFlags & ~bit : s.positionFlags | bit);
  const advanced = [
    r.number('rxGpio', 'position_config.rx_gpio', { min: 0, max: 255 }),
    r.number('txGpio', 'position_config.tx_gpio', { min: 0, max: 255 }),
    r.number('gpsEnGpio', 'position_config.gps_en_gpio', { min: 0, max: 255 }),
  ];

  return (
    <>
      <SettingGroup>
        {r.number('positionBroadcastSecs', 'position_config.broadcast_interval', {
          min: 32,
          max: MAX,
          alsoValid: [0],
          zeroHint: t('zero_hint.position_broadcast'),
        })}
        {r.toggle('positionSmartEnabled', 'position_config.smart_broadcast')}
        {r.toggle('fixedPosition', 'position_config.fixed_position')}
        {s.fixedPosition && (
          <>
            {r.number('fixedLatitude', 'position_config.latitude', {
              step: FIXED_COORD_STEP,
              min: -90,
              max: 90,
              extra: (
                <>
                  {' · '}
                  <a className={styles.link} href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer">
                    {t('position_config.find_coordinates')}
                  </a>
                </>
              ),
            })}
            {r.number('fixedLongitude', 'position_config.longitude', { step: FIXED_COORD_STEP, min: -180, max: 180 })}
            {r.number('fixedAltitude', 'position_config.altitude', { step: 1 })}
            <div className={styles.infoRow} data-setting-id="position.pickOnMap">
              <span className={styles.infoText}>
                <span className={styles.infoLabel}>{t('position_config.pick_on_map', 'Pick on map')}</span>
                <span className={styles.infoHelp}>
                  {t('position_config.pick_on_map_description', 'Click the map or drag the pin to set the fixed position, then save.')}
                </span>
              </span>
              <div className={styles.mapPicker}>
                <LocationPinPicker
                  lat={s.fixedLatitude}
                  lon={s.fixedLongitude}
                  onChange={(la, lo) => {
                    s.setFixedLatitude(la);
                    s.setFixedLongitude(lo);
                  }}
                  disabled={readOnly}
                  decimals={FIXED_COORD_DECIMALS}
                  testId="fixed-position-map"
                />
              </div>
            </div>
          </>
        )}
        {r.select('gpsMode', 'position_config.gps_mode', named(GPS_MODE_OPTIONS))}
        {r.number('gpsUpdateInterval', 'position_config.gps_update_interval', { min: 0, max: MAX })}
        {s.positionSmartEnabled && (
          <>
            {r.number('broadcastSmartMinimumDistance', 'position_config.smart_min_distance', { min: 0, max: MAX })}
            {r.number('broadcastSmartMinimumIntervalSecs', 'position_config.smart_min_interval', { min: 0, max: MAX })}
          </>
        )}
      </SettingGroup>

      <SettingGroup title={t('position_config.position_flags')}>
        <p className={styles.groupNote}>{t('position_config.position_flags_description')}</p>
        {POSITION_FLAGS.map((f) => (
          <SettingRow
            key={f.name}
            id={`position.flag.${f.name}`}
            label={f.name}
            help={f.description}
            was={base && flag(f.value, base.positionFlags) !== flag(f.value, s.positionFlags) ? t(flag(f.value, base.positionFlags) ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off') : undefined}
          >
            <SettingToggle checked={flag(f.value, s.positionFlags)} onChange={() => toggleFlag(f.value)} />
          </SettingRow>
        ))}
      </SettingGroup>

      <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>
    </>
  );
}
