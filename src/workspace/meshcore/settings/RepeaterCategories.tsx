/**
 * A local repeater's Adverts & forwarding, Access and Clock (Task 7.4, note
 * s8n4: "A local repeater adds Adverts & forwarding, Access and Clock"), on
 * the row kit over today's local repeater logic (useRepeaterSettingsDraft,
 * mode `local`): ranges, Off, version gates, today's warnings and write-only
 * passwords. The values are read over the serial CLI once while the device's
 * settings stay open (LocalRepeaterProvider). Each page saves from its own
 * bar: one `saveRepeaterSettings` request with that page's changed fields
 * only, then today's read again. Clock is today's Sync clock.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useNumberInputScope } from '../../../components/common/numberInputScopeContext';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { useRepeaterSettingsDraft, type DraftKey } from '../../../components/MeshCore/hooks/useRepeaterSettingsDraft';
import type { RepeaterSettingsSnapshot } from '../../../components/MeshCore/hooks/useMeshCore';
import { getRepeaterSettingDef } from '../../../utils/meshcoreRepeaterSettings';
import SendsLine from '../../patterns/SendsLine';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useReadOnly, useSettingRow } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { SETTING_LABELS, formatSetting } from '../remote/remoteTarget';
import { useLocalRepeater } from './localRepeater';
import { DeviceNotes, McDock, McPage } from './mcShared';
import { useMcDevice } from './useMcDevice';
import styles from './McSettings.module.css';

const STEPS: Partial<Record<DraftKey, number>> = { advertInterval: 2, af: 0.1, rxDelay: 0.1, txDelay: 0.05, directTxDelay: 0.05 };
const ADVERT_KEYS: DraftKey[] = ['advertInterval', 'floodAdvertInterval', 'floodMax', 'repeat', 'af', 'rxDelay', 'txDelay', 'directTxDelay'];

/** The read state: Reading…, or Could not read with Retry; children once read. */
function Loaded({ children }: { children: (snapshot: RepeaterSettingsSnapshot) => ReactNode }) {
  const { t } = useTranslation();
  const r = useLocalRepeater();
  if (!r) return null;
  if (r.snapshot) return <>{children(r.snapshot)}</>;
  return (
    <p className={styles.note} role="status">
      {r.loading ? t('meshcore.repeater.loading', 'Reading repeater settings…') : t('meshcore.repeater.load_failed', 'Could not read the repeater settings.')}{' '}
      {!r.loading && (
        <button type="button" className={styles.button} onClick={() => void r.load()}>
          {t('meshcore.repeater.retry', 'Retry')}
        </button>
      )}
    </p>
  );
}

function useLocalDraft(snapshot: RepeaterSettingsSnapshot, onAdminChanged?: () => void) {
  const d = useMcDevice();
  const r = useLocalRepeater();
  const numbers = useNumberInputScope();
  const draft = useRepeaterSettingsDraft({
    values: snapshot.values,
    firmwareVersion: snapshot.firmware?.version ?? d.local?.ver,
    radio: { sf: d.local?.radioSf, bw: d.local?.radioBw, cr: d.local?.radioCr },
    canWrite: d.canWriteConfig,
    onSave: d.actions.saveRepeaterSettings,
    onSaved: (patch, response) => {
      if (patch.adminPassword !== undefined && response.results.adminPassword?.ok) onAdminChanged?.();
      void r?.load();
    },
    mode: 'local',
    numbers,
  });
  return { draft, numbers };
}

type Draft = ReturnType<typeof useRepeaterSettingsDraft>;

function Dock({ draft, page, numbers }: { draft: Draft; page: string; numbers: ReturnType<typeof useNumberInputScope> }) {
  const { t } = useTranslation();
  const changes = Object.keys(draft.changed).map((k) => {
    const [key, fallback] = SETTING_LABELS[k as keyof typeof SETTING_LABELS] ?? [k, k];
    return t(key, fallback);
  });
  return (
    <McDock
      changes={changes}
      page={page}
      sends={t('workspace.meshcore.settings.sends_repeater')}
      saveLabel={t('meshcore.repeater.save')}
      saving={draft.saving}
      blocked={draft.locked || numbers.invalid || draft.secretInvalid}
      error={draft.requestFailed ? t('meshcore.repeater.save_failed') : draft.drifted ? t('meshcore.repeater.drifted') : null}
      onSave={() => void draft.handleSave()}
      onDiscard={draft.handleDiscard}
    />
  );
}

/** One row: today's label, help and the last save's outcome, "was …" while edited. */
function Row({ draft, k, help, children }: { draft: Draft; k: DraftKey; help?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const [labelKey, fallback] = SETTING_LABELS[k];
  const before = draft.baseline[k];
  const now = draft.draft[k];
  const result = draft.results?.[k];
  return (
    <SettingRow
      id={`meshcore.repeater.${k}`}
      label={t(labelKey, fallback)}
      help={
        (help || (result && !result.ok)) && (
          <>
            {help}
            {result && !result.ok && <Warn tone="danger">{result.error ?? t('meshcore.repeater.result_failed')}</Warn>}
          </>
        )
      }
      was={before !== undefined && now !== undefined && now !== before ? formatSetting(t, k, before) : undefined}
    >
      {children}
    </SettingRow>
  );
}

function NumberValue({ draft, k, stepper }: { draft: Draft; k: DraftKey; stepper?: boolean }) {
  const def = getRepeaterSettingDef(k);
  const value = draft.draft[k] ?? draft.baseline[k];
  if (typeof value !== 'number') return <span className={styles.muted}>—</span>;
  return (
    <SettingNumber
      value={value}
      min={def?.min}
      max={def?.max}
      step={STEPS[k] ?? 1}
      stepper={stepper}
      alsoValid={def?.offAllowed ? [0] : undefined}
      readOnly={draft.locked}
      onChange={(n) => draft.setField(k, n)}
    />
  );
}

export function RepeaterAdvertsCategory(_props: CategoryProps) {
  return (
    <McPage>
      <DeviceNotes />
      <Loaded>{(snapshot) => <Adverts snapshot={snapshot} />}</Loaded>
    </McPage>
  );
}

function Adverts({ snapshot }: { snapshot: RepeaterSettingsSnapshot }) {
  const { t } = useTranslation();
  const { draft: d, numbers } = useLocalDraft(snapshot);
  return (
    <>
      <NumberInputScope scope={numbers}>
        <SettingGroup>
          {ADVERT_KEYS.filter((k) => d.shows(k)).map((k) =>
            k === 'repeat' ? (
              <Row key={k} draft={d} k={k} help={d.repeatOff && <Warn>{t('meshcore.repeater.warn_repeat_off')}</Warn>}>
                <SettingToggle checked={(d.draft.repeat ?? d.baseline.repeat) === true} readOnly={d.locked || d.baseline.repeat === undefined} onChange={(v) => d.setField('repeat', v)} />
              </Row>
            ) : (
              <Row
                key={k}
                draft={d}
                k={k}
                help={
                  k === 'advertInterval' ? d.advertWarning && <Warn tone="note">{d.advertWarning}</Warn>
                  : k === 'floodAdvertInterval' ? d.floodWarning && <Warn tone="note">{d.floodWarning}</Warn>
                  : k === 'floodMax' ? d.floodMaxLow && <Warn>{t('meshcore.repeater.warn_flood_max')}</Warn>
                  : k === 'af' ? d.afLow && <Warn>{t('meshcore.repeater.warn_af')}</Warn>
                  : undefined
                }
              >
                <NumberValue draft={d} k={k} stepper={k === 'floodMax'} />
              </Row>
            ),
          )}
        </SettingGroup>
      </NumberInputScope>
      <Dock draft={d} page={t('meshcore.repeater.adverts_title')} numbers={numbers} />
    </>
  );
}

export function RepeaterAccessCategory(_props: CategoryProps) {
  return (
    <McPage>
      <DeviceNotes />
      <Loaded>{(snapshot) => <Access snapshot={snapshot} />}</Loaded>
    </McPage>
  );
}

function Access({ snapshot }: { snapshot: RepeaterSettingsSnapshot }) {
  const { t } = useTranslation();
  const [adminChanged, setAdminChanged] = useState(false);
  const { draft: d, numbers } = useLocalDraft(snapshot, () => setAdminChanged(true));
  const set = snapshot.guestPasswordSet;
  return (
    <>
      <SettingGroup>
        <SettingRow
          id="meshcore.repeater.guestPassword"
          label={t(...SETTING_LABELS.guestPassword)}
          help={d.guestHasError ? <Warn tone="danger">{t('meshcore.repeater.password_invalid_guest')}</Warn> : set ? t('meshcore.repeater.guest_set') : t('meshcore.repeater.guest_unset')}
        >
          <Secret value={d.guestPassword} off={d.locked || d.clearGuest} onChange={d.setGuestPassword} />
        </SettingRow>
        {set && (
          <SettingRow id="meshcore-repeater.clearGuest" label={t('meshcore.repeater.clear_guest')}>
            <SettingToggle
              checked={d.clearGuest}
              readOnly={d.locked}
              onChange={(v) => {
                d.setClearGuest(v);
                if (v) d.setGuestPassword('');
              }}
            />
          </SettingRow>
        )}
        <Row draft={d} k="allowReadOnly">
          <SettingToggle checked={(d.draft.allowReadOnly ?? d.baseline.allowReadOnly) === true} readOnly={d.locked || d.baseline.allowReadOnly === undefined} onChange={(v) => d.setField('allowReadOnly', v)} />
        </Row>
        {d.shows('adminPassword') && (
          <SettingRow
            id="meshcore.repeater.adminPassword"
            label={t(...SETTING_LABELS.adminPassword)}
            help={d.adminHasError ? <Warn tone="danger">{t('meshcore.repeater.password_invalid_admin')}</Warn> : t('meshcore.repeater.leave_blank')}
          >
            <Secret value={d.adminPassword} off={d.locked} onChange={d.setAdminPassword} />
          </SettingRow>
        )}
      </SettingGroup>
      {adminChanged && (
        <Warn>
          {t('meshcore.repeater.stale_credentials', 'The admin password changed. Saved remote-admin credentials for this repeater are now stale: update them in the remote admin login.')}
        </Warn>
      )}
      <Dock draft={d} page={t('workspace.meshcore.settings.access')} numbers={numbers} />
    </>
  );
}

/** Write-only, as today: blank keeps the stored value; nothing is read back. */
function Secret({ value, off, onChange }: { value: string; off: boolean; onChange(v: string): void }) {
  const { t } = useTranslation();
  const row = useSettingRow();
  return (
    <PasswordField
      id={row?.inputId}
      aria-describedby={row?.helpId}
      autoComplete="off"
      className={styles.input}
      value={value}
      placeholder={t('meshcore.repeater.leave_blank')}
      disabled={useReadOnly(off)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Today's repeater Clock: Sync clock sets it to this server's time over the serial link. */
export function RepeaterClockCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const d = useMcDevice();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<'ok' | 'failed' | null>(null);
  const sync = async () => {
    setSyncing(true);
    setResult(null);
    const ok = await d.actions.syncDeviceTime();
    setSyncing(false);
    setResult(ok ? 'ok' : 'failed');
  };
  return (
    <McPage>
      <DeviceNotes />
      <SettingGroup>
        <SettingRow
          id="meshcore.repeater.clock"
          label={t('meshcore.repeater.sync_clock')}
          help={
            <>
              {t('meshcore.repeater.clock_hint', "Sets the repeater clock to this server's time. A repeater clock only moves forward, so a clock that runs ahead cannot be set back.")}
              <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
              {result === 'ok' && (
                <span className={styles.ok} role="status">
                  <UiIcon name="check" size={14} /> {t('meshcore.repeater.clock_synced', 'Clock synced')}
                </span>
              )}
              {result === 'failed' && <span className={styles.error} role="alert">{t('meshcore.repeater.clock_failed', 'Clock not synced')}</span>}
            </>
          }
        >
          <button type="button" className={styles.button} disabled={!d.connected || syncing || !d.canWriteConfig} onClick={() => void sync()}>
            {syncing ? t('meshcore.repeater.clock_syncing', 'Syncing…') : t('meshcore.repeater.sync_clock')}
          </button>
        </SettingRow>
      </SettingGroup>
    </McPage>
  );
}
