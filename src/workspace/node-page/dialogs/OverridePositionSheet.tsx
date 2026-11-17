/**
 * Position Override (board 15-05; s15n5 "a bottom sheet with the desktop
 * fields" on phone): PositionOverrideModal's form (usePositionOverrideForm):
 * use a custom position, private, latitude / longitude / altitude, saved
 * through today's request. It sends nothing on the mesh.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/common/NumberInput';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { usePositionOverrideForm, type PositionOverrideValue } from '../../../hooks/usePositionOverrideForm';
import type { DeviceInfo } from '../../../types/device';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import styles from './OverridePositionSheet.module.css';

export interface OverridePositionSheetProps {
  open: boolean;
  node: DeviceInfo;
  nodeName: string;
  onClose(): void;
  onSave(nodeNum: number, data: PositionOverrideValue): Promise<void>;
  /** MeshCore reads the saved override from its own route (`node.user.id` is the public key). */
  protocol?: 'meshtastic' | 'meshcore';
}

export default function OverridePositionSheet({ open, node, nodeName, onClose, onSave, protocol }: OverridePositionSheetProps) {
  const { t } = useTranslation();
  const id = useId();
  const form = usePositionOverrideForm({ isOpen: open, nodeId: node.user?.id, nodeNum: node.nodeNum, onSave, onClose, protocol });

  return (
    <ConfirmSheet
      open={open}
      title={t('position_override.title', { nodeName })}
      confirmLabel={form.saving ? t('common.saving') : t('common.save')}
      busy={form.saving}
      confirmDisabled={form.loading || form.saveDisabled}
      onCancel={onClose}
      onConfirm={form.handleSave}
      body={
        form.loading ? (
          <p className={`${styles.form} ${styles.muted}`}>{t('common.loading')}...</p>
        ) : (
          <NumberInputScope scope={form.numberScope}>
            <div className={styles.form}>
              <p className={styles.muted}>{t('position_override.description')}</p>
              <label className={styles.check}>
                <input type="checkbox" checked={form.enabled} onChange={(e) => form.setEnabled(e.target.checked)} disabled={form.saving} />
                {t('position_override.use_position')}
              </label>
              {form.enabled && (
                <>
                  <label className={styles.check}>
                    <input type="checkbox" checked={form.isPrivate} onChange={(e) => form.setIsPrivate(e.target.checked)} disabled={form.saving} />
                    <span className={styles.text}>
                      {t('position_override.private')}
                      <span className={styles.muted}>{t('position_override.private_description')}</span>
                    </span>
                  </label>
                  <div className={styles.coords}>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-lat`} className={styles.label}>{t('position_override.latitude')}</label>
                      <NumberInput
                        id={`${id}-lat`}
                        className={styles.input}
                        step={0.000001}
                        min={-90}
                        max={90}
                        value={form.latitude === '' ? null : Number(form.latitude)}
                        onChange={form.handleLatitudeChange}
                        disabled={form.saving}
                        showReason
                      />
                      {form.latError && <span className={styles.error}>{form.latError}</span>}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-lng`} className={styles.label}>{t('position_override.longitude')}</label>
                      <NumberInput
                        id={`${id}-lng`}
                        className={styles.input}
                        step={0.000001}
                        min={-180}
                        max={180}
                        value={form.longitude === '' ? null : Number(form.longitude)}
                        onChange={form.handleLongitudeChange}
                        disabled={form.saving}
                        showReason
                      />
                      {form.lngError && <span className={styles.error}>{form.lngError}</span>}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-alt`} className={styles.label}>{t('position_override.altitude')}</label>
                      <NumberInput
                        id={`${id}-alt`}
                        className={styles.input}
                        allowEmpty
                        step={1}
                        value={form.altitude === '' ? null : Number(form.altitude)}
                        onChange={(v) => form.setAltitude(v === null ? '' : String(v))}
                        disabled={form.saving}
                      />
                    </div>
                  </div>
                  <a className={styles.link} href="https://www.latlong.net/" target="_blank" rel="noopener noreferrer">
                    {t('position_override.find_coordinates')}
                  </a>
                </>
              )}
              <SendsLine>{t('workspace.node_dialogs.override_sends')}</SendsLine>
              {form.error && <p className={styles.error} role="alert">{form.error}</p>}
            </div>
          </NumberInputScope>
        )
      }
    />
  );
}
