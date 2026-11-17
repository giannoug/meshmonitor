/**
 * You › Preferences › Appearance (boards 13-01 desktop, 13-15 phone; Task
 * 6.3): today's Appearance section of global Settings, saving as you go.
 *
 * - Look: appearance mode, dark and light theme; for admins today's default
 *   landing page (s13n5 moves it to Server › General in 6.4).
 * - Map pins and lists: pin style, the official pin's colour (official
 *   only, #5018), node list style, icon style.
 * - Tapback emojis: today's add / remove / reset (useTapbackEmojiEditor);
 *   reset asks first with today's words.
 * - Custom themes: today's list (useCustomThemes). Apply as dark / light set
 *   the Dark / Light theme rows; Edit and ⋯ Clone open the editor page; ⋯
 *   Delete asks first with today's words. Phone: a row to the list's page.
 *
 * Each row writes today's key to `POST /api/settings` and fans out to
 * SettingsContext as global Settings' Save did. Nothing here transmits.
 */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { useCustomThemes } from '../../../components/themes/useCustomThemes';
import { useTapbackEmojiEditor } from '../../../components/themes/useTapbackEmojiEditor';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useSettings,
  type AppearanceMode,
  type CustomTheme,
  type IconStyle,
  type MapPinColorMode,
  type MapPinStyle,
  type Theme,
} from '../../../contexts/SettingsContext';
import type { NodeListStyle } from '../../../utils/nodeColor';
import ConfirmSheet from '../../patterns/ConfirmSheet';
import SettingGroup from '../../settings/kit/SettingGroup';
import { useReadOnly } from '../../settings/kit/useFieldRegistry';
import { AutoSelect } from '../../settings/categories/autosave';
import { useAutosaveSetting } from '../../settings/useAutosaveSetting';
import { useShellDevices } from '../../shell/shellDevices';
import { useIsPhone } from '../../shell/useIsPhone';
import PrefsFrame from './PrefsFrame';
import { swatchesOf, text, themeOptions } from './prefValues';
import styles from './Preferences.module.css';

export const THEMES_PATH = '/preferences/appearance/themes';

export default function AppearancePage() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  return (
    <PrefsFrame categoryId="appearance" title={t('settings.appearance')} icon="sun">
      <div className={styles.columns} data-phone={isPhone || undefined}>
        <div className={styles.column}>
          <LookRows />
        </div>
        <div className={styles.column}>
          <TapbackCard />
          {isPhone ? <ThemesLink /> : <CustomThemeList />}
        </div>
      </div>
    </PrefsFrame>
  );
}

function LookRows() {
  const { t } = useTranslation();
  const s = useSettings();
  const { authStatus } = useAuth();
  const { sources } = useShellDevices();
  const isAdmin = authStatus?.authenticated === true && authStatus.user?.isAdmin === true;
  const themes = themeOptions(t, s.customThemes);

  return (
    <>
      <SettingGroup title={t('workspace.prefs.look')}>
        <AutoSelect
          stacked
          segmented
          k="appearanceMode"
          id="appearance.appearanceMode"
          label={t('settings.appearance_mode_label')}
          help={t('settings.appearance_mode_description')}
          options={[
            { value: 'system', label: t('settings.appearance_mode_system') },
            { value: 'dark', label: t('settings.appearance_mode_dark') },
            { value: 'light', label: t('settings.appearance_mode_light') },
          ]}
          parse={text(s.appearanceMode)}
          onSaved={(v) => s.setAppearanceMode(v as AppearanceMode)}
        />
        <AutoSelect
          stacked
          k="darkTheme"
          id="appearance.darkTheme"
          label={t('settings.dark_theme_label')}
          help={t('settings.dark_theme_description')}
          options={themes}
          parse={text(s.darkTheme)}
          onSaved={(v) => s.setDarkTheme(v as Theme)}
        />
        <AutoSelect
          stacked
          k="lightTheme"
          id="appearance.lightTheme"
          label={t('settings.light_theme_label')}
          help={t('settings.light_theme_description')}
          options={themes}
          parse={text(s.lightTheme)}
          onSaved={(v) => s.setLightTheme(v as Theme)}
        />
        {isAdmin && (
          <AutoSelect
            stacked
            k="defaultLandingPage"
            id="appearance.defaultLandingPage"
            label={t('settings.default_landing_page_label', 'Default Landing Page')}
            help={t('settings.default_landing_page_description', 'Page shown to users at the root URL. The Sources button always returns to the Unified view.')}
            options={[
              { value: 'unified', label: t('settings.default_landing_page_unified', 'Unified View (default)') },
              { value: 'unified-messages', label: t('settings.default_landing_page_unified_messages', 'Unified Messages') },
              { value: 'unified-telemetry', label: t('settings.default_landing_page_unified_telemetry', 'Unified Telemetry') },
              { value: 'map-analysis', label: t('settings.default_landing_page_map_analysis', 'Map Analysis') },
              { value: 'reports', label: t('settings.default_landing_page_reports', 'Reports') },
              ...sources.map((src) => ({ value: src.id, label: src.name })),
            ]}
            parse={text(s.defaultLandingPage)}
            onSaved={(v) => s.setDefaultLandingPage(v)}
          />
        )}
      </SettingGroup>

      <SettingGroup title={t('workspace.prefs.pins_lists')}>
        <AutoSelect
          stacked
          k="mapPinStyle"
          id="appearance.mapPinStyle"
          label={t('settings.map_pin_label')}
          help={t('settings.map_pin_description')}
          options={[
            { value: 'meshmonitor', label: t('settings.map_pin_meshmonitor') },
            { value: 'official', label: t('settings.map_pin_official') },
          ]}
          parse={text(s.mapPinStyle)}
          onSaved={(v) => s.setMapPinStyle(v as MapPinStyle)}
          // #5018: only the official circle has a colour to choose.
          render={(style) =>
            style === 'official' && (
              <AutoSelect
                stacked
                k="mapPinColorMode"
                id="appearance.mapPinColorMode"
                label={t('settings.map_pin_color_label', 'Official Pin Color')}
                help={t('settings.map_pin_color_description')}
                options={[
                  { value: 'node', label: t('settings.map_pin_color_node', 'Node Identity') },
                  { value: 'hops', label: t('settings.map_pin_color_hops', 'Hop Count') },
                ]}
                parse={text(s.mapPinColorMode)}
                onSaved={(v) => s.setMapPinColorMode(v as MapPinColorMode)}
              />
            )
          }
        />
        <AutoSelect
          stacked
          k="nodeListStyle"
          id="appearance.nodeListStyle"
          label={t('settings.node_list_style_label', 'Node List Style')}
          help={t('settings.node_list_style_description')}
          options={[
            { value: 'monochrome', label: t('settings.node_list_style_monochrome', 'Monochrome (Default)') },
            { value: 'meshtastic', label: t('settings.node_list_style_meshtastic', 'Meshtastic Colors') },
            { value: 'importance', label: t('settings.node_list_style_importance', 'Importance') },
          ]}
          parse={text(s.nodeListStyle)}
          onSaved={(v) => s.setNodeListStyle(v as NodeListStyle)}
        />
        <AutoSelect
          stacked
          segmented
          k="iconStyle"
          id="appearance.iconStyle"
          label={t('settings.icon_style_label', 'Icon Style')}
          help={t('settings.icon_style_description', 'Choose between modern Lucide icons or classic emoji icons throughout the interface.')}
          options={[
            { value: 'lucide', label: t('settings.icon_style_lucide', 'Lucide (Modern)') },
            { value: 'emoji', label: t('settings.icon_style_emoji', 'Emoji (Classic)') },
          ]}
          parse={text(s.iconStyle)}
          onSaved={(v) => s.setIconStyle(v as IconStyle)}
        />
      </SettingGroup>
    </>
  );
}

/** Tapback emojis (s13n2: they apply to all users; no admin gate today, the save needs settings:write). */
function TapbackCard() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const readOnly = useReadOnly();
  const e = useTapbackEmojiEditor();
  const [asking, setAsking] = useState(false);
  const off = readOnly || e.isSaving;
  const onKey = (ev: ReactKeyboardEvent) => {
    if (ev.key === 'Enter' && !e.isSaving) void e.handleAddEmoji();
  };

  return (
    <SettingGroup title={t('settings.tapback_emojis', 'Tapback Emojis')}>
      <div className={styles.pad}>
        <p className={styles.para}>{t('settings.tapback_emojis_description')}</p>
        <ul className={styles.chips}>
          {e.tapbackEmojis.map(({ emoji, title }) => (
            <li key={emoji} className={styles.chip} title={title}>
              <span>{emoji}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`${t('settings.tapback_remove_emoji', 'Remove emoji')} ${title}`}
                disabled={off}
                onClick={() => void e.handleRemoveEmoji(emoji)}
              >
                <UiIcon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <input
            className={`${styles.field} ${styles.emojiField}`}
            value={e.newEmoji}
            onChange={(ev) => e.setNewEmoji(ev.target.value)}
            onKeyDown={onKey}
            placeholder={t('settings.tapback_emoji_placeholder', 'Emoji')}
            aria-label={t('settings.tapback_emoji_placeholder', 'Emoji')}
            disabled={off}
          />
          <input
            className={`${styles.field} ${styles.titleField}`}
            value={e.newTitle}
            onChange={(ev) => e.setNewTitle(ev.target.value)}
            onKeyDown={onKey}
            placeholder={t('settings.tapback_title_placeholder', 'Title (optional)')}
            aria-label={t('settings.tapback_title_placeholder', 'Title (optional)')}
            disabled={off}
          />
          <button
            type="button"
            className={styles.button}
            data-phone={isPhone || undefined}
            disabled={off || !e.newEmoji.trim()}
            onClick={() => void e.handleAddEmoji()}
          >
            <UiIcon name="plus" size={16} />
            {t('settings.tapback_add_emoji', 'Add')}
          </button>
        </div>
        <button
          type="button"
          className={`${styles.button} ${styles.textButton}`}
          data-phone={isPhone || undefined}
          disabled={off}
          onClick={() => setAsking(true)}
        >
          {t('settings.tapback_reset_defaults', 'Reset to Defaults')}
        </button>
      </div>
      <ConfirmSheet
        open={asking}
        title={t('settings.tapback_reset_defaults', 'Reset to Defaults')}
        body={t('settings.tapback_confirm_reset')}
        confirmLabel={t('settings.tapback_reset_defaults', 'Reset to Defaults')}
        danger
        busy={e.isSaving}
        submitOnEnter={false}
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          await e.resetToDefaults();
          setAsking(false);
        }}
      />
    </SettingGroup>
  );
}

/** Phone (13-15): Custom themes is a row to its own page (s13n7). */
function ThemesLink() {
  const { t } = useTranslation();
  const { customThemes } = useCustomThemes();
  return (
    <SettingGroup>
      <Link to={THEMES_PATH} className={styles.rowLink} data-phone="">
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{t('theme_management.title')}</span>
          <span className={styles.rowSub}>{t('workspace.prefs.themes_count', { count: customThemes.length })}</span>
        </span>
        <UiIcon name="chevronRight" size={18} />
      </Link>
    </SettingGroup>
  );
}

/**
 * Today's custom theme list (CustomThemeManagement): Apply as Dark / Light,
 * Edit and Delete with themes:write (not on a built-in), Clone for all.
 */
export function CustomThemeList() {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const s = useSettings();
  const readOnly = useReadOnly();
  const { customThemes, canWrite, deleteTheme } = useCustomThemes();
  const [deleting, setDeleting] = useState<CustomTheme | null>(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark, darkStatus] = useAutosaveSetting<string>('darkTheme', {
    commit: 'change',
    parse: text(s.darkTheme),
    onSaved: (v) => s.setDarkTheme(v as Theme),
  });
  const [light, setLight, lightStatus] = useAutosaveSetting<string>('lightTheme', {
    commit: 'change',
    parse: text(s.lightTheme),
    onSaved: (v) => s.setLightTheme(v as Theme),
  });
  const error = darkStatus.error ?? lightStatus.error;

  return (
    <>
      <SettingGroup title={t('theme_management.title')}>
        {customThemes.length === 0 && (
          <div className={styles.pad}>
            <p className={styles.para}>{t('theme_management.no_themes')}</p>
          </div>
        )}
        {customThemes.map((theme) => {
          const isDark = dark === theme.slug;
          const isLight = light === theme.slug;
          const own = canWrite && !theme.is_builtin;
          return (
            <div key={theme.id} className={styles.themeRow} data-phone={isPhone || undefined}>
              <span className={styles.swatches} aria-hidden="true">
                {swatchesOf(theme.definition).map((color, i) => (
                  <span key={i} className={styles.swatch} style={{ background: color }} />
                ))}
              </span>
              <span className={styles.themeText}>
                <span className={styles.themeName}>{theme.name}</span>
                <span className={styles.themeSub}>
                  {theme.slug}
                  {theme.is_builtin === 1 && ` · ${t('theme_management.built_in')}`}
                </span>
              </span>
              <span className={styles.themeActions}>
                <button type="button" className={styles.button} data-phone={isPhone || undefined} disabled={isDark || readOnly} onClick={() => setDark(theme.slug)}>
                  {isDark ? t('theme_management.dark_active') : t('theme_management.apply_dark')}
                </button>
                <button type="button" className={styles.button} data-phone={isPhone || undefined} disabled={isLight || readOnly} onClick={() => setLight(theme.slug)}>
                  {isLight ? t('theme_management.light_active') : t('theme_management.apply_light')}
                </button>
                {own && (
                  <Link
                    to={`${THEMES_PATH}/${encodeURIComponent(theme.slug)}`}
                    className={styles.iconButton}
                    data-phone={isPhone || undefined}
                    aria-label={`${t('common.edit')} ${theme.name}`}
                    title={t('common.edit')}
                  >
                    <UiIcon name="edit" size={18} />
                  </Link>
                )}
                <ThemeMenu
                  name={theme.name}
                  onClone={() => navigate(`${THEMES_PATH}/new?from=${encodeURIComponent(theme.slug)}`)}
                  onDelete={own ? () => setDeleting(theme) : undefined}
                />
              </span>
            </div>
          );
        })}
        <div className={styles.foot}>
          <span className={styles.footText}>{t('workspace.prefs.needs_themes_write')}</span>
          {canWrite && (
            <Link to={`${THEMES_PATH}/new`} className={`${styles.button} ${styles.primary}`} data-phone={isPhone || undefined}>
              <UiIcon name="plus" size={16} />
              {t('theme_management.create_new')}
            </Link>
          )}
        </div>
      </SettingGroup>
      {error && <p className={styles.note} role="alert">{error}</p>}
      <p className={styles.note}>
        <UiIcon name="info" size={16} />
        <span>{t('workspace.prefs.themes_note')}</span>
      </p>
      <ConfirmSheet
        open={deleting !== null}
        title={deleting?.name ?? ''}
        body={t('theme_management.delete_confirm')}
        confirmLabel={t('common.delete')}
        danger
        busy={busy}
        submitOnEnter={false}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteTheme(deleting!.slug);
            setDeleting(null);
          } catch (err) {
            throw new Error(t('theme_management.delete_failed', { error: err instanceof Error ? err.message : String(err) }), { cause: err });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

/** A theme's ⋯: Clone, and Delete where the viewer may (s13n5). */
function ThemeMenu({ name, onClone, onDelete }: { name: string; onClone(): void; onDelete?: () => void }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const label = t('workspace.prefs.theme_actions', { name });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const then = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <span className={styles.menuWrap} ref={wrap}>
      <button
        type="button"
        className={styles.iconButton}
        data-phone={isPhone || undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <UiIcon name="more" size={18} />
      </button>
      {open && (
        <span className={styles.menu} role="menu" aria-label={label}>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={then(onClone)}>
            <UiIcon name="copy" size={16} />
            {t('theme_management.clone')}
          </button>
          {onDelete && (
            <button type="button" role="menuitem" className={styles.menuItem} data-danger="" onClick={then(onDelete)}>
              <UiIcon name="delete" size={16} />
              {t('common.delete')}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
