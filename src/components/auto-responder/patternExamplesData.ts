/**
 * The pattern examples' data (PatternExamples), moved as is so the Workspace
 * responder shows the same gallery (Task 8.3, Rule X). Patterns are literal
 * syntax and stay in code; descriptions are translation keys.
 */
/** Clickable command cards: [pattern, description key]. */
export const COMMAND_EXAMPLES: Array<[string, string]> = [
  ['weather, weather {location}, w {location}', 'examples_weather_command'],
  ['status, status {nodeid}', 'examples_status_command'],
  ['ping', 'examples_ping_command'],
  ['help, help {topic}', 'examples_help_command'],
];

export interface PatternExample {
  pattern: string;
  descKey: string;
  /** Interpolation values for literals inside the description. */
  values?: Record<string, string>;
  titleKey?: string;
}

export const PATTERN_GROUPS: Array<{ titleKey: string; items: PatternExample[] }> = [
  {
    titleKey: 'examples_group_node',
    items: [
      { pattern: 'node {nodeid:![a-f0-9]+}', descKey: 'examples_node_id', values: { example: '!a1b2c3d4' } },
      { pattern: 'node {nodenum:\\d+}', descKey: 'examples_node_number' },
      { pattern: 'channel {ch:\\d}', descKey: 'examples_channel_number' },
      { pattern: 'temp {value:\\d+}', descKey: 'examples_temperature' },
    ],
  },
  {
    titleKey: 'examples_group_location',
    items: [
      // Space, not comma, between the two: a top-level comma separates
      // patterns, so "{lat},{lon}" inserted as two patterns.
      { pattern: 'loc {lat:-?\\d+\\.?\\d*} {lon:-?\\d+\\.?\\d*}', descKey: 'examples_lat_lon' },
      { pattern: 'grid {square:[A-R]{2}\\d{2}[a-x]{2}}', descKey: 'examples_grid_square' },
      { pattern: 'zip {code:\\d{5}}', descKey: 'examples_zip_code' },
      { pattern: 'weather {location}', descKey: 'examples_location_name' },
    ],
  },
  {
    titleKey: 'examples_group_time',
    items: [
      { pattern: 'time', descKey: 'examples_current_time', values: { env: 'TZ' }, titleKey: 'examples_click_to_use_time' },
      { pattern: 'date', descKey: 'examples_current_date' },
    ],
  },
  {
    titleKey: 'examples_group_text',
    items: [
      { pattern: 'msg {text:[\\w\\s]+}', descKey: 'examples_multiple_words' },
      { pattern: 'say {text:.+}', descKey: 'examples_any_text' },
      { pattern: 'alert {message}', descKey: 'examples_alert_message' },
      { pattern: 'log {data:[a-zA-Z0-9]+}', descKey: 'examples_alphanumeric' },
    ],
  },
  {
    titleKey: 'examples_group_numeric',
    items: [
      { pattern: 'set {value:-?\\d+}', descKey: 'examples_signed_integer' },
      { pattern: 'battery {level:\\d{1,3}}', descKey: 'examples_battery_level' },
      { pattern: 'rssi {dbm:-?\\d+}', descKey: 'examples_rssi' },
      { pattern: 'snr {value:-?\\d+}', descKey: 'examples_snr' },
    ],
  },
];

