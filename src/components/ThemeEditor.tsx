import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomTheme, BuiltInTheme } from '../contexts/SettingsContext';
import { COLOR_GROUPS, COLOR_LABELS, OPTIONAL_COLOR_GROUPS, useThemeEditor } from './themes/useThemeEditor';
import './ThemeEditor.css';

interface ThemeEditorProps {
  theme?: CustomTheme | null;
  baseTheme?: BuiltInTheme | CustomTheme;
  onSave: (name: string, slug: string, definition: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

export const ThemeEditor: React.FC<ThemeEditorProps> = ({
  theme,
  baseTheme,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation();
  const {
    name,
    setName,
    mode,
    setMode,
    colors,
    setColors,
    handleColorChange,
    jsonValue,
    jsonError,
    handleJsonChange,
    validationErrors,
    accessibilityReport,
    isSaving,
    handleSave,
    handleImport,
    handleExport,
    canSave,
  } = useThemeEditor({ theme, baseTheme, onSave, report: (message) => alert(message) });

  return (
    <div className="theme-editor">
      <div className="theme-editor-header">
        <h2>{theme ? t('theme_editor.edit_title') : t('theme_editor.create_title')}</h2>

        <div className="theme-editor-actions">
          <button onClick={handleImport} className="btn-secondary">
            {t('theme_editor.import')}
          </button>
          <button onClick={handleExport} className="btn-secondary" disabled={!name.trim()}>
            {t('theme_editor.export')}
          </button>
        </div>
      </div>

      <div className="theme-editor-metadata">
        <div className="form-group">
          <label htmlFor="theme-name">{t('theme_editor.theme_name')}</label>
          <input
            id="theme-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('theme_editor.name_placeholder')}
            maxLength={50}
            className="form-control"
          />
          {theme?.slug && (
            <small className="form-text">{t('theme_editor.slug')}: {theme.slug}</small>
          )}
        </div>
      </div>

      <div className="theme-editor-mode-switch">
        <button
          className={`mode-btn ${mode === 'visual' ? 'active' : ''}`}
          onClick={() => setMode('visual')}
        >
          {t('theme_editor.visual_editor')}
        </button>
        <button
          className={`mode-btn ${mode === 'json' ? 'active' : ''}`}
          onClick={() => setMode('json')}
        >
          {t('theme_editor.json_editor')}
        </button>
      </div>

      {mode === 'visual' ? (
        <div className="theme-editor-visual">
          {COLOR_GROUPS.map((group) => (
            <div key={group.name} className="color-group">
              <h3>{group.name}</h3>
              <p className="color-group-description">{group.description}</p>
              <div className="color-grid">
                {group.colors.map((colorKey) => (
                  <div key={colorKey} className="color-picker-item">
                    <label htmlFor={`color-${colorKey}`}>{COLOR_LABELS[colorKey] ?? colorKey}</label>
                    <div className="color-input-wrapper">
                      <input
                        id={`color-${colorKey}`}
                        type="color"
                        value={colors[colorKey] || '#000000'}
                        onChange={(e) => handleColorChange(colorKey, e.target.value)}
                        className="color-picker"
                      />
                      <input
                        type="text"
                        value={colors[colorKey] || '#000000'}
                        onChange={(e) => handleColorChange(colorKey, e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                        className="color-hex-input"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {OPTIONAL_COLOR_GROUPS.map((group) => (
            <div key={group.name} className="color-group">
              <h3>{group.name}</h3>
              <p className="color-group-description">{group.description}</p>
              <div className="color-grid">
                {group.colors.map((colorDef) => {
                  const isEnabled = colorDef.key in colors;
                  const fallbackValue = colors[colorDef.fallback] || '#000000';
                  return (
                    <div key={colorDef.key} className="color-picker-item">
                      <label htmlFor={`color-${colorDef.key}`}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleColorChange(colorDef.key, fallbackValue);
                            } else {
                              setColors(prev => {
                                const next = { ...prev };
                                delete next[colorDef.key];
                                return next;
                              });
                            }
                          }}
                          style={{ marginRight: '6px' }}
                        />
                        {colorDef.label}
                      </label>
                      {isEnabled && (
                        <div className="color-input-wrapper">
                          <input
                            id={`color-${colorDef.key}`}
                            type="color"
                            value={colors[colorDef.key] || fallbackValue}
                            onChange={(e) => handleColorChange(colorDef.key, e.target.value)}
                            className="color-picker"
                          />
                          <input
                            type="text"
                            value={colors[colorDef.key] || fallbackValue}
                            onChange={(e) => handleColorChange(colorDef.key, e.target.value)}
                            pattern="^#[0-9A-Fa-f]{6}$"
                            className="color-hex-input"
                            placeholder="#000000"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="theme-editor-json">
          <textarea
            value={jsonValue}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="json-editor-textarea"
            spellCheck={false}
            placeholder='{\n  "base": "#1e1e2e",\n  "text": "#cdd6f4",\n  ...\n}'
          />
          {jsonError && (
            <div className="json-error">{jsonError}</div>
          )}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="theme-validation-errors">
          <h4>{t('theme_editor.validation_errors')}:</h4>
          <ul>
            {validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {accessibilityReport && (
        <div className={`theme-accessibility-report ${accessibilityReport.isAccessible ? 'success' : 'warning'}`}>
          <h4>{t('theme_editor.accessibility_check')}</h4>

          {accessibilityReport.criticalIssues.length > 0 && (
            <div className="critical-issues">
              <strong>{t('theme_editor.critical_issues')}:</strong>
              <ul>
                {accessibilityReport.criticalIssues.map((issue: string, i: number) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {accessibilityReport.warnings.length > 0 && (
            <div className="warnings">
              <strong>{t('theme_editor.warnings')}:</strong>
              <ul>
                {accessibilityReport.warnings.map((warning: string, i: number) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {accessibilityReport.recommendations.length > 0 && (
            <div className="recommendations">
              <strong>{t('theme_editor.recommendations')}:</strong>
              <ul>
                {accessibilityReport.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="theme-editor-footer">
        <button onClick={onCancel} className="btn-secondary">
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          className="btn-primary"
          disabled={!canSave || isSaving}
        >
          {isSaving ? t('common.saving') : theme ? t('theme_editor.update_theme') : t('theme_editor.create_theme')}
        </button>
      </div>
    </div>
  );
};
