/**
 * Request Telemetry (boards 15-05, 15-25): TelemetryRequestModal's four types
 * in a Sheet. A tap on a type sends today's one request, as the modal does;
 * the sheet carries the board's Sends line.
 */
import { useTranslation } from 'react-i18next';
import { UiIcon, type UiIconName } from '../../../components/icons';
import type { TelemetryRequestType } from '../../../hooks/useMeshtasticNodeActions';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import styles from './RequestTelemetrySheet.module.css';

export interface RequestTelemetrySheetProps {
  open: boolean;
  nodeName: string;
  busy: boolean;
  onClose(): void;
  onPick(type: TelemetryRequestType): void;
}

const TYPES: Array<{ type: TelemetryRequestType; icon: UiIconName; key: string }> = [
  { type: 'device', icon: 'companion', key: 'device' },
  { type: 'environment', icon: 'sensor', key: 'environment' },
  { type: 'airQuality', icon: 'airQuality', key: 'air_quality' },
  { type: 'power', icon: 'zap', key: 'power' },
];

export default function RequestTelemetrySheet({ open, nodeName, busy, onClose, onPick }: RequestTelemetrySheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('messages.request_telemetry')}>
      <div className={styles.body}>
        <p className={styles.prompt}>{t('messages.select_telemetry_type', { nodeName })}</p>
        <div className={styles.types}>
          {TYPES.map(({ type, icon, key }) => (
            <button key={type} type="button" className={styles.type} disabled={busy} onClick={() => onPick(type)}>
              <UiIcon name={icon} size={18} />
              <span className={styles.text}>
                <span className={styles.label}>{t(`messages.telemetry_type_${key}`)}</span>
                <span className={styles.desc}>{t(`messages.telemetry_type_${key}_desc`)}</span>
              </span>
            </button>
          ))}
        </div>
        <SendsLine>{t('workspace.node_dialogs.telemetry_sends')}</SendsLine>
      </div>
    </Sheet>
  );
}
