/**
 * The user's pinned settings categories (Task 5.4): category ids in the
 * `settings.pins` preference, so a pin follows the user to every device that
 * has the category (spec: pins are per category, not per device).
 */
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreference } from '../prefs/useUserPreferences';

export function usePins(): { pins: string[]; canPin: boolean; toggle(id: string): void } {
  const { authStatus } = useAuth();
  const [stored, save] = useUserPreference<string[]>('settings.pins', []);
  const pins = Array.isArray(stored) ? stored : [];
  return {
    pins,
    // Anonymous viewers have no preferences to write (the server answers 403).
    canPin: authStatus?.authenticated === true,
    // A failed write rolls the optimistic pin back, so the ☆ shows it did not stick (as AdvancedCard).
    toggle: (id) => void save(pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id]).catch(() => {}),
  };
}
