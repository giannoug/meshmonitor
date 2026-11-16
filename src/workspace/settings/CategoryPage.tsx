/**
 * One settings page: a category, or a group's index (boards 12-06 / 12-22
 * Device, 12-07 / b-set-d2 / b-set-p4 Modules; Maintenance's is Task 5.7's).
 *
 * The header names the page with its scope ("On the radio" / "In
 * MeshMonitor") and "View only" for a viewer without today's write grant; on
 * phone it is the page's own bar with Back. A category's rows sit in its
 * SettingsCategoryContext, so the kit knows the category and readOnly.
 *
 * The ☆ in the header (Task 5.4) pins a category to the list's Pinned group.
 *
 * - Device: each hardware category with what it holds now and today's restart
 *   rule for the firmware (configRebootRules), beside the pins in use (Task 5.6).
 * - Modules: the modules this firmware has, A–Z, with On/Off; the others fold
 *   into one row ("N not on this firmware" on desktop, "Hidden: … Why?" on
 *   phone) that still opens them.
 */
import { Suspense, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import RouteLoading from '../../components/RouteLoading/RouteLoading';
import { rebootExpectation } from '../../utils/configRebootRules';
import StateView from '../patterns/StateView';
import { useIsPhone } from '../shell/useIsPhone';
import { SettingsCategoryContext } from './kit/useFieldRegistry';
import { moduleAvailable, moduleOn, type CategoryDef, type CategoryGroup, type CategoryTarget } from './categories';
import { useSharedDeviceConfig } from './sharedDeviceConfig';
import { usePins } from './usePins';
import { deviceSummary } from './deviceSummaries';
import PinsInUseCard from './PinsInUseCard';
import { SettingsHeaderContext, type SubHeader } from './settingsDock';
import styles from './CategoryPage.module.css';

export interface CategoryPageProps {
  def?: CategoryDef;
  group?: CategoryGroup;
  /** The rest of the path after the category: its own deeper page (a channel, Share and import). */
  sub?: string;
  /** The categories this viewer may open on the device. */
  categories: CategoryDef[];
  sourceId: string;
  target: CategoryTarget;
  readOnly: boolean;
}

export default function CategoryPage({ def, group, sub = '', categories, sourceId, target, readOnly }: CategoryPageProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const base = `/source/${encodeURIComponent(sourceId)}/settings`;
  // A deeper page (Task 5.5) names itself and the page above it.
  const [header, setHeader] = useState<SubHeader | null>(null);
  const label = def ? t(def.labelKey) : t(`workspace.settings.group.${group}`);
  const title = header?.title ?? label;
  const scope = t(def?.scope === 'meshmonitor' ? 'workspace.settings.in_meshmonitor' : 'workspace.settings.on_radio');
  const viewOnly = readOnly && <span className={styles.viewOnly}>{t('workspace.settings.view_only')}</span>;
  // What saving does on this firmware (configRebootRules), as the save bar's words say it (Task 5.3).
  const config = useSharedDeviceConfig();
  const firmware = config && !config.state.loading ? config.state.localFirmwareVersion : undefined;
  const rule = def?.saveSection && firmware !== undefined ? rebootExpectation(def.saveSection, firmware) : 'never';
  const restart = rule !== 'never' && (
    <span>
      {'· '}
      {t(`workspace.settings.scope_${rule === 'always' ? 'restarts' : 'may_restart'}${firmware && !isPhone ? '_fw' : ''}`, { version: firmware })}
    </span>
  );

  const extra = header?.scope && <span>{`· ${header.scope}`}</span>;

  const body = def ? (
    <SettingsCategoryContext.Provider value={{ categoryId: def.id, readOnly }}>
      <Suspense fallback={<RouteLoading />}>
        <SettingsHeaderContext.Provider value={setHeader}>
          <def.component sourceId={sourceId} target={target} readOnly={readOnly} sub={sub} />
        </SettingsHeaderContext.Provider>
      </Suspense>
    </SettingsCategoryContext.Provider>
  ) : group === 'modules' ? (
    <ModulesIndex base={base} modules={categories.filter((c) => c.group === 'modules')} />
  ) : (
    <GroupIndex base={base} group={group!} items={categories.filter((c) => c.group === group)} />
  );

  return (
    <main className={styles.page} data-phone={isPhone || undefined}>
      {isPhone ? (
        <header className={styles.bar}>
          <Link to={header?.back?.to ?? (def?.group ? `${base}/${def.group}` : base)} className={styles.back} data-testid="settings-back">
            <UiIcon name="back" size={22} />
            <span>{header?.back?.label ?? t('nav.settings')}</span>
          </Link>
          <h1 className={styles.barTitle}>{header?.phoneTitle ?? title}</h1>
          {def && <PinButton id={def.id} name={label} />}
        </header>
      ) : (
        <header className={styles.header}>
          <div className={styles.headText}>
            {header?.back && (
              <Link to={header.back.to} className={styles.crumb}>
                {header.back.label}
                <UiIcon name="chevronRight" size={14} />
              </Link>
            )}
            <h1 className={styles.title}>{title}</h1>
            {def && (
              <p className={styles.scope}>
                <span>{scope}</span>
                {restart}
                {extra}
                {viewOnly}
              </p>
            )}
          </div>
          {def && <PinButton id={def.id} name={label} />}
        </header>
      )}
      {isPhone && def && (
        <p className={styles.scope}>
          <span>{scope}</span>
          {restart}
          {extra}
          {viewOnly}
        </p>
      )}
      <div className={styles.body}>{body}</div>
    </main>
  );
}

function PinButton({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const { pins, canPin, toggle } = usePins();
  if (!canPin) return null;
  const pinned = pins.includes(id);
  return (
    <button type="button" className={styles.pin} aria-pressed={pinned} aria-label={t('workspace.settings.pin', { name })} onClick={() => toggle(id)}>
      <UiIcon name={pinned ? 'favorite' : 'favoriteOff'} size={20} />
    </button>
  );
}

function Tag({ children, tone }: { children: string; tone?: 'on' }) {
  return <span className={styles.tag} data-tone={tone}>{children}</span>;
}

function GroupIndex({ base, group, items }: { base: string; group: CategoryGroup; items: CategoryDef[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const config = useSharedDeviceConfig();
  const state = config && !config.state.loading ? config.state : undefined;
  const firmware = state?.localFirmwareVersion;
  const tagFor = (c: CategoryDef) => {
    if (!c.saveSection || firmware === undefined) return null;
    const e = rebootExpectation(c.saveSection, firmware);
    if (e === 'never') return null;
    return <Tag>{t(e === 'always' ? 'workspace.settings.tag_restarts' : 'workspace.settings.tag_may_restart')}</Tag>;
  };
  const device = group === 'device';
  const categories = (
    <div className={styles.column}>
      <h2 className={styles.heading} id="settings-index-heading">{t('workspace.settings.categories')}</h2>
      <ul className={styles.list} aria-labelledby="settings-index-heading">
        {items.map((c) => {
          const summary = state && deviceSummary(t, c.id, state);
          return (
            <li key={c.id}>
              <Link to={`${base}/${c.id}`} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{t(c.labelKey)}</span>
                  {summary && <span className={styles.summary}>{summary}</span>}
                </span>
                {tagFor(c)}
                <UiIcon name="chevronRight" size={18} />
              </Link>
            </li>
          );
        })}
      </ul>
      {device && firmware && <p className={styles.note}>{t('workspace.settings.restart_note', { version: firmware })}</p>}
    </div>
  );
  return (
    <>
      <p className={styles.scope}>
        {device ? t('workspace.settings.device_scope', { count: items.length }) : t('workspace.settings.on_radio')}
      </p>
      {device ? (
        <div className={styles.split} data-phone={isPhone || undefined}>
          {categories}
          {state && (
            <div className={styles.side}>
              <PinsInUseCard state={state} base={base} />
            </div>
          )}
        </div>
      ) : (
        categories
      )}
    </>
  );
}

/** Two columns read down, A–Z (12-07). */
const columns = (n: number) => ({ '--rows': Math.ceil(n / 2) }) as CSSProperties;

function ModulesIndex({ base, modules }: { base: string; modules: CategoryDef[] }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const config = useSharedDeviceConfig();
  const [showHidden, setShowHidden] = useState(false);
  if (!config || config.state.loading) return <StateView kind="loading" />;
  const { state } = config;
  const sorted = modules
    .map((c) => ({ c, label: t(c.labelKey) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  const shown = sorted.filter(({ c }) => moduleAvailable(c.id, state.supportedModules));
  const hidden = sorted.filter(({ c }) => !moduleAvailable(c.id, state.supportedModules));

  const rows = (items: typeof sorted) =>
    items.map(({ c, label }) => {
      const on = moduleOn(c.id, state);
      return (
        <li key={c.id}>
          <Link to={`${base}/${c.id}`} className={styles.row}>
            <span className={styles.rowLabel}>{label}</span>
            {on !== null && <Tag tone={on ? 'on' : undefined}>{t(on ? 'workspace.settings.tag_on' : 'workspace.settings.tag_off')}</Tag>}
            <UiIcon name="chevronRight" size={18} />
          </Link>
        </li>
      );
    });

  return (
    <>
      <p className={styles.scope}>
        {t('workspace.settings.modules_scope', { supported: shown.length, total: sorted.length })}
      </p>
      <h2 className={styles.heading} id="settings-modules-heading">{t('workspace.settings.supported')}</h2>
      <ul className={styles.list} data-columns={!isPhone || undefined} style={columns(shown.length)} aria-labelledby="settings-modules-heading">
        {rows(shown)}
      </ul>
      {hidden.length > 0 &&
        (isPhone ? (
          <p className={styles.note}>
            <UiIcon name="info" size={16} />
            <span>
              {t('workspace.settings.modules_hidden', { names: hidden.map((h) => h.label).join(', ') })}{' '}
              <button type="button" className={styles.link} aria-expanded={showHidden} onClick={() => setShowHidden((s) => !s)}>
                {t('workspace.settings.why')}
              </button>
            </span>
          </p>
        ) : (
          <button type="button" className={styles.fold} aria-expanded={showHidden} onClick={() => setShowHidden((s) => !s)}>
            <UiIcon name={showHidden ? 'chevronDown' : 'chevronRight'} size={18} />
            <span className={styles.foldText}>
              <span className={styles.rowLabel}>{t('workspace.settings.modules_hidden_count', { count: hidden.length })}</span>
              <span className={styles.foldNames}>{hidden.map((h) => h.label).join(' · ')}</span>
            </span>
            <span className={styles.foldAction}>{t(showHidden ? 'workspace.settings.hide' : 'workspace.settings.show')}</span>
          </button>
        ))}
      {showHidden && <ul className={styles.list} data-columns={!isPhone || undefined} style={columns(hidden.length)}>{rows(hidden)}</ul>}
    </>
  );
}
