import type { OverlayColors } from '../../config/overlayColors';
import type { ThemeColors } from '../../hooks/useTraceroutePaths';

/** Leaflet polylines take colours, not CSS variables: read the theme's, as App does. */
export function themeColors(overlay: OverlayColors): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    accentAlt: v('--color-accent-alt'),
    error: v('--color-error'),
    accent: v('--color-accent'),
    faint: v('--color-text-faint'),
    tracerouteForward: overlay.tracerouteForward,
    tracerouteReturn: overlay.tracerouteReturn,
    mqttSegment: overlay.mqttSegment,
    neighborLine: overlay.neighborLine,
    snrColors: overlay.snrColors,
  };
}
