/**
 * Saved broker presets (boards 17-08 / 17-15, Task 9.2): today's Save as
 * preset and Manage saved presets dialogs (their state and calls,
 * `useSaveBrokerPresetForm` / `useManageBrokerPresets`, Rule X) drawn as
 * Workspace sheets, one at a time (D9c):
 *
 * - Save as preset: today's fields (name, host, port, TLS, login, root topic
 *   with Find topics) from the form's current values.
 * - Saved broker presets: each preset with Edit, Duplicate and Delete. Edit and
 *   Duplicate open the same form titled Edit preset / Duplicate preset ("Copy
 *   of …"); Delete keeps today's inline "Delete this preset?" in its row.
 *
 * A preset only fills in MQTT forms: saving, editing or deleting one changes
 * no source and no radio, and sends nothing on the mesh. Admins only (the
 * caller shows the buttons only when the list says `canManage`).
 */
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { NumberInput } from '../../components/common/NumberInput';
import { MqttRootFieldError } from '../../components/MQTT/MqttRootFieldError';
import { MqttRootFinder } from '../../components/MQTT/MqttRootFinder';
import { defaultDeviceRegionRoot } from '../../components/MQTT/mqttRootDefaults';
import {
  useManageBrokerPresets,
  useSaveBrokerPresetForm,
  presetFinderTarget,
  withTls,
  type BrokerPresetDraft,
  type EditorValues,
} from '../../components/MQTT/useSavedBrokerPresetEditor';
import type { SavedBrokerPreset } from '../../hooks/useMqttBrokerPresets';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import styles from './BrokerPresetsSheet.module.css';

export interface BrokerPresetsSheetProps {
  /** Save as preset: the form's broker values; null keeps it shut. */
  saveDraft: BrokerPresetDraft | null;
  onCloseSave(): void;
  /** The bridge form never shows a stored password, so it cannot be saved from there. */
  passwordNotIncluded?: boolean;
  manageOpen: boolean;
  onCloseManage(): void;
  presets: SavedBrokerPreset[];
}

export default function BrokerPresetsSheet({
  saveDraft,
  onCloseSave,
  passwordNotIncluded = false,
  manageOpen,
  onCloseManage,
  presets,
}: BrokerPresetsSheetProps) {
  return (
    <>
      <SavePresetSheet draft={saveDraft} onClose={onCloseSave} passwordNotIncluded={passwordNotIncluded} />
      <ManagePresetsSheet open={manageOpen && saveDraft === null} onClose={onCloseManage} presets={presets} />
    </>
  );
}

function SavePresetSheet({ draft, onClose, passwordNotIncluded }: { draft: BrokerPresetDraft | null; onClose(): void; passwordNotIncluded: boolean }) {
  const { t } = useTranslation();
  const isOpen = draft !== null;
  const form = useSaveBrokerPresetForm({ isOpen, draft, onClose });
  const phone = useIsPhone() || undefined;
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t('mqtt_presets.saved.save_title', 'Save as preset')}
      footer={
        <FormFooter
          phone={phone}
          onCancel={onClose}
          onSave={() => void form.save()}
          canSave={form.canSave}
          testId="save-broker-preset-submit"
        />
      }
    >
      <div className={styles.body} data-phone={phone}>
        <p className={styles.hint}>
          {t(
            'mqtt_presets.saved.save_intro',
            'Saves this broker so any MQTT form can fill it in. Only admins see its login; anyone else who picks it gets the login added by the server when they save.',
          )}
        </p>
        {passwordNotIncluded && (
          <p className={styles.hint}>
            {t(
              'mqtt_presets.saved.password_not_included',
              'This form does not show the stored password, so type it below if the preset should include it.',
            )}
          </p>
        )}
        {form.values && <PresetForm values={form.values} onChange={form.setValues} />}
        {form.error && (
          <p className={styles.error} role="alert">
            {form.error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function ManagePresetsSheet({ open, onClose, presets }: { open: boolean; onClose(): void; presets: SavedBrokerPreset[] }) {
  const { t } = useTranslation();
  const m = useManageBrokerPresets({ isOpen: open });
  const phone = useIsPhone() || undefined;
  // One delete request per press.
  const deleting = useRef(false);
  const remove = async (id: number) => {
    if (deleting.current) return;
    deleting.current = true;
    try {
      await m.doDelete(id);
    } finally {
      deleting.current = false;
    }
  };

  if (m.target && m.values) {
    return (
      <Sheet
        open={open}
        // The form is a step of this sheet: closing it goes back to the list, as today's Cancel.
        onClose={m.cancelEdit}
        title={
          m.target.mode === 'edit'
            ? t('mqtt_presets.saved.edit_title', 'Edit preset')
            : t('mqtt_presets.saved.duplicate_title', 'Duplicate preset')
        }
        footer={
          <FormFooter
            phone={phone}
            onCancel={m.cancelEdit}
            onSave={() => void m.saveEdit()}
            canSave={m.canSaveEdit}
            testId="manage-broker-preset-submit"
          />
        }
      >
        <div className={styles.body} data-phone={phone}>
          <PresetForm values={m.values} onChange={m.setValues} />
          {m.error && (
            <p className={styles.error} role="alert">
              {m.error}
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('mqtt_presets.saved.manage_title', 'Saved broker presets')}
      footer={
        <div className={styles.foot} data-phone={phone}>
          <SendsLine>{t('workspace.broker_presets.manage_sends')}</SendsLine>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.wide}`} onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      }
    >
      <div className={styles.body} data-phone={phone}>
        <p className={styles.hint}>
          {t(
            'mqtt_presets.saved.manage_intro',
            'Changing or deleting a preset does not change any source or radio already using its values. Pick the preset again in a form to apply the new values.',
          )}
        </p>
        {presets.length === 0 ? (
          <p className={styles.hint}>{t('mqtt_presets.saved.none', 'No saved presets yet. Use Save as preset in an MQTT form.')}</p>
        ) : (
          <ul className={styles.list}>
            {presets.map((p) => (
              <li key={p.id} className={styles.row} data-testid={`saved-broker-preset-${p.id}`}>
                <span className={styles.rowName}>{p.name}</span>
                <span className={styles.endpoint}>
                  {`${p.tls ? 'mqtts' : 'mqtt'}://${p.host}:${p.port}`}
                  {p.rootTopic ? ` · ${p.rootTopic}` : ''}
                </span>
                {m.confirmDeleteId === p.id ? (
                  <div className={styles.rowActions}>
                    <span className={styles.ask}>{t('mqtt_presets.saved.confirm_delete', 'Delete this preset?')}</span>
                    <button type="button" className={styles.button} onClick={() => m.setConfirmDeleteId(null)}>
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.danger}`}
                      onClick={() => void remove(p.id)}
                      disabled={m.deletePending}
                      data-testid={`saved-broker-preset-confirm-delete-${p.id}`}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                ) : (
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.button} onClick={() => m.startEdit({ mode: 'edit', preset: p })}>
                      <UiIcon name="edit" size={16} />
                      {t('common.edit', 'Edit')}
                    </button>
                    <button type="button" className={styles.button} onClick={() => m.startEdit({ mode: 'duplicate', preset: p })}>
                      <UiIcon name="copy" size={16} />
                      {t('mqtt_presets.saved.duplicate', 'Duplicate')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.danger} ${styles.end}`}
                      onClick={() => m.setConfirmDeleteId(p.id)}
                      data-testid={`saved-broker-preset-delete-${p.id}`}
                    >
                      <UiIcon name="delete" size={16} />
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {m.error && (
          <p className={styles.error} role="alert">
            {m.error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function FormFooter({ phone, onCancel, onSave, canSave, testId }: { phone?: true; onCancel(): void; onSave(): void; canSave: boolean; testId: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.foot} data-phone={phone}>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onCancel}>
          {t('common.cancel', 'Cancel')}
        </button>
        <button type="button" className={`${styles.button} ${styles.primary}`} onClick={onSave} disabled={!canSave} data-testid={testId}>
          {t('mqtt_presets.saved.save_button', 'Save preset')}
        </button>
      </div>
      <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
    </div>
  );
}

/** Today's preset fields (SavedBrokerPresetDialogs' editor) on the Workspace form. */
function PresetForm({ values, onChange }: { values: EditorValues; onChange(next: EditorValues): void }) {
  const { t } = useTranslation();
  const id = useId();
  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => onChange({ ...values, [key]: value });
  const field = (key: keyof EditorValues) => `${id}-${key}`;
  const text = (key: 'name' | 'host' | 'username' | 'rootTopic', label: string, extra: { placeholder?: string; maxLength?: number; mono?: boolean } = {}) => (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={field(key)}>
        {label}
      </label>
      <input
        id={field(key)}
        type="text"
        className={extra.mono ? `${styles.input} ${styles.mono}` : styles.input}
        autoComplete="off"
        maxLength={extra.maxLength}
        placeholder={extra.placeholder}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );
  return (
    <div className={styles.form}>
      {text('name', t('mqtt_presets.saved.field_name', 'Preset name'), {
        maxLength: 64,
        placeholder: t('mqtt_presets.saved.field_name_placeholder', 'e.g. Florida Mesh Broker'),
      })}
      {text('host', t('mqtt_presets.saved.field_host', 'Broker host'), { placeholder: 'broker.example.org', mono: true })}
      <div className={styles.portRow}>
        <div className={`${styles.field} ${styles.port}`}>
          <label className={styles.label} htmlFor={field('port')}>
            {t('mqtt_presets.saved.field_port', 'Port')}
          </label>
          <NumberInput
            id={field('port')}
            className={`${styles.input} ${styles.mono}`}
            integer
            min={1}
            max={65535}
            value={values.port}
            onChange={(port) => set('port', port)}
          />
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={values.tls}
            onChange={(e) => onChange(withTls(values, e.target.checked))}
          />
          {t('mqtt_presets.saved.field_tls', 'Use TLS')}
        </label>
      </div>
      {text('username', t('mqtt_presets.saved.field_username', 'Username'))}
      <div className={styles.field}>
        <label className={styles.label} htmlFor={field('password')}>
          {t('mqtt_presets.saved.field_password', 'Password')}
        </label>
        <input
          id={field('password')}
          type="password"
          className={styles.input}
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </div>
      {text('rootTopic', t('mqtt_presets.saved.field_root', 'Root topic (optional)'), { placeholder: 'msh/US/FL', mono: true })}
      <MqttRootFieldError value={values.rootTopic} />
      <MqttRootFinder
        context="preset"
        defaultRegionRoot={defaultDeviceRegionRoot(values.rootTopic)}
        currentRoot={values.rootTopic}
        getTarget={() => presetFinderTarget(values)}
        onPickRoot={(root) => set('rootTopic', root)}
      />
      <p className={styles.hint}>
        {t('mqtt_presets.saved.root_hint', 'When set, picking the preset fills a device’s root topic, and sets a bridge’s subscription to <root>/#.')}
      </p>
    </div>
  );
}
