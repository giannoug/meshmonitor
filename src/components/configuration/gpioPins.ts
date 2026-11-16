/**
 * The GPIO pins the device configuration sets, and where (GpioPinSummary;
 * the Workspace's "Pins in use" card). A pin of 0 is unset and left out.
 */
import type { TFunction } from 'i18next';

export interface PinUsage {
  pin: number;
  section: string;
  field: string;
  fieldKey: keyof GpioPinValues;
}

export interface GpioPinValues {
  // Device Config
  buttonGpio: number;
  buzzerGpio: number;
  // Position Config
  rxGpio: number;
  txGpio: number;
  gpsEnGpio: number;
  // External Notification Config
  extNotifOutput: number;
  extNotifOutputVibra: number;
  extNotifOutputBuzzer: number;
  // Canned Message Config
  cannedMsgInputbrokerPinA: number;
  cannedMsgInputbrokerPinB: number;
  cannedMsgInputbrokerPinPress: number;
  // Audio Config
  audioPttPin: number;
  audioI2sWs: number;
  audioI2sSd: number;
  audioI2sDin: number;
  audioI2sSck: number;
  // Detection Sensor Config
  detectionSensorMonitorPin: number;
  // Serial Config
  serialRxd: number;
  serialTxd: number;
}

export function gpioPinUsages(props: GpioPinValues, t: TFunction): PinUsage[] {
  const usages: PinUsage[] = [];

  // Helper to add pin usage if pin is not 0 (0 often means disabled/default)
  const addPin = (pin: number, section: string, field: string, fieldKey: keyof GpioPinValues) => {
    if (pin !== 0) {
      usages.push({ pin, section, field, fieldKey });
    }
  };

  // Device Config
  addPin(props.buttonGpio, t('config.device_config'), t('gpio_summary.button_gpio'), 'buttonGpio');
  addPin(props.buzzerGpio, t('config.device_config'), t('gpio_summary.buzzer_gpio'), 'buzzerGpio');

  // Position Config
  addPin(props.rxGpio, t('config.position_config'), t('gpio_summary.gps_rx'), 'rxGpio');
  addPin(props.txGpio, t('config.position_config'), t('gpio_summary.gps_tx'), 'txGpio');
  addPin(props.gpsEnGpio, t('config.position_config'), t('gpio_summary.gps_enable'), 'gpsEnGpio');

  // External Notification Config
  addPin(props.extNotifOutput, t('extnotif_config.title'), t('gpio_summary.led_output'), 'extNotifOutput');
  addPin(props.extNotifOutputVibra, t('extnotif_config.title'), t('gpio_summary.vibra_output'), 'extNotifOutputVibra');
  addPin(props.extNotifOutputBuzzer, t('extnotif_config.title'), t('gpio_summary.buzzer_output'), 'extNotifOutputBuzzer');

  // Canned Message Config
  addPin(props.cannedMsgInputbrokerPinA, t('cannedmsg_config.title'), t('gpio_summary.encoder_pin_a'), 'cannedMsgInputbrokerPinA');
  addPin(props.cannedMsgInputbrokerPinB, t('cannedmsg_config.title'), t('gpio_summary.encoder_pin_b'), 'cannedMsgInputbrokerPinB');
  addPin(props.cannedMsgInputbrokerPinPress, t('cannedmsg_config.title'), t('gpio_summary.encoder_press'), 'cannedMsgInputbrokerPinPress');

  // Audio Config
  addPin(props.audioPttPin, t('audio_config.title'), t('gpio_summary.ptt_pin'), 'audioPttPin');
  addPin(props.audioI2sWs, t('audio_config.title'), t('gpio_summary.i2s_ws'), 'audioI2sWs');
  addPin(props.audioI2sSd, t('audio_config.title'), t('gpio_summary.i2s_sd'), 'audioI2sSd');
  addPin(props.audioI2sDin, t('audio_config.title'), t('gpio_summary.i2s_din'), 'audioI2sDin');
  addPin(props.audioI2sSck, t('audio_config.title'), t('gpio_summary.i2s_sck'), 'audioI2sSck');

  // Detection Sensor Config
  addPin(props.detectionSensorMonitorPin, t('detectionsensor_config.title'), t('gpio_summary.monitor_pin'), 'detectionSensorMonitorPin');

  // Serial Config
  addPin(props.serialRxd, t('serial_config.title'), t('gpio_summary.serial_rx'), 'serialRxd');
  addPin(props.serialTxd, t('serial_config.title'), t('gpio_summary.serial_tx'), 'serialTxd');

  return usages;
}

/** The usages by pin, pin order: more than one usage on a pin is a conflict. */
export function groupPinUsages(usages: PinUsage[]): Array<[number, PinUsage[]]> {
  const groups = new Map<number, PinUsage[]>();
  for (const usage of usages) {
    const existing = groups.get(usage.pin) || [];
    existing.push(usage);
    groups.set(usage.pin, existing);
  }
  return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
}
