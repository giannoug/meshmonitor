/**
 * Overview › Automations (Task 8.4; 14-01, 14-09): every Automation Engine
 * rule on this MeshMonitor with its device tags, trigger chip, schedule-window
 * chip, Sends line and "No limit set" (s14n1, read literally); the Enabled
 * switch, Runs, Trace and ⋯ (Edit, Export, Duplicate, Delete). The device
 * chips filter the list. Variables is the second tab (VariablesPage) and
 * Templates a button (TemplateWizard); both live under this URL.
 *
 * Rules are global (CLAUDE.md exception 3): a rule names devices through its
 * source filters, and a tag shows only for a device the viewer can read.
 * Gates as today: automations:read to see, automations:write to change.
 * Opening or re-rendering the page sends nothing that writes.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { UiIcon, type UiIconName } from '../../components/icons';
import TelemetryTriggerNotice from '../../components/automations/TelemetryTriggerNotice';
import { scheduleStatus } from '../../components/automations/scheduleStatus';
import type { Automation } from '../../components/automations/automationsPageLogic';
import SendsLine from '../patterns/SendsLine';
import RowMenu from '../patterns/RowMenu';
import StateView from '../patterns/StateView';
import DeviceTag from '../patterns/DeviceTag';
import { useShellDevices } from '../shell/shellDevices';
import { useIsPhone } from '../shell/useIsPhone';
import ToolHead from '../meshcore/ToolHead';
import { ENGINE, ENGINE_NEW, ENGINE_TEMPLATES, readRule, ruleUrl, rulesQuery } from './engineRules';
import { readGraph, ruleSends, triggerChip, triggerOf, variablesQuery } from './rules';
import { useRuleActions } from './ruleActions';
import VariablesPage from './VariablesPage';
import TemplateWizard from './TemplateWizard';
import kit from '../settings/kit/kit.module.css';
import styles from '../meshcore/McTools.module.css';
import badge from './DeviceAutomations.module.css';
import own from './Rules.module.css';

export default function RulesList() {
  const { '*': splat = '' } = useParams();
  const [tab, ...rest] = splat.split('/').filter(Boolean);
  if (tab === 'templates') return <TemplateWizard templateId={rest[0] ?? null} />;
  return <Engine variables={tab === 'variables'} />;
}

function Engine({ variables }: { variables: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { hasPermission, authStatus } = useAuth();
  const canRead = hasPermission('automations', 'read');
  const canWrite = hasPermission('automations', 'write');
  const signedIn = !!authStatus?.authenticated;
  const { data: rules, isLoading, isError } = useQuery({ ...rulesQuery, enabled: canRead && signedIn });
  const { data: vars } = useQuery({ ...variablesQuery, enabled: canRead && signedIn });

  const tabs = (
    <nav className={isPhone ? own.switchTabs : styles.tabs} aria-label={t('workspace.meshcore.auto.title')}>
      <Link className={isPhone ? own.switchTab : styles.tab} to={ENGINE} aria-current={!variables ? 'page' : undefined}>
        {t('workspace.meshcore.auto.title')}{!isPhone && rules && <span className={styles.muted}> {rules.length}</span>}
      </Link>
      <Link className={isPhone ? own.switchTab : styles.tab} to={`${ENGINE}/variables`} aria-current={variables ? 'page' : undefined}>
        {t('workspace.rules.variables')}{!isPhone && vars && <span className={styles.muted}> {vars.length}</span>}
      </Link>
    </nav>
  );
  const templates = (
    <Link className={styles.button} to={ENGINE_TEMPLATES}>
      <UiIcon name="dashboard" size={16} />
      {t('workspace.meshcore.auto.templates')}
    </Link>
  );
  const newRule = canWrite && (
    <Link className={`${styles.button} ${styles.primary}`} to={ENGINE_NEW}>
      <UiIcon name="plus" size={16} />
      {t('workspace.rules.new')}
    </Link>
  );

  return (
    <div className={styles.page} data-phone={isPhone || undefined}>
      <ToolHead
        title={t('workspace.meshcore.auto.title')}
        subtitle={t('workspace.rules.subtitle')}
        back={{ label: t('workspace.shell.overview'), to: '/overview' }}
        actions={<>{templates}{newRule}</>}
        phoneActions={canWrite ? (
          <Link className={styles.iconButton} to={ENGINE_NEW} title={t('workspace.rules.new')}>
            <UiIcon name="plus" size={22} />
            <span className={styles.srOnly}>{t('workspace.rules.new')}</span>
          </Link>
        ) : null}
      />
      {isPhone ? <div className={own.phoneTabs}>{tabs}{templates}</div> : tabs}
      {!canRead ? (
        <StateView kind="noPermission" />
      ) : variables ? (
        <VariablesPage canWrite={canWrite} rules={rules ?? []} />
      ) : isError ? (
        <StateView kind="error" />
      ) : isLoading || !rules ? (
        <StateView kind="loading" />
      ) : (
        <Rules rules={rules} canWrite={canWrite} />
      )}
    </div>
  );
}

type MenuItem = { key: string; label: string; icon: UiIconName; to?: string; danger?: boolean; disabled?: boolean; onSelect?: () => void };

function Rules({ rules, canWrite }: { rules: Automation[]; canWrite: boolean }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const { sources } = useShellDevices();
  const [device, setDevice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const actions = useRuleActions();
  const navigate = useNavigate();
  const now = Date.now();
  const rows = rules.map((r) => {
    const graph = readGraph(r.config);
    return { r, graph, ...readRule(r.config), trigger: triggerOf(graph) };
  });
  const shown = device ? rows.filter((x) => x.sources === null || x.sources.includes(device)) : rows;

  const chips = (
    <div className={styles.filters} role="group" aria-label={t('workspace.rules.filter_devices')}>
      <button type="button" className={styles.chip} aria-pressed={device === null} onClick={() => setDevice(null)}>{t('workspace.meshcore.auto.all_devices')}</button>
      {sources.map((s) => (
        <button key={s.id} type="button" className={styles.chip} aria-pressed={device === s.id} onClick={() => setDevice(s.id)} title={s.name}>
          <DeviceTag sourceId={s.id} />
          {!isPhone && s.name}
          {isPhone && <span className={styles.srOnly}>{s.name}</span>}
        </button>
      ))}
    </div>
  );

  const items = (r: Automation): MenuItem[] => [
    { key: 'edit', label: t('common.edit'), icon: 'edit', to: ruleUrl(r.id) },
    { key: 'runs', label: t('workspace.rules.runs'), icon: 'list', to: `${ruleUrl(r.id)}/runs` },
    { key: 'trace', label: t('workspace.rules.trace'), icon: 'activity', to: `${ruleUrl(r.id)}/trace` },
    { key: 'export', label: t('workspace.rules.export'), icon: 'copy', onSelect: () => actions.exportRule(r) },
    { key: 'duplicate', label: t('workspace.rules.duplicate'), icon: 'plus', disabled: !canWrite, onSelect: () => actions.askDuplicate(r) },
    { key: 'delete', label: t('workspace.rules.delete'), icon: 'delete', danger: true, disabled: !canWrite, onSelect: () => actions.askDelete(r) },
  ];

  const row = ({ r, graph, sources: ids, limited, trigger }: (typeof rows)[number]) => {
    const window = scheduleStatus(r.config, now);
    return (
      <li key={r.id} className={own.ruleRow} data-phone={isPhone || undefined}>
        <div className={own.ruleText}>
          <p className={own.ruleTitle}>
            <span className={own.ruleName}>{r.name}</span>
            {trigger && <span className={own.chip}><UiIcon name="zap" size={13} />{triggerChip(t, trigger.type)}</span>}
            {window && <span className={own.chip}><UiIcon name="time" size={13} />{window}</span>}
            {!limited && <span className={badge.warnBadge}>{t('workspace.automations.no_limit')}</span>}
          </p>
          <p className={own.ruleSub}>
            {ids === null
              ? <span className={own.chip}><UiIcon name="dashboard" size={13} />{t('workspace.meshcore.auto.all_devices')}</span>
              : ids.map((id) => <DeviceTag key={id} sourceId={id} />)}
            {!isPhone && r.description && <span>{r.description}</span>}
          </p>
          <SendsLine>{ruleSends(graph, t)}</SendsLine>
        </div>
        <label className={own.enabled}>
          <input
            type="checkbox"
            role="switch"
            className={kit.switch}
            aria-label={r.name}
            checked={r.enabled}
            disabled={!canWrite || actions.busy !== null}
            aria-busy={actions.busy === r.id || undefined}
            onChange={() => actions.toggle(r)}
          />
          {!isPhone && <span>{r.enabled ? t('workspace.rules.enabled') : t('workspace.meshcore.auto.off')}</span>}
        </label>
        {isPhone ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-expanded={open === r.id}
            aria-label={t('workspace.rules.actions_for', { name: r.name })}
            onClick={() => setOpen((x) => (x === r.id ? null : r.id))}
          >
            <UiIcon name="more" size={20} />
          </button>
        ) : (
          <span className={own.rowButtons}>
            <Link className={styles.button} to={`${ruleUrl(r.id)}/runs`}>{t('workspace.rules.runs')}</Link>
            <Link className={styles.button} to={`${ruleUrl(r.id)}/trace`}>{t('workspace.rules.trace')}</Link>
            <RowMenu
              label={t('workspace.rules.actions_for', { name: r.name })}
              items={items(r)
                .filter((i) => i.key !== 'runs' && i.key !== 'trace')
                .map(({ to, ...i }) => ({ ...i, onSelect: i.onSelect ?? (() => navigate(to!)) }))}
            />
          </span>
        )}
        {isPhone && open === r.id && (
          <div className={own.rowActions}>
            {items(r).map((i) => (i.to ? (
              <Link key={i.key} className={styles.button} to={i.to}><UiIcon name={i.icon} size={16} />{i.label}</Link>
            ) : (
              <button key={i.key} type="button" className={`${styles.button} ${i.danger ? own.dangerButton : ''}`} disabled={i.disabled} onClick={i.onSelect}>
                <UiIcon name={i.icon} size={16} />{i.label}
              </button>
            )))}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      {chips}
      <TelemetryTriggerNotice automations={rules} />
      {shown.length === 0 ? (
        <p className={styles.note}>{rules.length === 0 ? t('workspace.rules.none') : t('workspace.rules.none_for_device')}</p>
      ) : (
        <ul className={`${styles.card} ${own.list}`} aria-label={t('workspace.meshcore.auto.title')}>{shown.map(row)}</ul>
      )}
      {!isPhone && (
        <p className={styles.note}>
          <UiIcon name="info" size={16} />
          <span>{t('workspace.rules.list_note', { count: rules.length })}</span>
        </p>
      )}
      {actions.sheets}
    </>
  );
}
