/**
 * A MeshCore radio's Automations (boards 8-14, 8-31; Task 7.5), native at
 * `/source/:id/automations`; `automations/<built-in>` is one built-in's page.
 *
 * - Built in: today's twelve built-ins (Auto Ping on a Companion only, as
 *   today), each with its state, a summary and what it sends (its Sends line,
 *   or "Sends nothing on the mesh"). All / On / Sends on the mesh filter them.
 *   A switch queues in the page's dock ("N changes in Automations"); Save sends
 *   each changed built-in's today's request once, with today's body. Saving
 *   does not run a built-in. A built-in with no switch today (Timer triggers,
 *   Time Sync, Remote Telemetry) shows its state only.
 * - Rules that include this device: the Automation Engine's rules whose source
 *   filter names this device or that have none (all devices), each with its
 *   switch (today's enable/disable, at once) and what it sends; Templates, New
 *   rule and "All devices in Overview" open the engine.
 *
 * Needs automation:read on this device (the view gate); switches need
 * automation:write, the rules automations:read / write.
 */
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import apiService from '../../../services/api';
import { UiIcon } from '../../../components/icons';
import { useToast } from '../../../components/ToastContainer';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import { useMeshCoreRuntime } from '../runtime';
import { McDock } from '../settings/mcShared';
import ToolHead from '../ToolHead';
import { ENGINE, ENGINE_NEW, ENGINE_TEMPLATES, readRule, ruleUrl, rulesQuery, TRANSMITTING, type EngineRule } from '../../automations/engineRules';
import type { Builtin, Values } from './builtins';
import BuiltinPage from './BuiltinPage';
import { useBuiltins } from './useBuiltins';
import kit from '../../settings/kit/kit.module.css';
import styles from '../McTools.module.css';
import own from './Automations.module.css';

/** The phone shows the first five built-ins, then "N more built-ins" (8-31, s8n6). */
const PHONE_FIRST = 5;

export default function MeshCoreAutomationsPage({ builtin }: { builtin: string | null }) {
  const current = useBuiltins({ scripts: builtin === 'auto-responder' || builtin === 'timer-triggers' });
  const { sourceId } = useMeshCoreRuntime();
  if (builtin) {
    const i = current.table.findIndex((b) => b.id === builtin);
    if (i < 0) return <Navigate replace to={`/source/${encodeURIComponent(sourceId)}/automations`} />;
    return <BuiltinPage b={current.table[i]} result={current.results[i]} onSaved={(v) => current.setSaved(current.table[i], v)} reload={() => void current.reload(current.table[i])} />;
  }
  return <Overview {...current} />;
}

function Overview({ table, results, setSaved }: ReturnType<typeof useBuiltins>) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { sourceId, deviceName, receiveOnly } = useMeshCoreRuntime();
  const { hasPermission, authStatus } = useAuth();
  const canWrite = hasPermission('automation', 'write', { sourceId });
  const canReadRules = hasPermission('automations', 'read');
  const canWriteRules = hasPermission('automations', 'write');
  const base = `/source/${encodeURIComponent(sourceId)}`;
  const [filter, setFilter] = useState<'all' | 'on' | 'sends'>('all');
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const { data: rules = [] } = useQuery({
    ...rulesQuery,
    enabled: canReadRules && !!authStatus?.authenticated,
  });
  const mine = rules
    .map((r) => ({ ...r, ...readRule(r.config) }))
    .filter((r) => r.sources === null || r.sources.includes(sourceId));

  const rows = table.map((b, i) => ({ b, saved: results[i]?.data as Values | undefined, loading: results[i]?.isLoading ?? true }));
  const valueOf = (b: Builtin, saved: Values) => (b.enabledKey && b.id in edits ? { ...saved, [b.enabledKey]: edits[b.id] } : saved);
  const on = rows.filter((r) => r.saved && r.b.isOn(valueOf(r.b, r.saved)));
  const sends = rows.filter((r) => r.b.transmits);
  const shown = filter === 'on' ? on : filter === 'sends' ? sends : rows;
  const changed = rows.filter((r) => r.saved && r.b.enabledKey && r.b.id in edits && edits[r.b.id] !== r.saved[r.b.enabledKey]);

  // Each changed built-in saves on its own; one failing does not stop the rest, and the dock names both (as DeviceAutomations).
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

  const sendsText = (b: Builtin, v: Values) => b.sends(v) ?? t('workspace.settings.savebar.sends_nothing');
  const row = ({ b, saved, loading }: (typeof rows)[number]) => {
    const v = saved ? valueOf(b, saved) : undefined;
    const isOn = v ? b.isOn(v) : false;
    return (
      <li key={b.id} className={own.row} data-on={isOn || undefined}>
        <div className={own.text}>
          <p className={own.title}>{b.title}</p>
          <p className={own.summary}>{loading ? t('common.loading', 'Loading…') : v ? (isOn ? b.summary(v) : t('workspace.meshcore.auto.off')) : '—'}</p>
          {v && (b.transmits ? <SendsLine>{sendsText(b, v)}</SendsLine> : <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>)}
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
          <span className={own.state}>{v ? (isOn ? t('workspace.meshcore.auto.on') : t('workspace.meshcore.auto.off')) : null}</span>
        )}
        <Link className={styles.iconButton} to={`${base}/automations/${b.id}`} title={b.title}>
          <UiIcon name="chevronRight" size={18} />
          <span className={styles.srOnly}>{t('workspace.meshcore.auto.open', { name: b.title })}</span>
        </Link>
      </li>
    );
  };
  const rule = (r: (typeof mine)[number]) => {
    const transmits = r.actions.some((a) => TRANSMITTING.has(a));
    return (
      <li key={r.id} className={own.row} data-on={r.enabled || undefined}>
        <div className={own.text}>
          <p className={own.title}>{r.name}</p>
          <p className={own.summary}>{r.sources === null ? t('workspace.meshcore.auto.all_devices') : t('workspace.meshcore.auto.devices_count', { count: r.sources.length })}</p>
          <SendsLine>{transmits ? t('workspace.meshcore.auto.rule_sends') : t('workspace.settings.savebar.sends_nothing')}</SendsLine>
        </div>
        <input type="checkbox" role="switch" className={kit.switch} aria-label={r.name} checked={r.enabled} disabled={!canWriteRules || ruleBusy !== null} aria-busy={ruleBusy === r.id || undefined} onChange={() => void toggleRule(r)} />
        <Link className={styles.iconButton} to={ruleUrl(r.id)} title={r.name}>
          <UiIcon name="chevronRight" size={18} />
          <span className={styles.srOnly}>{t('workspace.meshcore.auto.open', { name: r.name })}</span>
        </Link>
      </li>
    );
  };

  const chip = (id: typeof filter, label: string, count: number) => (
    <button key={id} type="button" className={styles.chip} aria-pressed={filter === id} onClick={() => setFilter(id)}>
      {label} <span className={styles.chipCount}>{count}</span>
    </button>
  );
  const chips = (
    <div className={styles.filters}>
      {chip('all', t('common.all', 'All'), rows.length)}
      {chip('on', t('workspace.meshcore.auto.on'), on.length)}
      {chip('sends', t('workspace.meshcore.auto.sends_on_mesh'), sends.length)}
    </div>
  );
  const builtInTitle = t('workspace.meshcore.auto.built_in', { device: deviceName });
  const rulesTitle = t('workspace.meshcore.auto.rules_title');
  const engineLinks = (
    <>
      <Link className={styles.button} to={ENGINE_TEMPLATES}>{t('workspace.meshcore.auto.templates')}</Link>
      <Link className={`${styles.button} ${styles.primary}`} to={ENGINE_NEW}>
        <UiIcon name="plus" size={16} />
        {t('workspace.meshcore.auto.new_rule')}
      </Link>
    </>
  );
  const note = (
    <p className={styles.banner} role="note">
      <UiIcon name="info" size={16} />
      <span>{receiveOnly ? t('meshcore.receive_only.paused_note', 'Paused — receive-only mode. These settings are saved and unchanged; they take effect again when receive-only is turned off.') : t('workspace.meshcore.auto.receive_only_note')}</span>
    </p>
  );
  const dock = (
    <McDock
      changes={changed.map((r) => r.b.title)}
      page={t('workspace.meshcore.auto.title')}
      sends={changed.length ? changed.map((r) => `${r.b.title}: ${r.b.saveEffect(valueOf(r.b, r.saved!))}`).join(' · ') : t('workspace.meshcore.auto.save_nothing')}
      saveLabel={t('common.save', 'Save')}
      saving={saving}
      blocked={!canWrite}
      error={error}
      onSave={() => void save()}
      onDiscard={() => setEdits({})}
    />
  );
  const loadingAll = results.every((r) => r.isLoading);
  const failed = results.length > 0 && results.every((r) => r.isError);

  if (isPhone) {
    const visible = showAll || filter !== 'all' ? shown : shown.slice(0, PHONE_FIRST);
    const rest = shown.slice(PHONE_FIRST);
    return (
      <div className={styles.page} data-phone="">
        <ToolHead title={t('workspace.meshcore.auto.title')} back={{ label: t('workspace.tabs.home'), to: base }} />
        {chips}
        {failed && <StateView kind="error" />}
        <section className={styles.section} aria-label={builtInTitle}>
          <h2 className={styles.sectionTitle}>{builtInTitle}</h2>
          <ul className={`${styles.card} ${own.list}`}>
            {loadingAll ? <li className={own.row}><StateView kind="loading" /></li> : visible.map(row)}
            {!showAll && filter === 'all' && rest.length > 0 && (
              <li className={own.row}>
                <button type="button" className={own.more} onClick={() => setShowAll(true)}>
                  <span className={own.text}>
                    <span className={own.title}>{t('workspace.meshcore.auto.more', { count: rest.length })}</span>
                    <span className={own.summary}>{rest.map((r) => r.b.title).join(', ')}</span>
                  </span>
                  <UiIcon name="chevronRight" size={18} />
                </button>
              </li>
            )}
          </ul>
        </section>
        {canReadRules && (
          <section className={styles.card} aria-label={rulesTitle}>
            <button type="button" className={own.more} aria-expanded={rulesOpen} onClick={() => setRulesOpen((x) => !x)}>
              <UiIcon name="zap" size={20} />
              <span className={own.title}>{rulesTitle}</span>
              <span className={styles.muted}>{mine.length}</span>
              <UiIcon name={rulesOpen ? 'chevronDown' : 'chevronRight'} size={18} />
            </button>
            {rulesOpen && <ul className={own.list}>{mine.map(rule)}</ul>}
            <div className={`${styles.actions} ${own.pad}`}>{engineLinks}</div>
          </section>
        )}
        {note}
        {dock}
      </div>
    );
  }

  const half = Math.ceil(shown.length / 2);
  const column = (items: typeof rows): ReactNode => <ul className={`${styles.card} ${own.list}`}>{items.map(row)}</ul>;
  return (
    <div className={styles.page}>
      <ToolHead
        title={t('workspace.meshcore.auto.title')}
        subtitle={t('workspace.meshcore.auto.subtitle', { device: deviceName, count: rows.length })}
        back={{ label: '', to: base }}
        actions={
          <>
            <Link className={styles.link} to={ENGINE}>{t('workspace.meshcore.auto.all_in_overview')}</Link>
            {engineLinks}
          </>
        }
      />
      {chips}
      {failed && <StateView kind="error" />}
      <div className={own.layout}>
        <section className={styles.section} aria-label={builtInTitle}>
          <h2 className={styles.sectionTitle}>{builtInTitle}</h2>
          {loadingAll ? <StateView kind="loading" /> : (
            <div className={own.columns}>
              {column(shown.slice(0, half))}
              {shown.length > half && column(shown.slice(half))}
            </div>
          )}
        </section>
        <section className={styles.section} aria-label={rulesTitle}>
          <h2 className={styles.sectionTitle}>{rulesTitle}</h2>
          {canReadRules ? (
            mine.length > 0 ? <ul className={`${styles.card} ${own.list}`}>{mine.map(rule)}</ul> : <p className={styles.note}>{t('workspace.meshcore.auto.no_rules')}</p>
          ) : (
            <p className={styles.note}>{t('workspace.meshcore.auto.rules_no_permission')}</p>
          )}
          {note}
        </section>
      </div>
      {dock}
    </div>
  );
}
