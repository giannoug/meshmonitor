/**
 * The custom theme editor's state and actions, moved out of ThemeEditor
 * unchanged (Rule X) so the Workspace editor page (#6365) runs the same
 * steps: the colour map, the JSON view with its validation, the
 * accessibility report, Import, Export and Save. `report` is where a failure
 * is said; ThemeEditor passes `alert`, as before.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { validateThemeDefinition, generateThemeSlug } from '../../utils/themeValidation';
import { validateThemeAccessibility, type AccessibilityReport } from '../../utils/accessibilityChecker';
import type { CustomTheme, BuiltInTheme } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';

export type EditorMode = 'visual' | 'json';

export const COLOR_GROUPS = [
  {
    name: 'Backgrounds',
    colors: ['bg', 'bgRaised', 'bgSunken'] as const,
    description: 'Page background, and the layers behind and beneath it'
  },
  {
    name: 'Surfaces',
    colors: ['surface', 'surfaceHover', 'surfaceActive', 'surfaceInactive'] as const,
    description: 'Cards and panels; the last is the neutral "nothing happening" fill'
  },
  {
    name: 'Text',
    colors: ['text', 'textMuted', 'textSubtle', 'textDisabled', 'textFaint'] as const,
    description: 'Highest to lowest emphasis'
  },
  {
    name: 'Lines',
    colors: ['border', 'borderStrong', 'borderSubtle'] as const,
    description: 'Dividers and outlines'
  },
  {
    name: 'Accent',
    colors: ['accent', 'accentHover', 'accentAlt', 'accentMuted', 'accentText'] as const,
    description: 'Primary interactive color; the last is text painted ON an accent fill'
  },
  {
    name: 'Status',
    colors: ['success', 'error', 'warning', 'caution', 'info', 'danger'] as const,
    description: 'Feedback colors. Caution is one step below warning'
  }
];

/** Human labels — the keys are roles, but "bgRaised" is not a caption. */
export const COLOR_LABELS: Record<string, string> = {
  bg: 'Background', bgRaised: 'Raised background', bgSunken: 'Sunken background',
  surface: 'Surface', surfaceHover: 'Surface (hover)',
  surfaceActive: 'Surface (active)', surfaceInactive: 'Surface (inactive)',
  text: 'Text', textMuted: 'Muted text', textSubtle: 'Subtle text',
  textDisabled: 'Disabled text', textFaint: 'Faint text',
  border: 'Border', borderStrong: 'Strong border', borderSubtle: 'Subtle border',
  accent: 'Accent', accentHover: 'Accent (hover)', accentAlt: 'Alternate accent',
  accentMuted: 'Muted accent', accentText: 'Text on accent',
  success: 'Success', error: 'Error', warning: 'Warning',
  caution: 'Caution', info: 'Info', danger: 'Danger'
};

export const OPTIONAL_COLOR_GROUPS = [
  {
    name: 'Chat Bubble Colors',
    description: 'Override chat bubble colors independently from accent colors',
    colors: [
      { key: 'chatBubbleSentBg', label: 'Sent Background', fallback: 'accent' },
      { key: 'chatBubbleSentText', label: 'Sent Text', fallback: 'accentText' },
      { key: 'chatBubbleReceivedBg', label: 'Received Background', fallback: 'surfaceHover' },
      { key: 'chatBubbleReceivedText', label: 'Received Text', fallback: 'text' }
    ]
  }
];

export interface UseThemeEditorOptions {
  theme?: CustomTheme | null;
  baseTheme?: BuiltInTheme | CustomTheme;
  onSave: (name: string, slug: string, definition: Record<string, string>) => Promise<void>;
  /** Says a failure or a missing field (ThemeEditor: `alert`). */
  report: (message: string) => void;
}

export function useThemeEditor({ theme, baseTheme, onSave, report }: UseThemeEditorOptions) {
  const { t } = useTranslation();
  const { authStatus } = useAuth();

  const [name, setName] = useState(theme?.name || '');
  const [mode, setMode] = useState<EditorMode>('visual');
  const [colors, setColors] = useState<Record<string, string>>(() => {
    if (theme) {
      try {
        return JSON.parse(theme.definition);
      } catch {
        return getDefaultColors();
      }
    }
    if (baseTheme) {
      if (typeof baseTheme === 'string') {
        // Built-in theme - extract colors from CSS
        return getColorsFromBuiltInTheme(baseTheme);
      } else {
        // Custom theme
        try {
          return JSON.parse(baseTheme.definition);
        } catch {
          return getDefaultColors();
        }
      }
    }
    return getDefaultColors();
  });

  const [jsonValue, setJsonValue] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [accessibilityReport, setAccessibilityReport] = useState<AccessibilityReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync JSON value with colors
  useEffect(() => {
    if (mode === 'json') {
      setJsonValue(JSON.stringify(colors, null, 2));
    }
  }, [colors, mode]);

  // Validate theme whenever colors change
  useEffect(() => {
    const validation = validateThemeDefinition(colors);
    setValidationErrors(validation.errors);

    if (validation.isValid) {
      const accessibility = validateThemeAccessibility(colors as unknown as Parameters<typeof validateThemeAccessibility>[0]);
      setAccessibilityReport(accessibility);
    }
  }, [colors]);

  const handleColorChange = useCallback((colorKey: string, value: string) => {
    setColors(prev => ({
      ...prev,
      [colorKey]: value
    }));
  }, []);

  const handleJsonChange = useCallback((value: string) => {
    setJsonValue(value);
    setJsonError(null);

    try {
      const parsed = JSON.parse(value);
      const validation = validateThemeDefinition(parsed);

      if (validation.isValid) {
        setColors(parsed);
        setJsonError(null);
      } else {
        setJsonError(validation.errors.join(', '));
      }
    } catch (error) {
      setJsonError(`Invalid JSON: ${(error as Error).message}`);
    }
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      report(t('theme_editor.enter_name'));
      return;
    }

    const validation = validateThemeDefinition(colors);
    if (!validation.isValid) {
      report(t('theme_editor.validation_failed', { errors: validation.errors.join('\n') }));
      return;
    }

    setIsSaving(true);
    try {
      const slug = theme?.slug || generateThemeSlug(name);
      await onSave(name.trim(), slug, colors);
    } catch (error) {
      report(t('theme_editor.save_failed', { error: (error as Error).message }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);

        if (imported.name) setName(imported.name);
        if (imported.definition) {
          const def = typeof imported.definition === 'string'
            ? JSON.parse(imported.definition)
            : imported.definition;

          const validation = validateThemeDefinition(def);
          if (validation.isValid) {
            setColors(def);
          } else {
            report(t('theme_editor.invalid_file', { errors: validation.errors.join('\n') }));
          }
        }
      } catch (error) {
        report(t('theme_editor.import_failed', { error: (error as Error).message }));
      }
    };
    input.click();
  };

  const handleExport = () => {
    const exportData = {
      name,
      slug: theme?.slug || generateThemeSlug(name),
      definition: colors
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportData.slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canSave = authStatus?.permissions?.global?.themes?.write && validationErrors.length === 0 && name.trim().length > 0;

  return {
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
  };
}

/**
 * Get default color values (mocha theme)
 */
function getDefaultColors(): Record<string, string> {
  return {
    base: '#1e1e2e',
    mantle: '#181825',
    crust: '#11111b',
    text: '#cdd6f4',
    subtext1: '#bac2de',
    subtext0: '#a6adc8',
    overlay2: '#9399b2',
    overlay1: '#7f849c',
    overlay0: '#6c7086',
    surface2: '#585b70',
    surface1: '#45475a',
    surface0: '#313244',
    lavender: '#b4befe',
    blue: '#89b4fa',
    sapphire: '#74c7ec',
    sky: '#89dceb',
    teal: '#94e2d5',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    peach: '#fab387',
    maroon: '#eba0ac',
    red: '#f38ba8',
    mauve: '#cba6f7',
    pink: '#f5c2e7',
    flamingo: '#f2cdcd',
    rosewater: '#f5e0dc'
  };
}

/**
 * Extract colors from a built-in theme
 * This is a simplified version - in reality you'd read from computed styles
 */
function getColorsFromBuiltInTheme(_themeName: string): Record<string, string> {
  // For now, return default colors
  // In a real implementation, you'd extract these from CSS or have predefined values
  return getDefaultColors();
}
