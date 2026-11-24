/**
 * One built-in automation's page (Task 7.5, s8n4/HK: drawn on the row kit with
 * its own dock), at `/source/:id/automations/<built-in>`: today's fields with
 * today's limits and help, its Sends line, today's paused note in
 * receive-only, and the dock "N changes in <built-in>" that saves today's
 * request once per press. A list (triggers, rules) edits one item at a time in
 * a sheet; the list saves from the dock.
 *
 * The controls that act at once are today's: Send Now and the live preview
 * (Auto-announce), Run now (Timer triggers, Auto Delete by Distance, Auto
 * Favorite), the running sessions (Auto Ping) and the per-node rows (Time
 * Sync, Remote Telemetry). Saving never runs a built-in.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import apiService from '../../../services/api';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import { isTxDisabledBody } from '../../../utils/txDisabled';
import { FORWARDED_MARKER, FORWARDING_MAX_PER_WINDOW, FORWARDING_MAX_TEXT_CHARS } from '../../../types/forwarding';
import { LEGACY_MESHCORE_ADVERT_MODE } from '../../../types/meshcoreAdvert';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SendsLine from '../../patterns/SendsLine';
import Sheet from '../../patterns/Sheet';
import StateView from '../../patterns/StateView';
import SettingGroup from '../../settings/kit/SettingGroup';
import SettingNumber from '../../settings/kit/SettingNumber';
import SettingRow from '../../settings/kit/SettingRow';
import SettingSelect from '../../settings/kit/SettingSelect';
import SettingText from '../../settings/kit/SettingText';
import SettingToggle from '../../settings/kit/SettingToggle';
import { useSettingRow } from '../../settings/kit/useFieldRegistry';
import { Warn } from '../../settings/categories/RowParts';
import { useIsPhone } from '../../shell/useIsPhone';
import { useMeshCoreRuntime } from '../runtime';
import { McDock } from '../settings/mcShared';
import ToolHead from '../ToolHead';
import { changedLabels, getPath, setPath, type Builtin, type Field, type Values } from './builtins';
import kit from '../../settings/kit/kit.module.css';
import styles from '../McTools.module.css';
import own from './Automations.module.css';

interface BuiltinPageProps {
  b: Builtin;
  result: UseQueryResult<Values>;
  onSaved(values: Values): void;
  reload(): void;
}

/** What a built-in's own parts see: the values on screen, the saved ones, and the page's edit. */
export interface BuiltinPartProps {
  values: Values;
  saved: Values;
  dirty: boolean;
  canWrite: boolean;
  readOnly: boolean;
  set(values: Values): void;
}

export interface BuiltinViewProps extends BuiltinPageProps {
  sourceId: string;
  /** Receive-only: a transmitting built-in shows `pausedNote`. */
  receiveOnly: boolean;
  pausedNote: string;
  canWrite: boolean;
  back: { label: string; to: string };
  /** Under the title (desktop; on the phone too with `phoneSubtitle`). */
  subtitle?: ReactNode;
  phoneSubtitle?: boolean;
  /** The head's end (desktop) or the phone bar's end: the built-in's own switch. */
  headActions?(p: BuiltinPartProps): ReactNode;
  /** Before the fields (a banner), and after them (the controls that act at once). */
  top?(p: BuiltinPartProps): ReactNode;
  extra?(p: BuiltinPartProps): ReactNode;
}

/** A MeshCore built-in's page: the view inside today's runtime, with its controls that act at once. */
export default function BuiltinPage(props: BuiltinPageProps) {
  const { t } = useTranslation();
  const { sourceId, receiveOnly } = useMeshCoreRuntime();
  const { hasPermission } = useAuth();
  return (
    <BuiltinView
      {...props}
      sourceId={sourceId}
      receiveOnly={receiveOnly}
      pausedNote={t('meshcore.receive_only.paused_note', 'Paused — receive-only mode. These settings are saved and unchanged; they take effect again when receive-only is turned off.')}
      canWrite={hasPermission('automation', 'write', { sourceId })}
      back={{ label: t('workspace.meshcore.auto.title'), to: `/source/${encodeURIComponent(sourceId)}/automations` }}
      subtitle={props.b.description}
      extra={(p) => <ExtraPart b={props.b} values={p.values} saved={p.saved} dirty={p.dirty} canWrite={p.canWrite} reload={props.reload} />}
    />
  );
}

/** One built-in's page on the row kit, with its own dock; shared by MeshCore and Meshtastic (Task 8.3). */
export function BuiltinView({ b, result, onSaved, sourceId, receiveOnly, pausedNote, canWrite, back, subtitle, phoneSubtitle, headActions, top, extra, reload }: BuiltinViewProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const saved = result.data;
  const [edits, setEdits] = useState<Values | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = edits ?? saved;
  const part: BuiltinPartProps | null =
    value && saved
      ? { values: value, saved, dirty: false, canWrite, readOnly: !canWrite || saving, set: (v) => setEdits(v) }
      : null;
  const fields = value ? b.fields(value) : [];
  // Each changed field, and each changed saved key the page edits outside the fields, is one change.
  const changes = value && saved ? changedLabels(fields, value, saved, b.savedKeys) : [];
  if (part) part.dirty = changes.length > 0;

  const head = (
    <>
      {!isPhone && (
        <Link className={own.crumb} to={back.to}>
          {back.label} <UiIcon name="chevronRight" size={14} />
        </Link>
      )}
      <ToolHead title={b.title} subtitle={subtitle} back={back} actions={part && headActions ? headActions(part) : undefined} />
      {isPhone && phoneSubtitle && subtitle && <p className={styles.muted}>{subtitle}</p>}
    </>
  );
  if (!value || !saved || !part) {
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {head}
        {result.isError ? <StateView kind="error" onRetry={reload} /> : <StateView kind="loading" />}
      </div>
    );
  }

  const invalid = b.validate?.(value, saved) ?? null;
  const sends = b.sends(value);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await b.save(sourceId, value, saved);
      onSaved(value);
      setEdits(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('automation.settings_save_failed', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };
  const set = (f: Field, next: unknown) => setEdits(f.set ? f.set(value, next) : setPath(value, f.key, next));

  // The fields, in groups: a heading starts the next group.
  const groups: Array<{ title?: string; help?: string; fields: Field[] }> = [{ fields: [] }];
  for (const f of fields) {
    if (f.kind === 'heading') groups.push({ title: f.label, help: f.help, fields: [] });
    else groups[groups.length - 1].fields.push(f);
  }

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      {head}
      {receiveOnly && b.transmits && (
        <p className={styles.banner} role="note">
          <UiIcon name="info" size={16} />
          <span>{pausedNote}</span>
        </p>
      )}
      {!canWrite && <p className={styles.note} role="status">{t('automation.insufficient_permissions', 'Insufficient permissions')}</p>}
      <SendsLine>{sends ?? t('workspace.settings.savebar.sends_nothing')}</SendsLine>
      {top?.(part)}
      {groups.map((g, gi) =>
        g.fields.length === 0 && !g.title ? null : (
          <section key={gi} className={styles.section} aria-label={g.title ?? b.title}>
            {g.title && <h2 className={styles.sectionTitle}>{g.title}</h2>}
            {g.help && <p className={styles.note}>{g.help}</p>}
            <SettingGroup>
              {g.fields.filter((f) => !f.showIf || f.showIf(value)).map((f) => (
                <FieldRow key={f.key} field={f} id={`${b.id}.${f.key}`} values={value} readOnly={!canWrite || saving} onChange={(v) => set(f, v)}
                  savedItems={f.kind === 'list' ? (getPath(saved, f.key) as Values[] | undefined) : undefined} />
              ))}
            </SettingGroup>
          </section>
        ),
      )}
      {extra?.(part)}
      <McDock
        sourceId={sourceId}
        changes={changes}
        page={b.title}
        sends={b.saveEffect(value)}
        saveLabel={t('common.save', 'Save')}
        saving={saving}
        blocked={!canWrite || !!invalid}
        error={error ?? (changes.length > 0 ? invalid : null)}
        onSave={() => void save()}
        onDiscard={() => {
          setEdits(null);
          setError(null);
        }}
      />
    </div>
  );
}

/** A multi-line text field named by its row. */
function TextArea({ value, onChange, readOnly, maxLength, placeholder }: { value: string; onChange(v: string): void; readOnly: boolean; maxLength?: number; placeholder?: string }) {
  const row = useSettingRow();
  return (
    <textarea className={own.textarea} id={row?.inputId} aria-describedby={row?.helpId} value={value} readOnly={readOnly} maxLength={maxLength}
      placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
  );
}

/** A set of checkboxes (channels, contacts), named by its row. */
function Checks({ field, value, onChange, readOnly }: { field: Field; value: unknown[]; onChange(v: unknown[]): void; readOnly: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const row = useSettingRow();
  const options = field.options ?? [];
  const has = (o: string) => value.map(String).includes(o);
  if (options.length === 0) return <span className={styles.muted}>{t('meshcore.automation.timers.no_channels', '(no channels loaded)')}</span>;
  return (
    <fieldset className={own.checks} data-phone={isPhone || undefined} aria-label={row?.label}>
      {options.map((o) => (
        <label key={o.value} className={own.check}>
          <input
            type="checkbox"
            checked={has(o.value)}
            disabled={readOnly}
            onChange={(e) => {
              const v = field.numeric ? Number(o.value) : o.value;
              onChange(e.target.checked ? [...value, v] : value.filter((x) => String(x) !== o.value));
            }}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function FieldRow({ field: f, id, values, readOnly, onChange, savedItems }: {
  field: Field; id: string; values: Values; readOnly: boolean; onChange(v: unknown): void; savedItems?: Values[];
}) {
  const raw = f.read ? f.read(values) : getPath(values, f.key);
  let control: ReactNode;
  switch (f.kind) {
    case 'toggle':
      control = <SettingToggle checked={raw === true} readOnly={readOnly} onChange={onChange} />;
      break;
    case 'number':
      control = f.nullable ? (
        <SettingText value={raw == null ? '' : String(raw)} readOnly={readOnly} mono
          onChange={(v) => onChange(v.trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : raw)} />
      ) : (
        <SettingNumber value={Number(raw ?? 0)} min={f.min} max={f.max} step={f.step} readOnly={readOnly} onChange={onChange} />
      );
      break;
    case 'text':
      control = <SettingText value={String(raw ?? '')} readOnly={readOnly} maxLength={f.maxLength} placeholder={f.placeholder} mono={f.mono} onChange={onChange} />;
      break;
    case 'textarea':
      control = <TextArea value={String(raw ?? '')} readOnly={readOnly} maxLength={f.maxLength} placeholder={f.placeholder} onChange={onChange} />;
      break;
    case 'select':
      control = (
        <SettingSelect value={raw == null ? '' : String(raw)} options={f.options ?? []} readOnly={readOnly}
          onChange={(v) => onChange(f.numeric ? (v === '' ? null : Number(v)) : v)} />
      );
      break;
    case 'multi':
      control = <Checks field={f} value={Array.isArray(raw) ? raw : []} readOnly={readOnly} onChange={onChange} />;
      break;
    case 'list':
      return <ListField field={f} items={Array.isArray(raw) ? (raw as Values[]) : []} savedItems={savedItems ?? []} readOnly={readOnly} onChange={onChange} />;
    default:
      return null;
  }
  return (
    <SettingRow id={id} label={f.label} help={f.help} stacked={f.kind === 'textarea' || f.kind === 'multi'}>
      {control}
      {f.warn && (!f.warnIf || f.warnIf(values)) && <Warn>{f.warn}</Warn>}
    </SettingRow>
  );
}

/** A list of triggers or rules: one row each (its switch, Edit, Delete); Edit opens the item in a sheet. */
export function ListField({ field: f, items, savedItems, readOnly, onChange }: { field: Field; items: Values[]; savedItems: Values[]; readOnly: boolean; onChange(v: Values[]): void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState<{ index: number; item: Values } | null>(null);
  const [tried, setTried] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [removing, setRemoving] = useState<number | null>(null);
  const term = search.trim().toLowerCase();
  const matches = (x: Values, i: number) =>
    (!term || `${f.itemTitle?.(x) ?? i + 1} ${f.itemSub?.(x) ?? ''}`.toLowerCase().includes(term)) &&
    (kind === 'all' || !f.itemFilter || f.itemFilter.match(x, kind));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const asking = removing !== null && items[removing] ? f.confirmDelete?.(items[removing]) : undefined;
  const savedIds = new Set(savedItems.map((x) => String(x.id)));
  const isNew = (x: Values) => !savedIds.has(String(x.id));
  const errorOf = (x: Values) => f.validateItem?.(x, isNew(x)) ?? null;
  const itemFields = open ? (f.itemFields?.(open.item) ?? []).filter((x) => !x.showIf || x.showIf(open.item)) : [];
  const openError = open ? errorOf(open.item) : null;
  const done = () => {
    if (!open) return;
    if (openError) {
      setTried(true);
      return;
    }
    const next = [...items];
    if (open.index < 0) next.push(open.item);
    else next[open.index] = open.item;
    onChange(next);
    setOpen(null);
    setTried(false);
  };
  return (
    <SettingGroup title={f.label}>
      {f.searchLabel && items.length > 0 && (
        <div className={own.filterRow}>
          <label className={own.search} data-phone={isPhone || undefined}>
            <UiIcon name="search" size={16} />
            <span className={styles.srOnly}>{f.searchLabel}</span>
            <input type="search" value={search} placeholder={`${f.searchLabel}…`} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {f.itemFilter && (
            <select className={own.filterSelect} data-phone={isPhone || undefined} aria-label={f.itemFilter.label} value={kind} onChange={(e) => setKind(e.target.value)}>
              {f.itemFilter.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
      )}
      <ul className={own.items}>
        {items.length === 0 && <li className={styles.note}>{t('meshcore.automation.responder.empty', 'No triggers configured yet.')}</li>}
        {items.map((x, i) => {
          if (!matches(x, i)) return null;
          const err = errorOf(x);
          const title = f.itemTitle?.(x) ?? String(i + 1);
          return (
            <li key={String(x.id ?? i)} className={own.item}>
              <span className={own.text}>
                <span className={own.title}>{title}</span>
                <span className={own.summary}>{f.itemSub?.(x)}</span>
              </span>
              {f.itemEnabledKey && (
                <input type="checkbox" role="switch" className={kit.switch} aria-label={t('meshcore.automation.responder.enable_trigger', { name: title, defaultValue: 'Enable {{name}}' })}
                  checked={x[f.itemEnabledKey] === true} disabled={readOnly}
                  onChange={(e) => onChange(items.map((y, j) => (j === i ? { ...y, [f.itemEnabledKey!]: e.target.checked } : y)))} />
              )}
              <button type="button" className={styles.button} disabled={readOnly} onClick={() => setOpen({ index: i, item: x })}>{t('common.edit', 'Edit')}</button>
              <button type="button" className={`${styles.iconButton} ${styles.danger}`} disabled={readOnly} title={t('common.delete', 'Delete')}
                onClick={() => (f.confirmDelete ? setRemoving(i) : remove(i))}>
                <UiIcon name="delete" size={16} />
                <span className={styles.srOnly}>{t('common.delete', 'Delete')}</span>
              </button>
              {err && <p className={own.itemError}>{err}</p>}
            </li>
          );
        })}
      </ul>
      {f.newItem && (
        <button type="button" className={styles.button} disabled={readOnly} onClick={() => setOpen({ index: -1, item: f.newItem!() })}>
          <UiIcon name="plus" size={16} />
          {f.addLabel}
        </button>
      )}
      <ConfirmSheet
        open={!!asking}
        title={asking?.title ?? ''}
        body={asking?.message}
        confirmLabel={asking?.confirmLabel ?? ''}
        danger
        submitOnEnter={false}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing !== null) remove(removing);
          setRemoving(null);
        }}
      />
      <Sheet
        open={!!open}
        onClose={() => { setOpen(null); setTried(false); }}
        title={open ? (f.itemTitle?.(open.item) ?? f.label) : f.label}
        footer={
          <div className={styles.footerButtons}>
            <button type="button" className={styles.button} onClick={() => { setOpen(null); setTried(false); }}>{t('common.cancel', 'Cancel')}</button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={done}>{t('common.done', 'Done')}</button>
          </div>
        }
      >
        <div className={styles.sheet} data-phone={isPhone || undefined}>
          <SettingGroup>
            {open && itemFields.map((x) => (
              <FieldRow key={x.key} field={x} id={`item.${x.key}`} values={open.item} readOnly={readOnly}
                onChange={(v) => setOpen({ ...open, item: x.set ? x.set(open.item, v) : setPath(open.item, x.key, v) })} />
            ))}
          </SettingGroup>
          {open && f.itemExtra?.(open.item, (item) => setOpen({ ...open, item }))}
          {tried && openError && <p className={styles.error} role="alert">{openError}</p>}
        </div>
      </Sheet>
    </SettingGroup>
  );
}

interface ExtraProps {
  b: Builtin;
  values: Values;
  saved: Values;
  dirty: boolean;
  canWrite: boolean;
  reload(): void;
}

/** The controls a built-in has that act at once (today's). */
function ExtraPart(props: ExtraProps) {
  switch (props.b.extra) {
    case 'announce': return <AnnounceExtra {...props} />;
    case 'timers': return <TimersExtra {...props} />;
    case 'distance': return <RunNowExtra {...props} kind="distance" />;
    case 'favorite': return <RunNowExtra {...props} kind="favorite" />;
    case 'autoPing': return <PingSessions {...props} />;
    case 'timeSync': return <NodeRows {...props} kind="time-sync" />;
    case 'remoteTelemetry': return <NodeRows {...props} kind="telemetry" />;
    case 'forwarding': return <ForwardingLimits />;
    default: return null;
  }
}

const autoPath = (sourceId: string, path: string) => `/api/sources/${encodeURIComponent(sourceId)}/meshcore/automation/${path}`;

/** Today's toast for a run refused by receive-only, else the error. */
function useRunFailure() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return (err: unknown, fallback: string) => {
    const e = err as { status?: number; body?: unknown; message?: string };
    if (isTxDisabledBody(e?.status ?? 0, e?.body)) {
      showToast(t('meshcore.receive_only.blocked_toast', 'Receive-only mode is on for this MeshCore source — nothing was sent.'), 'warning');
    } else {
      showToast(e?.message || fallback, 'error');
    }
  };
}

function AnnounceExtra({ b, values, saved, dirty, canWrite }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId, receiveOnly } = useMeshCoreRuntime();
  const fail = useRunFailure();
  const [sending, setSending] = useState(false);
  // Send Now asks first, as the Meshtastic one (Ruling 8.3, F IX).
  const [confirm, setConfirm] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>((saved.lastRunAt as number | null) ?? null);
  // Today's live preview: the message, 300 ms after the last keystroke.
  const message = String(values.message ?? '');
  const [debounced, setDebounced] = useState(message);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(message), 300);
    return () => clearTimeout(handle);
  }, [message]);
  const previewOf = (text: string) => async () =>
    (await apiService.get<{ preview?: string }>(`${autoPath(sourceId, 'announce/preview')}?message=${encodeURIComponent(text)}`))?.preview ?? '';
  const { data: preview } = useQuery({
    queryKey: ['workspace', 'meshcore', 'announce-preview', sourceId, debounced],
    enabled: debounced !== '',
    queryFn: previewOf(debounced),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  // The server sends the stored announcement (runAutoAnnounceCycle): the confirm quotes it, read when the confirm opens.
  const savedMessage = String(saved.message ?? '');
  const { data: savedPreview } = useQuery({
    queryKey: ['workspace', 'meshcore', 'announce-preview', sourceId, savedMessage],
    enabled: confirm && savedMessage !== '',
    queryFn: previewOf(savedMessage),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const indexes = Array.isArray(saved.channelIndexes) ? (saved.channelIndexes as unknown[]) : [];
  const channels = indexes.length;
  const options = b.fields(saved).find((f) => f.key === 'channelIndexes')?.options ?? [];
  const names = indexes.map((i) => options.find((o) => o.value === String(i))?.label ?? t('forwarding.channel_n', { index: i })).join(', ');
  const sendsLine = t('workspace.automations.send_now_sends', { count: channels, channels: names });
  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const reply = await apiService.post<{ data?: { lastRunAt?: number } }>(autoPath(sourceId, 'announce/send'));
      if (typeof reply?.data?.lastRunAt === 'number') setLastRunAt(reply.data.lastRunAt);
      showToast(t('meshcore.automation.announce.sent', 'Announcement sent'), 'success');
      setConfirm(false);
    } catch (err) {
      fail(err, t('meshcore.automation.announce.send_failed', 'Failed to send announcement'));
    } finally {
      setSending(false);
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('meshcore.automation.announce.send_now', 'Send Now')}>
      <p className={styles.kvLabel}>{t('automation.auto_announce.sample_preview', 'Live Preview')}</p>
      <p className={styles.quote}>{preview || '—'}</p>
      <p className={styles.muted}>{t('automation.auto_announce.last_announcement', 'Last Announcement')}: {lastRunAt ? new Date(lastRunAt).toLocaleString() : t('common.never', 'Never')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={!canWrite || sending || channels === 0 || receiveOnly}
          title={receiveOnly ? t('meshcore.receive_only.control_tooltip', 'Receive-only mode is on for this MeshCore source. Turn it off in MeshCore Settings to use this.') : undefined}
          onClick={() => setConfirm(true)}>
          {sending ? t('meshcore.automation.announce.sending', 'Sending…') : t('meshcore.automation.announce.send_now', 'Send Now')}
        </button>
      </div>
      <SendsLine>{sendsLine}</SendsLine>
      <ConfirmSheet
        open={confirm}
        title={t('meshcore.automation.announce.send_now', 'Send Now')}
        body={
          <>
            <p className={styles.quote}>{savedPreview || savedMessage}</p>
            {dirty && <p className={styles.muted}>{t('workspace.automations.send_now_unsaved')}</p>}
            <SendsLine>{sendsLine}</SendsLine>
          </>
        }
        confirmLabel={t('meshcore.automation.announce.send_now', 'Send Now')}
        busy={sending}
        submitOnEnter={false}
        onCancel={() => setConfirm(false)}
        onConfirm={send}
      />
    </section>
  );
}

function TimersExtra({ saved, dirty, canWrite }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId, receiveOnly } = useMeshCoreRuntime();
  const fail = useRunFailure();
  const [running, setRunning] = useState<string | null>(null);
  // s8n1: a flood advert asks first with today's warning (Ruling 7.5 HQ); every other Run now transmits too, so it asks as well (F IX).
  const [confirmRun, setConfirmRun] = useState<Values | null>(null);
  const triggers = (Array.isArray(saved.triggers) ? saved.triggers : []) as Values[];
  if (triggers.length === 0) return null;
  const floods = (tr: Values) => tr.responseType === 'advert' && (tr.advertMode ?? LEGACY_MESHCORE_ADVERT_MODE) === 'flood';
  const run = async (id: string) => {
    setRunning(id);
    try {
      await apiService.post(autoPath(sourceId, `timers/${encodeURIComponent(id)}/run`));
      showToast(t('meshcore.automation.timers.ran', 'Trigger fired'), 'success');
    } catch (err) {
      fail(err, t('meshcore.automation.timers.run_failed', 'Run failed'));
    } finally {
      setRunning(null);
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('meshcore.automation.timers.run_now', 'Run now')}>
      {triggers.map((tr) => (
        <div key={String(tr.id)} className={styles.actions}>
          <span className={styles.headText}>
            {String(tr.name || t('meshcore.automation.timers.untitled', 'New trigger'))}
            {typeof tr.lastRun === 'number' && <span className={styles.muted}> · {t('meshcore.automation.timers.last_run', 'Last run')}: {new Date(tr.lastRun).toLocaleString()}</span>}
          </span>
          <button type="button" className={styles.button} disabled={!canWrite || dirty || receiveOnly || running !== null}
            title={dirty ? t('meshcore.automation.timers.save_before_run', 'Save your changes before running this trigger.') : undefined}
            onClick={() => setConfirmRun(tr)}>
            {running === tr.id ? t('meshcore.automation.timers.running', 'Running…') : t('meshcore.automation.timers.run_now', 'Run now')}
          </button>
        </div>
      ))}
      <SendsLine>{t('workspace.meshcore.auto.run_timer_sends')}</SendsLine>
      <ConfirmSheet
        open={!!confirmRun}
        title={t('meshcore.automation.timers.run_now', 'Run now')}
        body={
          confirmRun && floods(confirmRun) ? (
            <>
              <p>{t('meshcore.advert.flood_automated_warning')}</p>
              <SendsLine>{t('workspace.meshcore.sends_flood')}</SendsLine>
            </>
          ) : (
            <>
              <p>{String(confirmRun?.name || t('meshcore.automation.timers.untitled', 'New trigger'))}</p>
              <SendsLine>{t('workspace.meshcore.auto.run_timer_sends')}</SendsLine>
            </>
          )
        }
        confirmLabel={t('meshcore.automation.timers.run_now', 'Run now')}
        busy={running !== null}
        submitOnEnter={false}
        onCancel={() => setConfirmRun(null)}
        onConfirm={async () => {
          const id = String(confirmRun?.id);
          setConfirmRun(null);
          await run(id);
        }}
      />
    </section>
  );
}

function RunNowExtra({ saved, canWrite, reload, kind }: ExtraProps & { kind: 'distance' | 'favorite' }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId } = useMeshCoreRuntime();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const distance = kind === 'distance';
  const k = distance ? 'meshcore.automation.delete_distance' : 'meshcore.automation.auto_favorite';
  const run = async () => {
    setBusy(true);
    try {
      const reply = await apiService.post<{ data?: { deletedCount?: number; favorited?: number; unfavorited?: number } }>(
        autoPath(sourceId, distance ? 'auto-delete-distance/run' : 'auto-favorite/run'),
      );
      showToast(
        distance
          ? t(`${k}.run_done`, { count: reply?.data?.deletedCount ?? 0 })
          : t(`${k}.run_done`, { favorited: reply?.data?.favorited ?? 0, unfavorited: reply?.data?.unfavorited ?? 0 }),
        'success',
      );
      setConfirm(false);
      reload();
    } catch {
      showToast(t(`${k}.run_failed`), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t(`${k}.run_now`)}>
      <p className={styles.muted}>{saved.running ? t(`${k}.scheduler_on`) : t(`${k}.scheduler_off`)}</p>
      {!distance && <p className={styles.muted}>{t(`${k}.tracked`, { count: Number(saved.trackedCount ?? 0) })}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.button} disabled={!canWrite || busy || saved.enabled !== true} onClick={() => (distance ? setConfirm(true) : void run())}>
          {busy ? t(`${k}.running`) : t(`${k}.run_now`)}
        </button>
      </div>
      <SendsLine>{distance ? t('workspace.meshcore.auto.distance_run_sends') : t('workspace.meshcore.auto.favorite_run_sends')}</SendsLine>
      <ConfirmSheet
        open={confirm}
        title={t(`${k}.run_now`)}
        body={t(`${k}.description`)}
        confirmLabel={t(`${k}.run_now`)}
        danger
        busy={busy}
        submitOnEnter={false}
        onCancel={() => setConfirm(false)}
        onConfirm={run}
      />
    </section>
  );
}

interface PingSession {
  requestedBy: string; requestedByName: string; totalPings: number; completedPings: number; successfulPings: number; failedPings: number;
  directPings: number; floodPings: number; startTime: number;
}

function PingSessions({ saved, canWrite, reload }: ExtraProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId } = useMeshCoreRuntime();
  const sessions = (Array.isArray(saved.sessions) ? saved.sessions : []) as PingSession[];
  const stop = async (key: string) => {
    try {
      await apiService.post(autoPath(sourceId, 'auto-ping/stop'), { publicKey: key });
      showToast(t('automation.auto_ping.session_stopped', 'Ping session stopped'), 'success');
      reload();
    } catch {
      showToast(t('automation.auto_ping.stop_failed', 'Failed to stop ping session'), 'error');
    }
  };
  return (
    <section className={`${styles.card} ${styles.cardBody}`} aria-label={t('automation.auto_ping.active_sessions', 'Active Sessions')}>
      <p className={styles.kvLabel}>{t('automation.auto_ping.dm_commands', 'DM Commands')}</p>
      <p className={styles.muted}><code>ping 5</code> {t('automation.auto_ping.dm_start_help')} · <code>ping stop</code> {t('automation.auto_ping.dm_stop_help')}</p>
      <p className={styles.kvLabel}>{t('automation.auto_ping.active_sessions', 'Active Sessions')}</p>
      {sessions.length === 0 ? (
        <p className={styles.muted}>—</p>
      ) : (
        sessions.map((s) => (
          <div key={s.requestedBy} className={styles.actions}>
            <span className={styles.headText}>
              {s.requestedByName} · {s.completedPings}/{s.totalPings} · {t('automation.auto_ping.successful', 'Successful')} {s.successfulPings} ·{' '}
              {t('automation.auto_ping.failed', 'Failed')} {s.failedPings} · {t('meshcore.automation.autoping.direct_flood', 'Direct / Flood')} {s.directPings}/{s.floodPings}
            </span>
            <button type="button" className={styles.button} disabled={!canWrite} onClick={() => void stop(s.requestedBy)}>{t('common.stop', 'Stop')}</button>
          </div>
        ))
      )}
    </section>
  );
}

interface NodeRow {
  publicKey: string; name: string | null; intervalMinutes: number | null; lastSyncAt?: number | null; lastSuccessAt?: number | null;
}

/** Time Sync / Remote Telemetry: today's per-node rows (interval Save, Disable), each one request when pressed. */
function NodeRows({ saved, canWrite, reload, kind }: ExtraProps & { kind: 'time-sync' | 'telemetry' }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { sourceId } = useMeshCoreRuntime();
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const nodes = (Array.isArray(saved.nodes) ? saved.nodes : []) as NodeRow[];
  const sync = kind === 'time-sync';
  const k = sync ? 'meshcore.automation.time_sync' : 'meshcore.automation.remote_telemetry';
  const min = sync ? 60 : 1;
  const max = 7 * 24 * 60;
  const url = (pk: string) => `/api/sources/${encodeURIComponent(sourceId)}/meshcore/nodes/${pk}/${sync ? 'time-sync-config' : 'telemetry-config'}`;
  const post = async (pk: string, body: Values, ok: string) => {
    setBusy(pk);
    try {
      await apiService.post(url(pk), body);
      showToast(ok, 'success');
      setEdited((e) => {
        const rest = { ...e };
        delete rest[pk];
        return rest;
      });
      reload();
    } catch {
      showToast(t(`${k}.save_failed`), 'error');
    } finally {
      setBusy(null);
    }
  };
  if (nodes.length === 0) return <p className={styles.note}>{t(`${k}.empty`)}</p>;
  return (
    <section className={styles.section} aria-label={t(`${k}.title`)}>
      <SettingGroup>
        {nodes.map((nd) => {
          const current = edited[nd.publicKey] ?? nd.intervalMinutes ?? min;
          const dirty = edited[nd.publicKey] != null && edited[nd.publicKey] !== (nd.intervalMinutes ?? min);
          const last = sync ? nd.lastSyncAt : nd.lastSuccessAt;
          return (
            <SettingRow key={nd.publicKey} id={`${kind}.${nd.publicKey}`} label={nd.name || `${nd.publicKey.substring(0, 12)}…`}
              help={`${t(sync ? `${k}.last_sync` : `${k}.last_success`)}: ${last ? new Date(last).toLocaleString() : t('common.never', 'Never')} · ${t(`${k}.interval`)}`}>
              <SettingNumber value={current} min={min} max={max} readOnly={!canWrite || busy === nd.publicKey}
                onChange={(v) => setEdited((e) => ({ ...e, [nd.publicKey]: v }))} />
              <button type="button" className={styles.button} disabled={!canWrite || !dirty || busy === nd.publicKey}
                onClick={() => void post(nd.publicKey, { intervalMinutes: edited[nd.publicKey] }, t(`${k}.saved`))}>{t('common.save', 'Save')}</button>
              <button type="button" className={styles.button} disabled={!canWrite || busy === nd.publicKey}
                onClick={() => void post(nd.publicKey, { enabled: false }, t(`${k}.disabled`))}>{t('common.disable', 'Disable')}</button>
            </SettingRow>
          );
        })}
      </SettingGroup>
    </section>
  );
}

/** Today's fixed forwarding limits, stated (no setting). */
function ForwardingLimits() {
  const { t } = useTranslation();
  return <p className={styles.note}>{t('forwarding.limits', { max: FORWARDING_MAX_PER_WINDOW, chars: FORWARDING_MAX_TEXT_CHARS, marker: FORWARDED_MARKER })}</p>;
}
