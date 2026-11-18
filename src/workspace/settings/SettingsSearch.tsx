/**
 * Settings search (board b-set-d4-search; spec "Search"): ⌘, / Ctrl+, anywhere
 * in the Workspace, or "Search everywhere" from a settings list. The shell
 * owns the shortcut and mounts this while it is open.
 *
 * Results are grouped by where they live: each device whose settings the
 * viewer may open (the open one first), then Preferences and Global Settings.
 * - Setting: a field on the open category, from the row kit's registry
 *   (useFieldRegistry); it opens the category at `#setting-<id>`, where the
 *   row scrolls into view and pulses. Fields of categories that are not
 *   mounted are not known, so other categories are found by section.
 * - Preferences rows: every row of the You › Preferences pages
 *   (`PREF_FIELDS`, Task 6.3), mounted or not, opening at the row's anchor.
 * - Section: today's section catalogue (`buildConfigSurfaces`), matched with
 *   today's rule (configSearchMatch); a device's sections lead to the category
 *   they live in (SECTION_TO_CATEGORY), and only to categories the viewer may
 *   open there (`visibleCategories`, the frame's own gate). View only
 *   categories stay findable.
 *
 * Results are links, so the settings leave guard (Task 5.3) asks before one
 * leaves the device's settings with radio edits queued; picking one closes
 * search first, so one sheet shows at a time (D9c). Enter clicks the chosen
 * link for the same reason. Searching sends nothing and asks the server
 * nothing: the firmware OTA flag is read from the health cache only.
 * While the open device configures a remote node (Task 5.9), its results are
 * that node's categories, as its settings list shows them.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../components/icons';
import { globalSettingsNav } from '../../components/nav/sourceNavEntries';
import { buildConfigSurfaces, meshcoreConfigurationNavItems } from '../../components/search/configSections';
import { matchRank, matchesQuery, tokenize } from '../../components/search/configSearchMatch';
import { useAuth } from '../../contexts/AuthContext';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useHealth } from '../../hooks/useHealth';
import { appBasename } from '../../init';
import { PREFERENCE_CATEGORIES } from '../routes';
import { PREF_FIELDS, PREF_PAGE_LABELS } from '../you/preferences/prefFields';
import { SERVER_FIELDS } from '../server/serverFields';
import { SERVER_ALIASES, useServerAccess } from '../server/serverEntries';
import type { WorkspaceSource } from '../shell/useWorkspaceSources';
import { SECTION_TO_CATEGORY, visibleCategories, type CategoryDef } from './categories';
import { isMac, settingAnchor, useFieldRegistry } from './kit/useFieldRegistry';
import { remoteEntry } from './remote/remoteTargetStore';
import { MESHCORE_FIELDS, MESHCORE_SECTION_TO_CATEGORY } from '../meshcore/settings/meshcoreSearch';
import styles from './SettingsSearch.module.css';

/** The device types the settings frame serves (a MeshCore device since Task 7.4). */
const FRAME_TYPES = ['meshtastic_tcp', 'mqtt_broker', 'mqtt_bridge', 'meshcore'];
const MESHCORE_FIELD_IDS = new Set(MESHCORE_FIELDS.map((f) => f.id));
/** Cap on shown results, as today's palette: a query that matches everything is not a useful list. */
const MAX_HITS = 40;

interface Hit {
  to: string;
  label: string;
  where?: string;
  kind: 'setting' | 'section';
  rank: number;
}

interface Group {
  key: string;
  title: string;
  hits: Hit[];
}

export interface SettingsSearchProps {
  sources: WorkspaceSource[];
  /** The device open in the URL, whose mounted fields are searched. */
  openId: string | null;
  phone: boolean;
  initialQuery: string;
  onClose(): void;
}

export default function SettingsSearch({ sources, openId, phone, initialQuery, onClose }: SettingsSearchProps) {
  const { t } = useTranslation();
  const { authStatus, hasPermission } = useAuth();
  const fields = useFieldRegistry();
  // The cache App's and the frame's polls fill; no request of its own (enabled: false).
  const { data: health } = useHealth({ baseUrl: appBasename, refetchInterval: 60000, enabled: false });
  const { contentRef, onKeyDown: trapFocus } = useDialogA11y(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { input: useId(), list: useId() };
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  useEffect(() => inputRef.current?.focus(), []);

  const isAdmin = authStatus?.user?.isAdmin === true;
  const { canWrite: canWriteServer } = useServerAccess();
  const isAuthenticated = authStatus?.authenticated === true;
  const groups = useMemo<Group[]>(() => {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const byRank = (a: Hit, b: Hit) => a.rank - b.rank || (a.kind === b.kind ? 0 : a.kind === 'setting' ? -1 : 1);
    const out: Group[] = [];
    const devices = [...sources.filter((s) => s.id === openId), ...sources.filter((s) => s.id !== openId)];
    for (const d of devices) {
      if (!FRAME_TYPES.includes(d.type)) continue;
      const categories = new Map<string, CategoryDef>(
        visibleCategories({
          sourceId: d.id,
          sourceType: d.type,
          isAdmin,
          isAuthenticated,
          firmwareOtaEnabled: health?.firmwareOtaEnabled === true,
          hasPermission,
          // The open device's remote target lists what its settings list does (Task 5.9).
          remote: d.id === openId && remoteEntry(d.id).node !== null,
          // A MeshCore device's pages follow its role, as its settings frame last read it (Task 7.4).
          meshcore: remoteEntry(d.id).device ?? undefined,
        }).map((c) => [c.id, c]),
      );
      const meshcore = d.type === 'meshcore';
      const base = `/source/${encodeURIComponent(d.id)}/settings`;
      const scopeOf = (c: CategoryDef) => t(c.scope === 'radio' ? 'workspace.settings.on_radio' : 'workspace.settings.in_meshmonitor');
      const hits: Hit[] = [];
      if (d.id === openId) {
        for (const f of fields) {
          // A MeshCore page's rows are listed below, mounted or not.
          if (meshcore && MESHCORE_FIELD_IDS.has(f.id)) continue;
          const c = categories.get(f.categoryId);
          if (!c || !matchesQuery(`${f.label} ${f.keywords.join(' ')}`, tokens)) continue;
          hits.push({
            to: `${base}/${c.id}#${settingAnchor(f.id)}`,
            label: f.label,
            where: t('workspace.settings.search.where', { scope: scopeOf(c), category: t(c.labelKey) }),
            kind: 'setting',
            rank: matchRank(f.label, tokens),
          });
        }
      }
      if (meshcore) {
        // Every MeshCore row (MESHCORE_FIELDS), today's Device Configuration sections, and each page by name.
        for (const f of MESHCORE_FIELDS) {
          const c = categories.get(f.categoryId);
          const label = t(f.labelKey);
          if (!c || !matchesQuery(label, tokens)) continue;
          hits.push({
            to: `${base}/${c.id}#${settingAnchor(f.id)}`,
            label,
            where: t('workspace.settings.search.where', { scope: scopeOf(c), category: t(c.labelKey) }),
            kind: 'setting',
            rank: matchRank(label, tokens),
          });
        }
        const sections = meshcoreConfigurationNavItems(t, {
          isCompanion: true,
          showChannels: true,
          showContactSync: true,
          showConsole: true,
          showObserver: true,
          showDangerZone: true,
          showBackups: true,
          showRepeaterSettings: true,
          showRepeaterClock: true,
        }).map((item) => ({ item, c: categories.get(MESHCORE_SECTION_TO_CATEGORY[item.id]) }));
        const named = new Set(sections.map((s) => s.c?.id));
        const pages = [...categories.values()].filter((c) => !named.has(c.id)).map((c) => ({ item: { id: c.id, label: t(c.labelKey), keywords: [] as string[] }, c }));
        for (const { item, c } of [...sections, ...pages]) {
          const category = c && t(c.labelKey);
          if (!c || !matchesQuery(`${item.label} ${category} ${(item.keywords ?? []).join(' ')}`, tokens)) continue;
          hits.push({
            to: `${base}/${c.id}`,
            label: item.label,
            where: item.label === category ? scopeOf(c) : t('workspace.settings.search.where', { scope: scopeOf(c), category }),
            kind: 'section',
            rank: matchRank(item.label, tokens),
          });
        }
        if (hits.length) out.push({ key: d.id, title: d.name, hits: hits.sort(byRank) });
        continue;
      }
      // Every gate below is the category's: the catalogue is asked for everything, then filtered by it.
      const surfaces = buildConfigSurfaces(t, {
        sourceId: d.id,
        sourceType: d.type,
        isAdmin: true,
        canWriteSettings: true,
        canReadSources: true,
        canReadConfiguration: true,
        firmwareOtaEnabled: true,
      });
      for (const item of surfaces.flatMap((s) => s.items)) {
        const c = categories.get(SECTION_TO_CATEGORY[item.id]);
        const category = c && t(c.labelKey);
        if (!c || !matchesQuery(`${item.label} ${category} ${(item.keywords ?? []).join(' ')}`, tokens)) continue;
        hits.push({
          to: `${base}/${c.id}`,
          label: item.label,
          where: item.label === category ? scopeOf(c) : t('workspace.settings.search.where', { scope: scopeOf(c), category }),
          kind: 'section',
          rank: matchRank(item.label, tokens),
        });
      }
      if (hits.length) out.push({ key: d.id, title: d.name, hits: hits.sort(byRank) });
    }

    const global = buildConfigSurfaces(t, {
      sourceId: null,
      isAdmin,
      canWriteSettings: hasPermission('settings', 'write', { anySource: true }),
      databaseType: health?.databaseType ?? null,
      firmwareOtaEnabled: health?.firmwareOtaEnabled === true,
    }).flatMap((s) => s.items);
    // Every Preferences row is known, mounted or not (s13n0), and opens at its anchor.
    const prefFields: Hit[] = PREF_FIELDS.filter((f) => !f.adminOnly || isAdmin).flatMap((f) => {
      const label = t(f.labelKey, f.fallback ?? f.labelKey);
      const [pageKey, pageFallback] = PREF_PAGE_LABELS[f.page];
      const page = t(pageKey, pageFallback ?? pageKey);
      if (!matchesQuery(`${label} ${page}`, tokens)) return [];
      return [{
        to: `/preferences/${f.page}#${settingAnchor(f.id)}`,
        label,
        where: t('workspace.settings.search.where', { scope: t('workspace.shell.preferences'), category: page }),
        kind: 'setting' as const,
        rank: matchRank(label, tokens),
      }];
    });
    // Server › General's rows (Task 6.4), behind the page's gates.
    const serverFields: Hit[] = SERVER_FIELDS.filter((f) => (f.gate === 'admin' ? isAdmin : canWriteServer)).flatMap((f) => {
      const label = t(f.labelKey, f.fallback ?? f.labelKey);
      const page = t('workspace.server.general');
      if (!matchesQuery(`${label} ${page}`, tokens)) return [];
      return [{
        to: `/server/${f.page}#${settingAnchor(f.id)}`,
        label,
        where: t('workspace.settings.search.where', { scope: globalSettingsNav(t).label, category: page }),
        kind: 'setting' as const,
        rank: matchRank(label, tokens),
      }];
    });
    for (const prefs of [true, false]) {
      const hits: Hit[] = (prefs ? prefFields : serverFields).concat(global
        .map((item) => ({ item, cat: item.id.slice('settings-'.length) }))
        .filter(({ cat }) => PREFERENCE_CATEGORIES.includes(cat) === prefs)
        .filter(({ item }) => matchesQuery(`${item.label} ${(item.keywords ?? []).join(' ')}`, tokens))
        .map(({ item, cat }) => ({
          to: prefs ? `/preferences/${cat}` : `/server/${SERVER_ALIASES[cat] ?? cat}`,
          label: item.label,
          kind: 'section' as const,
          rank: matchRank(item.label, tokens),
        })));
      if (hits.length) {
        out.push({ key: prefs ? 'preferences' : 'server', title: prefs ? t('workspace.shell.preferences') : globalSettingsNav(t).label, hits: hits.sort(byRank) });
      }
    }

    // As today's palette: rank every result, keep the best 40 (stable: group order breaks ties), then group them.
    const kept = new Set(
      out
        .flatMap((g) => g.hits)
        .sort(byRank)
        .slice(0, MAX_HITS),
    );
    return out.map((g) => ({ ...g, hits: g.hits.filter((h) => kept.has(h)) })).filter((g) => g.hits.length > 0);
  }, [query, sources, openId, fields, isAdmin, isAuthenticated, hasPermission, canWriteServer, health?.firmwareOtaEnabled, health?.databaseType, t]);

  const total = groups.reduce((n, g) => n + g.hits.length, 0);
  const optionId = (i: number) => `${ids.list}-${i}`;
  useEffect(() => {
    document.getElementById(`${ids.list}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, ids.list]);

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (total === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : total - 1)) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A real click, so the leave guard sees it as it sees a pointer.
      document.getElementById(optionId(Math.min(active, total - 1)))?.click();
    }
  };

  const mac = isMac();
  const tokens = tokenize(query);
  let index = 0;

  return createPortal(
    <div className={styles.layer} data-phone={phone || undefined}>
      {!phone && <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />}
      <div
        ref={contentRef}
        className={styles.panel}
        data-phone={phone || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={t('config_search.title')}
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <div className={styles.head}>
          {phone && (
            <button type="button" className={styles.icon} onClick={onClose} aria-label={t('common.back')}>
              <UiIcon name="back" size={22} />
            </button>
          )}
          <UiIcon name="search" size={20} />
          <label htmlFor={ids.input} className={styles.srOnly}>{t('config_search.title')}</label>
          <input
            ref={inputRef}
            id={ids.input}
            className={styles.input}
            type="text"
            role="combobox"
            aria-expanded={total > 0}
            aria-controls={ids.list}
            aria-autocomplete="list"
            aria-activedescendant={total > 0 ? optionId(Math.min(active, total - 1)) : undefined}
            autoComplete="off"
            value={query}
            placeholder={t('config_search.placeholder')}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
          />
          {!phone && (
            <span className={styles.hint}>
              {t('workspace.settings.search.opens_with')}
              <kbd className={styles.kbd}>{t(mac ? 'workspace.settings.search.shortcut_mac' : 'workspace.settings.search.shortcut_other')}</kbd>
              <kbd className={styles.kbd}>{t('workspace.settings.search.esc')}</kbd>
            </span>
          )}
        </div>

        <div id={ids.list} className={styles.body} role="listbox" aria-label={t('config_search.title')}>
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${ids.list}-${g.key}`} className={styles.group}>
              <div id={`${ids.list}-${g.key}`} className={styles.groupTitle} role="presentation">{g.title}</div>
              {g.hits.map((h) => {
                const i = index++;
                const selected = i === Math.min(active, total - 1);
                return (
                  <Link
                    key={`${h.kind}:${h.to}:${h.label}`}
                    id={optionId(i)}
                    to={h.to}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={styles.result}
                    onMouseMove={() => !selected && setActive(i)}
                    onClick={onClose}
                  >
                    <span className={styles.text}>
                      <span className={styles.label}>{h.label}</span>
                      {h.where && <span className={styles.where}>{h.where}</span>}
                    </span>
                    <span className={styles.tag}>
                      {t(h.kind === 'setting' ? 'workspace.settings.search.kind_setting' : 'workspace.settings.search.kind_section')}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
          {tokens.length > 0 && total === 0 && (
            <p className={styles.note} role="status">{t('config_search.no_results')}</p>
          )}
          {tokens.length === 0 && <p className={styles.note}>{t('config_search.hint')}</p>}
        </div>

        <div className={styles.foot}>
          {!phone && (
            <span className={styles.keys}>
              <kbd className={styles.kbd}>
                <UiIcon name="sortAscending" size={12} />
                <UiIcon name="sortDescending" size={12} />
                <span className={styles.srOnly}>{t('workspace.settings.search.arrow_keys')}</span>
              </kbd>
              {t('workspace.settings.search.move')}
              <kbd className={styles.kbd}>
                <UiIcon name="enterKey" size={12} />
                <span className={styles.srOnly}>{t('workspace.settings.search.enter_key')}</span>
              </kbd>
              {t('workspace.settings.search.open')}
            </span>
          )}
          <span className={styles.scope}>{t('workspace.settings.search.scope')}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
