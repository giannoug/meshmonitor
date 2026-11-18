/**
 * Settings › Remote: <repeater or room server> › Settings (boards 8-07, 8-25),
 * on the settings row kit with today's remote settings logic
 * (useRemoteRepeaterSettings for reads and saves, useRepeaterSettingsDraft
 * for the draft, both held by the target so a draft survives Settings →
 * Console → Settings).
 *
 * - It needs today's admin session and never logs in on its own: logged out,
 *   the page is the login card with today's words.
 * - Header: Read again (one request for all three groups: one `get` per value
 *   over the mesh), Import settings, Export settings (values already read,
 *   never passwords).
 * - Identity & radio, Access, Adverts & forwarding: one row each, a value
 *   with a chevron that opens its field, "was …" while it is an unsaved
 *   edit, the hop limit as a stepper, switches for Repeat and read-only
 *   login, the guest password write-only; today's warnings and per-key
 *   results in each row's help.
 * - Manage access list (setperm); on the phone an Access list row opens it.
 * - The dock: "N changes · Save repeater settings", its Sends line, Discard
 *   changes and Send to node (one request, the changed fields only).
 */
import { useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { PasswordField } from '../../../components/shared/config/PasswordField';
import { NumberInputScope } from '../../../components/common/NumberInputScope';
import { FLOOD_REPEATERS, type DraftKey } from '../../../components/MeshCore/hooks/useRepeaterSettingsDraft';
import type { RemoteSettingsGroup } from '../../../components/MeshCore/hooks/useMeshCore';
import { getRepeaterSettingDef, repeaterValuesEqual } from '../../../utils/meshcoreRepeaterSettings';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import type { CategoryProps } from '../../settings/categories';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useSettingRow } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { SettingsHeaderSlotContext } from '../../settings/settingsDock';
import AclManager from './AclManager';
import RemoteLogin from './RemoteLogin';
import RemoteSaveDock from './RemoteSaveDock';
import { formatSetting, SETTING_LABELS, useMeshCoreTarget, type MeshCoreTarget } from './remoteTarget';
import SettingValue from './SettingValue';
import { useTargetHeader } from './useTargetHeader';
import styles from './McRemote.module.css';

const GROUPS: RemoteSettingsGroup[] = ['identity', 'adverts', 'access'];
/** Each number's step, as today's form. */
const STEPS: Partial<Record<DraftKey, number>> = { lat: 0.0001, lon: 0.0001, advertInterval: 2, af: 0.1, rxDelay: 0.1, txDelay: 0.05, directTxDelay: 0.05 };

export default function RepeaterSettingsCategory(_props: CategoryProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const target = useMeshCoreTarget();
  const slot = useContext(SettingsHeaderSlotContext);
  useTargetHeader(target);
  const [aclOpen, setAclOpen] = useState(false);
  if (!target) return <StateView kind="noPermission" />;
  if (!target.session.loggedIn) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        <p className={styles.note} role="note">{t('meshcore.repeater.remote_err_session')}</p>
        <RemoteLogin target={target} />
      </div>
    );
  }
  const { settings: s, draft: d } = target;
  const off = !!target.blocked;
  const readAny = s.loadedGroups.size > 0;

  const actions = (
    <>
      <button type="button" className={styles.button} disabled={off || s.readingGroup !== null} onClick={() => void s.readGroups(GROUPS)}>
        <UiIcon name="download" size={16} />
        {s.readingGroup !== null
          ? t('meshcore.repeater.remote_reading')
          : readAny
            ? t('meshcore.repeater.remote_read_again')
            : t('meshcore.repeater.remote_read')}
      </button>
      <button type="button" className={styles.button} disabled={d.locked} onClick={() => d.fileInput.current?.click()}>
        <UiIcon name="upload" size={16} /> {t('meshcore.repeater.import')}
      </button>
      <button type="button" className={styles.button} disabled={!d.exportable} onClick={d.handleExport}>
        <UiIcon name="download" size={16} /> {t('meshcore.repeater.export')}
      </button>
      <input
        ref={d.fileInput}
        type="file"
        accept="application/json,.json"
        className={styles.hidden}
        data-testid="repeater-import-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void d.handleImportFile(file);
        }}
      />
    </>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {slot && createPortal(actions, slot)}
      <div className={styles.readLine}>
        <span className={styles.muted}>
          {s.readAt !== null
            ? t('workspace.meshcore.remote.read_at', { time: new Date(s.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
            : t('meshcore.repeater.remote_not_read')}
          {` · ${t('workspace.meshcore.remote.write_only')}`}
        </span>
        <SendsLine>{t('workspace.meshcore.remote.sends_read')}</SendsLine>
      </div>
      {target.pathHops === null && (
        <Warn>{t('meshcore.repeater.remote_flood_warning', { repeaters: FLOOD_REPEATERS })}</Warn>
      )}
      {target.blocked && <p className={styles.note} role="note">{target.blocked}</p>}
      {s.message && <p className={styles.error} role="alert">{s.message}</p>}
      {d.importError && <p className={styles.error} role="alert">{d.importError}</p>}
      {d.importNotes && (
        <p className={styles.note} role="status">
          {d.importNotes.length === 0
            ? t('meshcore.repeater.import_done')
            : t('meshcore.repeater.import_done_skipped', { count: d.importNotes.length, keys: d.importNotes.map((n) => n.key).join(', ') })}
        </p>
      )}
      <label className={styles.check}>
        <input type="checkbox" checked={d.includeIdentity} onChange={(e) => d.setIncludeIdentity(e.target.checked)} />
        {t('meshcore.repeater.include_identity')}
      </label>

      <NumberInputScope scope={target.numbers}>
        <div className={styles.columns} data-phone={isPhone || undefined}>
          <div className={styles.column}>
            <Identity target={target} />
            {!isPhone && <Access target={target} />}
          </div>
          <div className={styles.column}>
            <Adverts target={target} />
            {isPhone && <Access target={target} />}
            {isPhone ? (
              <button type="button" className={styles.row} onClick={() => setAclOpen(true)}>
                <span className={styles.rowIcon} aria-hidden="true"><UiIcon name="encrypted" size={20} /></span>
                <span className={styles.rowLabel}>{t('workspace.meshcore.remote.access_list')}</span>
                <UiIcon name="chevronRight" size={20} />
              </button>
            ) : (
              <AclManager run={(c) => target.actions.sendCliCommand(target.publicKey, c)} sends={t('workspace.meshcore.remote.sends_acl', { name: target.name })} disabled={off} />
            )}
          </div>
        </div>
      </NumberInputScope>
      {isPhone && (
        <Sheet open={aclOpen} onClose={() => setAclOpen(false)} title={t('workspace.meshcore.remote.access_list')} side="bottom">
          <div className={styles.sheet} data-phone="">
            <AclManager run={(c) => target.actions.sendCliCommand(target.publicKey, c)} sends={t('workspace.meshcore.remote.sends_acl', { name: target.name })} disabled={off} heading={false} />
          </div>
        </Sheet>
      )}
      <RemoteSaveDock target={target} />
    </div>
  );
}

/** One row of the draft: its label, help (+ today's warning and the last save's result) and "was …". */
function Row({ target, k, children, help }: { target: MeshCoreTarget; k: DraftKey | 'guestPassword'; children: ReactNode; help?: ReactNode }) {
  const { t } = useTranslation();
  const d = target.draft;
  const [labelKey, fallback] = SETTING_LABELS[k];
  const before = k === 'guestPassword' ? undefined : d.baseline[k];
  const now = k === 'guestPassword' ? undefined : d.draft[k];
  const changed = before !== undefined && now !== undefined && !repeaterValuesEqual(k as DraftKey, now, before);
  return (
    <SettingRow
      id={`meshcore-remote.${k}`}
      label={t(labelKey, fallback)}
      help={(help || d.results?.[k]) && <>{help}<Result target={target} k={k} /></>}
      was={changed ? formatSetting(t, k as DraftKey, before) : undefined}
    >
      {children}
    </SettingRow>
  );
}

/** Today's per-key outcome of the last save. */
function Result({ target, k }: { target: MeshCoreTarget; k: string }) {
  const { t } = useTranslation();
  const r = target.draft.results?.[k];
  if (!r) return null;
  if (!r.ok) {
    return r.code === 'NOT_SENT'
      ? <Warn tone="note">{t('meshcore.repeater.remote_not_sent')}</Warn>
      : <Warn tone="danger">{r.error ?? t('meshcore.repeater.result_failed')}</Warn>;
  }
  return (
    <Warn tone="note">
      {r.changed === false
        ? t('meshcore.repeater.result_unchanged')
        : r.verified === false
          ? t('meshcore.repeater.remote_unverified')
          : t('meshcore.config.saved', 'Saved')}
    </Warn>
  );
}

const value = (target: MeshCoreTarget, k: DraftKey) => (
  <Row key={k} target={target} k={k}>
    <SettingValue target={target} k={k} step={STEPS[k] ?? 1} />
  </Row>
);

function Identity({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const radio = typeof target.settings.values.radio === 'string' ? target.settings.values.radio : null;
  return (
    <SettingGroup title={t('meshcore.repeater.remote_identity_title')}>
      {value(target, 'name')}
      {value(target, 'lat')}
      {value(target, 'lon')}
      <Row target={target} k="txPower" help={t('meshcore.repeater.remote_warn_tx_power')}>
        <SettingValue target={target} k="txPower" />
      </Row>
      <SettingRow id="meshcore-remote.radio" label={t('meshcore.repeater.remote_radio')} help={t('meshcore.repeater.remote_radio_hint')}>
        <span className={styles.readonly}>{radio ?? '—'}</span>
      </SettingRow>
    </SettingGroup>
  );
}

function Adverts({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const d = target.draft;
  const shows = (k: DraftKey) => d.shows(k);
  const floodMax = d.draft.floodMax ?? d.baseline.floodMax;
  return (
    <SettingGroup title={t('meshcore.repeater.adverts_title')}>
      <Row target={target} k="advertInterval" help={d.advertWarning && <Warn tone="note">{d.advertWarning}</Warn>}>
        <SettingValue target={target} k="advertInterval" step={2} />
      </Row>
      <Row target={target} k="floodAdvertInterval" help={d.floodWarning && <Warn tone="note">{d.floodWarning}</Warn>}>
        <SettingValue target={target} k="floodAdvertInterval" />
      </Row>
      {shows('floodMax') && (
        <Row target={target} k="floodMax" help={d.floodMaxLow && <Warn>{t('meshcore.repeater.warn_flood_max')}</Warn>}>
          {typeof floodMax === 'number' ? (
            <SettingNumber stepper value={floodMax} min={getRepeaterSettingDef('floodMax')?.min} max={getRepeaterSettingDef('floodMax')?.max} readOnly={d.locked} onChange={(n) => d.setField('floodMax', n)} />
          ) : (
            <span className={styles.readonly}>—</span>
          )}
        </Row>
      )}
      {shows('repeat') && (
        <Row target={target} k="repeat" help={d.repeatOff && <Warn>{t('meshcore.repeater.warn_repeat_off')}</Warn>}>
          <SettingToggle checked={(d.draft.repeat ?? d.baseline.repeat) === true} readOnly={d.locked || d.baseline.repeat === undefined} onChange={(v) => d.setField('repeat', v)} />
        </Row>
      )}
      <Row target={target} k="af" help={d.afLow && <Warn>{t('meshcore.repeater.warn_af')}</Warn>}>
        <SettingValue target={target} k="af" step={0.1} />
      </Row>
      {shows('rxDelay') && value(target, 'rxDelay')}
      {shows('txDelay') && value(target, 'txDelay')}
      {shows('directTxDelay') && value(target, 'directTxDelay')}
    </SettingGroup>
  );
}

function Access({ target }: { target: MeshCoreTarget }) {
  const { t } = useTranslation();
  const d = target.draft;
  const set = target.settings.guestPasswordSet;
  const read = d.groupRead('access');
  return (
    <SettingGroup title={t('meshcore.repeater.access_title')}>
      <Row
        target={target}
        k="guestPassword"
        help={
          d.guestHasError
            ? <Warn tone="danger">{t('meshcore.repeater.password_invalid_guest')}</Warn>
            : set
              ? t('meshcore.repeater.guest_set')
              : t('meshcore.repeater.guest_unset')
        }
      >
        <GuestPassword target={target} disabled={d.locked || d.clearGuest || !read} />
      </Row>
      {set && read && (
        <SettingRow id="meshcore-remote.clearGuest" label={t('meshcore.repeater.clear_guest')}>
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
      <Row target={target} k="allowReadOnly">
        <SettingToggle
          checked={(d.draft.allowReadOnly ?? d.baseline.allowReadOnly) === true}
          readOnly={d.locked || d.baseline.allowReadOnly === undefined}
          onChange={(v) => d.setField('allowReadOnly', v)}
        />
      </Row>
      <p className={styles.groupNote}>{t('workspace.meshcore.remote.admin_password_note')}</p>
    </SettingGroup>
  );
}

/** Write-only, as today: blank keeps the stored value; nothing is read back. */
function GuestPassword({ target, disabled }: { target: MeshCoreTarget; disabled: boolean }) {
  const { t } = useTranslation();
  const row = useSettingRow();
  const d = target.draft;
  return (
    <PasswordField
      id={row?.inputId}
      aria-describedby={row?.helpId}
      autoComplete="off"
      className={styles.input}
      value={d.guestPassword}
      placeholder={t('meshcore.repeater.leave_blank')}
      disabled={disabled}
      onChange={(e) => d.setGuestPassword(e.target.value)}
    />
  );
}
