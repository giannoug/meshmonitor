/**
 * You › Appearance › Custom themes › Edit theme (boards 13-02 desktop, 13-19
 * phone; Task 6.3): today's ThemeEditor (useThemeEditor) redrawn on a page.
 *
 * - `/preferences/appearance/themes/new` creates from the current theme (as
 *   Create New Theme), `…/new?from=<slug>` clones a custom theme, and
 *   `…/<slug>` edits one.
 * - Visual and JSON editors edit one colour map; JSON shows today's
 *   validation errors inline. Import validates the file; Export downloads it.
 * - Name, slug, the accessibility report and a preview of the colours.
 * - Update theme / Create theme is today's PUT / POST /api/themes, which needs
 *   themes:write (s13n1: a form that saves a record keeps its button). A
 *   failure shows today's words on the page instead of an alert. Cancel and a
 *   save go back to Appearance.
 */
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../../../components/icons';
import { COLOR_GROUPS, COLOR_LABELS, OPTIONAL_COLOR_GROUPS, useThemeEditor } from '../../../components/themes/useThemeEditor';
import { useCustomThemes } from '../../../components/themes/useCustomThemes';
import { useSettings, type BuiltInTheme, type CustomTheme } from '../../../contexts/SettingsContext';
import { generateThemeSlug } from '../../../utils/themeValidation';
import StateView from '../../patterns/StateView';
import SettingSegmented from '../../settings/kit/SettingSegmented';
import { useIsPhone } from '../../shell/useIsPhone';
import PrefsFrame from './PrefsFrame';
import { THEMES_PATH } from './AppearancePage';
import styles from './Preferences.module.css';
import ed from './ThemeEditorPage.module.css';

const APPEARANCE = '/preferences/appearance';

export default function ThemeEditorPage() {
  const { t } = useTranslation();
  const { slug = 'new' } = useParams();
  const [search] = useSearchParams();
  const s = useSettings();
  const { customThemes } = useCustomThemes();
  const from = search.get('from');
  const editing = slug === 'new' ? null : customThemes.find((c) => c.slug === slug) ?? null;
  const cloneOf = from ? customThemes.find((c) => c.slug === from) ?? null : null;
  const missing = (slug !== 'new' && !editing) || (!!from && !cloneOf);

  const title = editing ? t('theme_editor.edit_title') : t('theme_editor.create_title');
  if (missing) {
    return (
      <PrefsFrame categoryId="theme-editor" title={title} icon="sun" readOnly={false} needsSettings={false} back={{ label: t('settings.appearance'), to: APPEARANCE }}>
        <StateView kind={s.isLoadingThemes ? 'loading' : 'notFound'} />
      </PrefsFrame>
    );
  }
  // Create New Theme starts from the current theme, Clone from the custom one (CustomThemeManagement).
  return <Editor key={`${slug}:${from ?? ''}`} theme={editing} baseTheme={cloneOf ?? (s.theme as BuiltInTheme)} title={title} />;
}

function Editor({ theme, baseTheme, title }: { theme: CustomTheme | null; baseTheme: BuiltInTheme | CustomTheme; title: string }) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const { saveTheme } = useCustomThemes();
  const [error, setError] = useState<string | null>(null);
  const e = useThemeEditor({
    theme,
    baseTheme,
    onSave: async (name, slug, definition) => {
      setError(null);
      await saveTheme(theme, name, slug, definition);
      void navigate(APPEARANCE);
    },
    report: setError,
  });
  const saveLabel = theme ? t('theme_editor.update_theme') : t('theme_editor.create_theme');
  const slug = theme?.slug || (e.name.trim() ? generateThemeSlug(e.name) : '');
  const report = e.accessibilityReport;

  const importExport = (
    <span className={ed.headActions}>
      <button type="button" className={styles.button} data-phone={isPhone || undefined} onClick={e.handleImport}>
        <UiIcon name="upload" size={16} />
        {t('theme_editor.import')}
      </button>
      <button type="button" className={styles.button} data-phone={isPhone || undefined} onClick={e.handleExport} disabled={!e.name.trim()}>
        <UiIcon name="download" size={16} />
        {t('theme_editor.export')}
      </button>
    </span>
  );

  const swatch = (key: string, label: string, value: string) => (
    <label key={key} className={ed.swatchCard}>
      <input
        type="color"
        className={ed.colorInput}
        value={value}
        onChange={(ev) => e.handleColorChange(key, ev.target.value)}
        aria-label={label}
      />
      <span className={ed.swatchText}>
        <span className={ed.swatchLabel}>{label}</span>
        <input
          className={`${ed.hex} ${styles.mono}`}
          value={value}
          onChange={(ev) => e.handleColorChange(key, ev.target.value)}
          aria-label={`${label} hex`}
          pattern="^#[0-9A-Fa-f]{6}$"
          placeholder="#000000"
          spellCheck={false}
        />
      </span>
    </label>
  );

  return (
    <PrefsFrame
      categoryId="theme-editor"
      title={title}
      icon="sun"
      scope={t('workspace.prefs.theme_scope')}
      readOnly={false}
      needsSettings={false}
      crumb={`${t('settings.appearance')} › ${t('theme_management.title')} ›`}
      back={{ label: t('settings.appearance'), to: isPhone ? THEMES_PATH : APPEARANCE }}
      actions={!isPhone && importExport}
    >
      <div className={ed.layout} data-phone={isPhone || undefined}>
        <div className={ed.main}>
          <div className={ed.meta}>
            <label className={ed.metaField}>
              <span className={ed.metaLabel}>{t('theme_editor.theme_name')}</span>
              <input
                className={styles.field}
                value={e.name}
                onChange={(ev) => e.setName(ev.target.value)}
                placeholder={t('theme_editor.name_placeholder')}
                maxLength={50}
              />
            </label>
            <label className={ed.metaField}>
              <span className={ed.metaLabel}>{t('theme_editor.slug')}</span>
              <input className={`${styles.field} ${styles.mono}`} value={slug} readOnly />
            </label>
          </div>

          <div className={ed.modeRow}>
            <SettingSegmented
              label={t('workspace.prefs.editor_mode')}
              value={e.mode}
              onChange={(m) => e.setMode(m as 'visual' | 'json')}
              options={[
                { value: 'visual', label: t('theme_editor.visual_editor') },
                { value: 'json', label: t('theme_editor.json_editor') },
              ]}
            />
            {isPhone ? importExport : <span className={ed.modeNote}>{t('workspace.prefs.editor_mode_note')}</span>}
          </div>

          {e.mode === 'visual' ? (
            <>
              {COLOR_GROUPS.map((group) => (
                <section key={group.name} className={ed.group}>
                  <h2 className={ed.groupTitle}>{group.name}</h2>
                  <p className={ed.groupHelp}>{group.description}</p>
                  <div className={ed.grid}>
                    {group.colors.map((key) => swatch(key, COLOR_LABELS[key] ?? key, e.colors[key] || '#000000'))}
                  </div>
                </section>
              ))}
              {OPTIONAL_COLOR_GROUPS.map((group) => (
                <section key={group.name} className={ed.group}>
                  <h2 className={ed.groupTitle}>{group.name}</h2>
                  <p className={ed.groupHelp}>{group.description}</p>
                  <div className={ed.grid}>
                    {group.colors.map((c) => {
                      const on = c.key in e.colors;
                      const fallback = e.colors[c.fallback] || '#000000';
                      return (
                        <div key={c.key} className={ed.optional}>
                          <label className={ed.check}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(ev) => {
                                if (ev.target.checked) e.handleColorChange(c.key, fallback);
                                else
                                  e.setColors((prev) => {
                                    const next = { ...prev };
                                    delete next[c.key];
                                    return next;
                                  });
                              }}
                            />
                            {c.label}
                          </label>
                          {on && swatch(c.key, c.label, e.colors[c.key] || fallback)}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <div className={ed.group}>
              <textarea
                className={`${ed.json} ${styles.mono}`}
                value={e.jsonValue}
                onChange={(ev) => e.handleJsonChange(ev.target.value)}
                spellCheck={false}
                aria-label={t('theme_editor.json_editor')}
              />
              {e.jsonError && <p className={ed.error} role="alert">{e.jsonError}</p>}
            </div>
          )}

          {e.validationErrors.length > 0 && (
            <div className={ed.errors} role="alert">
              <h2 className={ed.groupTitle}>{t('theme_editor.validation_errors')}</h2>
              <ul className={ed.list}>
                {e.validationErrors.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </div>
          )}
        </div>

        <aside className={ed.side}>
          {report && (
            <section className={ed.card}>
              <h2 className={ed.cardTitle}>{t('theme_editor.accessibility_check')}</h2>
              <p className={ed.counts}>
                <span className={ed.count} data-tone={report.criticalIssues.length ? 'bad' : 'good'}>
                  {t('theme_editor.critical_issues')} {report.criticalIssues.length}
                </span>
                <span className={ed.count} data-tone={report.warnings.length ? 'warn' : 'good'}>
                  {t('theme_editor.warnings')} {report.warnings.length}
                </span>
                <span className={ed.count}>
                  {t('theme_editor.recommendations')} {report.recommendations.length}
                </span>
              </p>
              <ul className={ed.issues}>
                {report.criticalIssues.map((m, i) => (
                  <li key={`c${i}`}><UiIcon name="error" size={16} /><span>{m}</span></li>
                ))}
                {report.warnings.map((m, i) => (
                  <li key={`w${i}`}><UiIcon name="alert" size={16} /><span>{m}</span></li>
                ))}
                {report.recommendations.map((m, i) => (
                  <li key={`r${i}`}><UiIcon name="info" size={16} /><span>{m}</span></li>
                ))}
              </ul>
            </section>
          )}
          <section className={ed.card}>
            <h2 className={ed.groupTitle}>{t('workspace.prefs.preview')}</h2>
            {/* The theme's own colours, so they are data, not tokens. */}
            <div className={ed.preview} style={{ background: e.colors.bgSunken, borderColor: e.colors.border }} aria-hidden="true">
              <span className={ed.previewSide} style={{ background: e.colors.surface }} />
              <span className={ed.previewBody}>
                <span className={ed.previewLine} style={{ background: e.colors.text }} />
                <span className={ed.previewLine} data-short="" style={{ background: e.colors.textSubtle }} />
                <span className={ed.previewButtons}>
                  <span className={ed.previewButton} style={{ background: e.colors.accent }} />
                  <span className={ed.previewButton} style={{ background: e.colors.surfaceHover }} />
                </span>
              </span>
            </div>
          </section>
        </aside>
      </div>

      <div className={ed.dock} data-phone={isPhone || undefined}>
        <span className={ed.dockText}>{t('workspace.prefs.theme_dock', { action: saveLabel })}</span>
        {error && <span className={ed.error} role="alert">{error}</span>}
        <span className={ed.dockButtons}>
          <button type="button" className={styles.button} data-phone={isPhone || undefined} onClick={() => void navigate(APPEARANCE)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            data-phone={isPhone || undefined}
            disabled={!e.canSave || e.isSaving}
            onClick={() => void e.handleSave()}
          >
            {e.isSaving ? t('common.saving') : saveLabel}
          </button>
        </span>
      </div>
    </PrefsFrame>
  );
}
