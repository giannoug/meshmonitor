/**
 * Device › Display: today's Display section (DisplayConfigSection) on the row
 * kit, with today's duration hints; the OLED type and compass orientation sit
 * under Advanced. Edits queue as the `display` section.
 */
import { COMPASS_ORIENTATION_OPTIONS, DISPLAY_MODES, OLED_TYPES, UNITS_OPTIONS } from '../../../components/configuration/constants';
import StateView from '../../patterns/StateView';
import AdvancedCard from '../kit/AdvancedCard';
import SettingGroup from '../kit/SettingGroup';
import { labelled, useDuration, useRows } from './rows';

const MAX = 4294967295;

export default function DisplayCategory() {
  const r = useRows('display', 'display');
  const duration = useDuration();
  if (!r) return <StateView kind="loading" />;
  const { s, t } = r;
  const advanced = [
    r.select('oled', 'display_config.oled_type', labelled(OLED_TYPES)),
    r.select('compassOrientation', 'display_config.compass_orientation', labelled(COMPASS_ORIENTATION_OPTIONS)),
  ];

  return (
    <>
      <SettingGroup>
        {r.number('screenOnSecs', 'display_config.screen_on_secs', {
          min: 0,
          max: MAX,
          help: t('display_config.screen_on_secs_description') + duration(s.screenOnSecs, false),
        })}
        {r.number('autoScreenCarouselSecs', 'display_config.auto_carousel', {
          min: 0,
          max: MAX,
          help: t('display_config.auto_carousel_description') + duration(s.autoScreenCarouselSecs, false),
        })}
        {r.toggle('flipScreen', 'display_config.flip_screen')}
        {r.select('displayUnits', 'display_config.units', labelled(UNITS_OPTIONS))}
        {r.select('displayMode', 'display_config.display_mode', labelled(DISPLAY_MODES))}
        {r.toggle('headingBold', 'display_config.heading_bold')}
        {r.toggle('wakeOnTapOrMotion', 'display_config.wake_on_tap')}
      </SettingGroup>
      <AdvancedCard count={advanced.length}>{advanced}</AdvancedCard>
    </>
  );
}
