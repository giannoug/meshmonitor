/**
 * A Meshtastic device's Automations (Task 8.3), native at
 * `/source/:id/automation` (today's tab URL):
 *
 * - `automation` (m1, n1): the device door. A few built-ins with their state,
 *   summary and Sends line, the "N more" row to the full list, then the
 *   Automation Engine rules that include this device (source filter names it,
 *   or none = every device), with today's switch and "No limit set" read
 *   literally (s14n1). All / On / Sends on the mesh / Needs attention filter.
 * - `automation/builtins` (14-05, 14-14): all eighteen built-ins, grouped
 *   Replies, Scheduled sends, Node care, Data, and today's token reference.
 * - `automation/<built-in>`: one built-in's page (BuiltinPage).
 *
 * A built-in's switch queues in the page's dock; Save sends each changed
 * built-in's today's request once. Opening or re-rendering sends nothing.
 * Gates: automation:read on this device (the tab), automation:write for the
 * switches; the rules need automations:read / write (global).
 */
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { SourceProvider } from '../../contexts/SourceContext';
import { appBasename } from '../../init';
import apiService from '../../services/api';
import { UiIcon } from '../../components/icons';
import { useToast } from '../../components/ToastContainer';
import { buildMeshtasticTokenGroups } from '../../components/meshtasticAutomationTokens';
import type { DashboardSource } from '../../hooks/useDashboardData';
import SendsLine from '../patterns/SendsLine';
import Sheet from '../patterns/Sheet';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { McDock } from '../meshcore/settings/mcShared';
import ToolHead from '../meshcore/ToolHead';
import type { Values } from '../meshcore/automations/builtins';
import { ENGINE, readRule, TRANSMITTING, type EngineRule } from './engineRules';
import { GROUPS, transmits, type Group, type MeshtasticBuiltin } from './builtins';
import { useBuiltins } from './useBuiltins';
import BuiltinPage from './BuiltinPage';
import kit from '../settings/kit/kit.module.css';
import styles from '../meshcore/McTools.module.css';
import own from '../meshcore/automations/Automations.module.css';
import mine from './DeviceAutomations.module.css';

/** The door's built-ins (m1, n1): the ones that reply or send on a schedule most often; the rest are one row away. */
const DOOR = ['auto-acknowledge', 'auto-announce', 'auto-responder', 'timer-triggers', 'auto-key-management', 'auto-traceroute'];
/** Built-ins today's Classic can convert to an engine rule (Convert to rule). */
const CONVERTIBLE = new Set(['auto-acknowledge']);

export interface DeviceAutomationsProps {
  sourceId: string;
  source: DashboardSource;
  /** '' (the door), 'builtins' (the list) or a built-in's id. */
  path: string;
}

type Row = { b: MeshtasticBuiltin; saved?: Values; loading: boolean };

/** Today's per-source providers (as the Dashboard, Task 8.1): this device's settings context for the previews' formats. */
export default function DeviceAutomations(props: DeviceAutomationsProps) {
  return (
    <SourceProvider sourceId={props.sourceId} sourceName={props.source.name} sourceType={props.source.type}>
      <SettingsProvider baseUrl={appBasename}>
        <Automations {...props} />
      </SettingsProvider>
    </SourceProvider>
  );
}

function Automations({ sourceId, source, path }: DeviceAutomationsProps) {
  const current = useBuiltins(sourceId, path && path !== 'builtins' ? path : null);
  const base = `/source/${encodeURIComponent(sourceId)}/automation`;
  if (path && path !== 'builtins') {
    const i = current.table.findIndex((x) => x.id === path);
    if (i < 0) return <Navigate replace to={base} />;
    const b = current.table[i];
    return (
      <BuiltinPage
        key={b.id}
        b={b}
        sourceId={sourceId}
        source={source}
        result={current.results[i]}
        channels={current.channels}
        nodes={current.nodes}
        localNodeNum={current.localNodeNum}
        onSaved={(v) => current.setSaved(b, v)}
        reload={() => void current.reload(b)}
      />
    );
  }
  return <Door sourceId={sourceId} source={source} list={path === 'builtins'} {...current} />;
}

function Door({ sourceId, source, list, table, results, setSaved }: { sourceId: string; source: DashboardSource; list: boolean } & ReturnType<typeof useBuiltins>) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { hasPermission, authStatus } = useAuth();
  const canWrite = hasPermission('automation', 'write', { sourceId });
  const canReadRules = hasPermission('automations', 'read');
  const canWriteRules = hasPermission('automations', 'write');
  const device = source.name;
  const home = `/source/${encodeURIComponent(sourceId)}`;
  const base = `${home}/automation`;
  const [filter, setFilter] = useState<'all' | 'on' | 'sends' | 'attention'>('all');
  const [group, setGroup] = useState<Group | null>(null);
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ['workspace', 'automations', 'rules'],
    enabled: !list && canReadRules && !!authStatus?.authenticated,
    queryFn: () => apiService.get<EngineRule[]>('/api/automations'),
    refetchOnWindowFocus: false,
  });
  const ruleRows = rules
    .map((r) => ({ ...r, ...readRule(r.config) }))
    .filter((r) => r.sources === null || r.sources.includes(sourceId));
  const attention = ruleRows.filter((r) => !r.limited);

  const rows: Row[] = table.map((b, i) => ({ b, saved: results[i]?.data, loading: results[i]?.isLoading ?? true }));
  const valueOf = (b: MeshtasticBuiltin, saved: Values) => (b.enabledKey && b.id in edits ? { ...saved, [b.enabledKey]: edits[b.id] } : saved);
  const isOn = (r: Row) => !!r.saved && r.b.isOn(valueOf(r.b, r.saved));
  const changed = rows.filter((r) => r.saved && r.b.enabledKey && r.b.id in edits && edits[r.b.id] !== r.saved[r.b.enabledKey]);
  const pick = (rs: Row[]) => (filter === 'on' ? rs.filter(isOn) : filter === 'sends' ? rs.filter((r) => transmits(r.b)) : filter === 'attention' ? [] : rs);

  // Each changed built-in saves on its own; one failing does not stop the rest, and the dock names both.
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const done: string[] = [];
    const failed: string[] = [];
    for (const { b, saved } of changed) {
      const next = { ...saved!, [b.enabledKey!]: edits[b.id] };
      try {
        await b.save(sourceId, next, saved!);
        setSaved(b, next);
        setEdits((e) => {
          const rest = { ...e };
          delete rest[b.id];
          return rest;
        });
        done.push(b.title);
      } catch (err) {
        failed.push(`${b.title} (${err instanceof Error && err.message ? err.message : t('automation.settings_save_failed', 'Failed to save settings')})`);
      }
    }
    if (failed.length > 0) {
      setError(done.length > 0
        ? t('workspace.automations.saved_and_failed', { saved: done.join(', '), failed: failed.join(', ') })
        : t('workspace.automations.failed', { failed: failed.join(', ') }));
    }
    setSaving(false);
  };
  const [ruleBusy, setRuleBusy] = useState<string | null>(null);
  const toggleRule = async (r: EngineRule) => {
    // One request in flight per switch press; the switch waits for the re-read.
    if (ruleBusy) return;
    setRuleBusy(r.id);
    try {
      await apiService.post(`/api/automations/${encodeURIComponent(r.id)}/${r.enabled ? 'disable' : 'enable'}`);
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : t('automation.settings_save_failed', 'Failed to save settings'), 'error');
    }
    await queryClient.invalidateQueries({ queryKey: ['workspace', 'automations', 'rules'] });
    setRuleBusy(null);
  };

  const row = ({ b, saved, loading }: Row) => {
    const v = saved ? valueOf(b, saved) : undefined;
    const on = v ? b.isOn(v) : false;
    const value = v && b.value?.(v);
    return (
      <li key={b.id} className={own.row} data-on={on || undefined}>
        <div className={own.text}>
          <p className={own.title}>
            {b.title}
            {CONVERTIBLE.has(b.id) && <span className={mine.badge}>{t('workspace.automations.can_run_as_rule')}</span>}
          </p>
          {!list && <p className={own.summary}>{loading ? t('common.loading', 'Loading…') : v ? (on ? b.summary(v) : t('workspace.meshcore.auto.off')) : '—'}</p>}
          {v && <SendsLine>{b.sends(v)}</SendsLine>}
        </div>
        {b.enabledKey && v ? (
          <input
            type="checkbox"
            role="switch"
            className={kit.switch}
            aria-label={b.title}
            checked={v[b.enabledKey] === true}
            disabled={!canWrite || saving}
            onChange={(e) => setEdits((x) => ({ ...x, [b.id]: e.target.checked }))}
          />
        ) : (
          <span className={own.state}>{v ? (value ?? (on ? t('workspace.meshcore.auto.on') : t('workspace.meshcore.auto.off'))) : null}</span>
        )}
        <Link className={styles.iconButton} to={`${base}/${b.id}`} title={b.title}>
          <UiIcon name="chevronRight" size={18} />
          <span className={styles.srOnly}>{t('workspace.meshcore.auto.open', { name: b.title })}</span>
        </Link>
      </li>
    );
  };
  const rule = (r: (typeof ruleRows)[number]) => {
    const sends = r.actions.some((a) => TRANSMITTING.has(a));
    return (
      <li key={r.id} className={own.row} data-on={r.enabled || undefined}>
        <div className={own.text}>
          <p className={own.title}>
            {r.name}
            {!r.limited && <span className={mine.warnBadge}>{t('workspace.automations.no_limit')}</span>}
          </p>
          <p className={own.summary}>{r.sources === null ? t('workspace.meshcore.auto.all_devices') : t('workspace.meshcore.auto.devices_count', { count: r.sources.length })}</p>
          <SendsLine>{sends ? t('workspace.meshcore.auto.rule_sends') : t('workspace.settings.savebar.sends_nothing')}</SendsLine>
        </div>
        <input type="checkbox" role="switch" className={kit.switch} aria-label={r.name} checked={r.enabled} disabled={!canWriteRules || ruleBusy !== null} aria-busy={ruleBusy === r.id || undefined} onChange={() => void toggleRule(r)} />
        <Link className={styles.iconButton} to={ENGINE} title={r.name}>
          <UiIcon name="chevronRight" size={18} />
          <span className={styles.srOnly}>{t('workspace.meshcore.auto.open', { name: r.name })}</span>
        </Link>
      </li>
    );
  };

  const dock = (
    <McDock
      sourceId={sourceId}
      changes={changed.map((r) => r.b.title)}
      page={list ? t('workspace.automations.builtins') : t('workspace.meshcore.auto.title')}
      sends={changed.length ? changed.map((r) => `${r.b.title}: ${r.b.saveEffect(valueOf(r.b, r.saved!))}`).join(' · ') : t('workspace.automations.save.nothing')}
      saveLabel={t('common.save', 'Save')}
      saving={saving}
      blocked={!canWrite}
      error={error}
      onSave={() => void save()}
      onDiscard={() => setEdits({})}
    />
  );
  const loadingAll = results.length > 0 && results.every((r) => r.isLoading);
  const failed = results.length > 0 && results.every((r) => r.isError);

  if (list) {
    const groups = GROUPS.filter((g) => !group || g === group).map((g) => ({ g, items: rows.filter((r) => r.b.group === g) }));
    const groupTitle = (g: Group) => t(`workspace.automations.group.${g}`);
    const section = ({ g, items }: (typeof groups)[number]) => (
      <section key={g} className={styles.section} aria-label={groupTitle(g)}>
        <div className={mine.groupHead}>
          <h2 className={styles.sectionTitle}>{groupTitle(g)} · {items.length}</h2>
          <span className={styles.muted}>{t('workspace.automations.on_count', { count: items.filter(isOn).length })}</span>
        </div>
        <ul className={`${styles.card} ${own.list}`}>{items.map(row)}</ul>
      </section>
    );
    const tokenButton = (
      <button type="button" className={styles.button} onClick={() => setTokens(true)}>
        <UiIcon name="code" size={16} />
        {t('workspace.automations.tokens')}
      </button>
    );
    const half = 2;
    return (
      <div className={styles.page} data-phone={isPhone || undefined}>
        {!isPhone && (
          <Link className={own.crumb} to={base}>
            <UiIcon name="back" size={14} /> {t('workspace.meshcore.auto.title')}
          </Link>
        )}
        <ToolHead
          title={isPhone ? t('workspace.automations.builtins') : t('workspace.automations.builtins_on', { device })}
          subtitle={t('workspace.automations.builtins_subtitle', { count: rows.length })}
          back={{ label: t('workspace.meshcore.auto.title'), to: base }}
          actions={tokenButton}
          phoneActions={null}
        />
        {isPhone && <p className={styles.muted}>{t('workspace.automations.builtins_phone_subtitle', { device, count: rows.length })}</p>}
        {isPhone && (
          <div className={styles.filters}>
            {GROUPS.map((g) => (
              <button key={g} type="button" className={styles.chip} aria-pressed={group === g} onClick={() => setGroup((x) => (x === g ? null : g))}>
                {groupTitle(g)} <span className={styles.chipCount}>{rows.filter((r) => r.b.group === g).length}</span>
              </button>
            ))}
          </div>
        )}
        {failed && <StateView kind="error" />}
        {loadingAll ? <StateView kind="loading" /> : isPhone ? groups.map(section) : (
          <div className={own.columns}>
            <div className={mine.column}>{groups.slice(0, half).map(section)}</div>
            <div className={mine.column}>
              {groups.slice(half).map(section)}
              <SendsLine>{t('workspace.automations.airtime_note')}</SendsLine>
            </div>
          </div>
        )}
        <Sheet open={tokens} onClose={() => setTokens(false)} title={t('automation.tokens.title', 'Available message tokens')}>
          <TokenReference />
        </Sheet>
        {dock}
      </div>
    );
  }

  const door = rows.filter((r) => DOOR.includes(r.b.id)).sort((a, c) => DOOR.indexOf(a.b.id) - DOOR.indexOf(c.b.id));
  const rest = rows.filter((r) => !DOOR.includes(r.b.id));
  const shown = pick(filter === 'all' ? door : rows);
  const shownRules = filter === 'attention' ? attention : filter === 'on' ? ruleRows.filter((r) => r.enabled) : filter === 'sends' ? ruleRows.filter((r) => r.actions.some((a) => TRANSMITTING.has(a))) : ruleRows;
  const moreRow = filter === 'all' && (
    <li className={own.row}>
      <Link className={own.more} to={`${base}/builtins`}>
        <span className={own.text}>
          <span className={mine.moreText}>{t('workspace.automations.more', { count: rest.length, names: `${rest.slice(0, 5).map((r) => r.b.title).join(', ')}${rest.length > 5 ? '…' : ''}` })}</span>
        </span>
        <UiIcon name="chevronRight" size={18} />
      </Link>
    </li>
  );
  const chip = (id: typeof filter, label: string, count?: number) => (
    <button key={id} type="button" className={styles.chip} aria-pressed={filter === id} onClick={() => setFilter(id)}>
      {label} {count !== undefined && <span className={styles.chipCount}>{count}</span>}
    </button>
  );
  const chips = (
    <div className={styles.filters}>
      {chip('all', t('common.all', 'All'))}
      {chip('on', t('workspace.meshcore.auto.on'), rows.filter(isOn).length + ruleRows.filter((r) => r.enabled).length)}
      {chip('sends', t('workspace.meshcore.auto.sends_on_mesh'), rows.filter((r) => transmits(r.b)).length + ruleRows.filter((r) => r.actions.some((a) => TRANSMITTING.has(a))).length)}
      {canReadRules && chip('attention', t('workspace.automations.needs_attention'), attention.length)}
    </div>
  );
  const builtInTitle = isPhone ? t('workspace.automations.built_in') : t('workspace.meshcore.auto.built_in', { device });
  const rulesTitle = isPhone ? t('workspace.automations.rules') : t('workspace.meshcore.auto.rules_title');
  const builtIns = (
    <section className={styles.section} aria-label={builtInTitle}>
      <h2 className={styles.sectionTitle}>{builtInTitle}</h2>
      {loadingAll ? <StateView kind="loading" /> : (
        <ul className={`${styles.card} ${own.list}`}>
          {shown.map(row)}
          {moreRow}
          {shown.length === 0 && !moreRow && <li className={`${own.row} ${styles.muted}`}>{t('workspace.automations.none_here')}</li>}
        </ul>
      )}
    </section>
  );
  const rulesSection: ReactNode = (
    <section className={styles.section} aria-label={rulesTitle}>
      <h2 className={styles.sectionTitle}>{rulesTitle}</h2>
      {canReadRules ? (
        shownRules.length > 0 ? <ul className={`${styles.card} ${own.list}`}>{shownRules.map(rule)}</ul> : <p className={styles.note}>{t('workspace.meshcore.auto.no_rules')}</p>
      ) : (
        <p className={styles.note}>{t('workspace.meshcore.auto.rules_no_permission')}</p>
      )}
      {!isPhone && (
        <p className={styles.banner} role="note">
          <UiIcon name="info" size={16} />
          <span>{t('workspace.automations.door_note')}</span>
        </p>
      )}
    </section>
  );
  const engineLinks = canReadRules && (
    <>
      <Link className={styles.link} to={ENGINE}>{t('workspace.meshcore.auto.all_in_overview')}</Link>
      <Link className={styles.button} to={ENGINE}>{t('workspace.meshcore.auto.templates')}</Link>
      <Link className={`${styles.button} ${styles.primary}`} to={ENGINE}>
        <UiIcon name="plus" size={16} />
        {t('workspace.meshcore.auto.new_rule')}
      </Link>
    </>
  );

  if (isPhone) {
    return (
      <div className={styles.page} data-phone="">
        <ToolHead
          title={t('workspace.meshcore.auto.title')}
          back={{ label: t('workspace.tabs.home'), to: home }}
          phoneActions={canReadRules ? (
            <Link className={styles.iconButton} to={ENGINE} title={t('workspace.meshcore.auto.new_rule')}>
              <UiIcon name="plus" size={22} />
              <span className={styles.srOnly}>{t('workspace.meshcore.auto.new_rule')}</span>
            </Link>
          ) : null}
        />
        <div className={mine.doors} role="group" aria-label={t('workspace.meshcore.auto.title')}>
          <span className={mine.door} aria-current="page">{device}</span>
          <Link className={mine.door} to={ENGINE}>{t('workspace.meshcore.auto.all_devices')}</Link>
        </div>
        {failed && <StateView kind="error" />}
        {builtIns}
        {rulesSection}
        {dock}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ToolHead
        title={t('workspace.meshcore.auto.title')}
        subtitle={t('workspace.automations.subtitle', { device })}
        back={{ label: '', to: home }}
        actions={engineLinks || undefined}
      />
      {chips}
      {failed && <StateView kind="error" />}
      <div className={own.layout}>
        {builtIns}
        {rulesSection}
      </div>
      {dock}
    </div>
  );
}

/** Today's token reference (AutomationTab's), on the kit. */
function TokenReference() {
  const { t } = useTranslation();
  const groups = buildMeshtasticTokenGroups({
    replyTitle: t('automation.tokens.reply_title', 'When replying (Auto-Acknowledge, Auto-Responder)'),
    replyNote: t('automation.tokens.reply_note', 'Resolved from the message that triggered the reply.'),
    globalTitle: t('automation.tokens.global_title', 'Available everywhere'),
    globalNote: t('automation.tokens.global_note', 'Also work in Auto-Announce and Auto-Welcome.'),
  });
  return (
    <div className={styles.sheet}>
      <p className={styles.muted}>
        {t('automation.tokens.intro', 'These placeholders are substituted in the message templates below. Reply tokens only expand when responding to a received message.')}
      </p>
      {groups.map((g) => (
        <section key={g.title} className={styles.section} aria-label={g.title}>
          <h3 className={styles.sectionTitle}>{g.title}</h3>
          {g.note && <p className={styles.muted}>{g.note}</p>}
          <dl className={styles.kv}>
            {g.tokens.map((tk) => (
              <div key={tk.token} className={styles.kvRow}>
                <dt className={`${styles.kvLabel} ${styles.mono}`}>{tk.token}</dt>
                <dd className={styles.kvValue}>{tk.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
