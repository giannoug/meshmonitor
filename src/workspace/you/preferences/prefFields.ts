/**
 * Every setting row on the You › Preferences pages (Task 6.3), for settings
 * search (s13n0: it searches every You category). A hit opens the page at
 * the row's `#setting-<id>` anchor, where the row scrolls into view and
 * pulses. Labels are the rows' own keys; `prefFields.test.tsx` holds this
 * list to the rows each page draws.
 */
export interface PrefField {
  id: string;
  /** The page under `/preferences/`. */
  page: 'language' | 'appearance' | 'map';
  labelKey: string;
  fallback?: string;
  adminOnly?: boolean;
}

/** Each page's title key, for a hit's "Preferences › …" line. */
export const PREF_PAGE_LABELS: Record<PrefField['page'], [string, string?]> = {
  language: ['workspace.you.language_units'],
  appearance: ['settings.appearance'],
  map: ['settings.map'],
};

export const PREF_FIELDS: PrefField[] = [
  { id: 'language.language', page: 'language', labelKey: 'settings.language' },
  { id: 'units.timeFormat', page: 'language', labelKey: 'settings.time_format_label' },
  { id: 'units.dateFormat', page: 'language', labelKey: 'settings.date_format_label' },
  { id: 'units.temperatureUnit', page: 'language', labelKey: 'settings.temp_unit_label' },
  { id: 'units.distanceUnit', page: 'language', labelKey: 'settings.dist_unit_label' },
  { id: 'sorting.preferredSortField', page: 'language', labelKey: 'settings.sort_field_label' },
  { id: 'sorting.preferredSortDirection', page: 'language', labelKey: 'settings.sort_direction_label' },
  { id: 'sorting.preferredDashboardSortOption', page: 'language', labelKey: 'settings.dashboard_sort_label' },
  { id: 'link-previews.linkPreviewsEnabled', page: 'language', labelKey: 'settings.link_previews_enabled', fallback: 'Show link previews' },
  { id: 'appearance.appearanceMode', page: 'appearance', labelKey: 'settings.appearance_mode_label' },
  { id: 'appearance.darkTheme', page: 'appearance', labelKey: 'settings.dark_theme_label' },
  { id: 'appearance.lightTheme', page: 'appearance', labelKey: 'settings.light_theme_label' },
  { id: 'appearance.mapPinStyle', page: 'appearance', labelKey: 'settings.map_pin_label' },
  { id: 'appearance.mapPinColorMode', page: 'appearance', labelKey: 'settings.map_pin_color_label', fallback: 'Official Pin Color' },
  { id: 'appearance.nodeListStyle', page: 'appearance', labelKey: 'settings.node_list_style_label', fallback: 'Node List Style' },
  { id: 'appearance.iconStyle', page: 'appearance', labelKey: 'settings.icon_style_label', fallback: 'Icon Style' },
  { id: 'map.mapTilesetDark', page: 'map', labelKey: 'settings.map_tileset_dark_label' },
  { id: 'map.mapTilesetLight', page: 'map', labelKey: 'settings.map_tileset_light_label' },
  { id: 'map.positionHistoryLineStyle', page: 'map', labelKey: 'settings.position_history_line_style_label' },
  { id: 'map.neighborInfoMinZoom', page: 'map', labelKey: 'settings.neighbor_info_min_zoom_label' },
  { id: 'map.mapCenterTargetZoom', page: 'map', labelKey: 'settings.map_center_target_zoom_label' },
  { id: 'map.mapZoomGateThreshold', page: 'map', labelKey: 'settings.map_zoom_gate_threshold_label' },
  { id: 'map.mapClusteringEnabled', page: 'map', labelKey: 'settings.map_clustering_enabled_label' },
  { id: 'map.discardInvalidPositions', page: 'map', labelKey: 'settings.discard_invalid_positions', fallback: 'Discard invalid positions' },
];
