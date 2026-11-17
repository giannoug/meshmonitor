/**
 * Custom themes: the list, the themes:write gate, and Save and Delete as
 * CustomThemeManagement ran them, moved out unchanged (Rule X) for the
 * Workspace Appearance pages (#6365). The confirm before a delete stays with
 * the caller (Classic: `window.confirm`; Workspace: ConfirmSheet).
 */
import { useSettings, type CustomTheme } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export function useCustomThemes() {
  const { customThemes, loadCustomThemes, darkTheme, lightTheme, setDarkTheme, setLightTheme } = useSettings();
  const { authStatus } = useAuth();

  const canWrite = authStatus?.permissions?.global?.themes?.write || false;

  /** Creates the theme, or updates `editing`, then reloads the list. */
  const saveTheme = async (editing: CustomTheme | null, name: string, slug: string, definition: Record<string, string>) => {
    const body = { name, slug, definition };

    if (editing) {
      await api.put(`/api/themes/${editing.slug}`, body);
    } else {
      await api.post('/api/themes', body);
    }

    // Reload themes
    await loadCustomThemes();
  };

  /** Deletes the theme on the server; a failure throws before anything else changes. */
  const deleteTheme = async (themeSlug: string) => {
    await api.delete(`/api/themes/${themeSlug}`);
  };

  /** After a delete: moves the theme's slots back to the defaults (context only, as before), reloads the list. */
  const forgetTheme = async (themeSlug: string) => {
    if (darkTheme === themeSlug) {
      setDarkTheme('mocha');
    }
    if (lightTheme === themeSlug) {
      setLightTheme('latte');
    }

    // Reload themes
    await loadCustomThemes();
  };

  return { customThemes, canWrite, saveTheme, deleteTheme, forgetTheme };
}
