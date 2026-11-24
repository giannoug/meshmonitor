/**
 * Workspace-only paths and the Classic page each one lands on, so a Classic
 * user following a Workspace link (or a Workspace user who switched back) never
 * sees the dashboard catch-all by accident. Paths are router-relative: the
 * basename is already stripped.
 */
const RULES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^\/overview(\/map)?\/?$/, () => '/'],
  [/^\/overview\/analysis\/?$/, () => '/analysis'],
  [/^\/overview\/reports(\/.*)?$/, () => '/reports'],
  [/^\/reports\/.+$/, () => '/reports'],
  [/^\/overview\/(messages|telemetry|packets)\/?$/, (m) => `/unified/${m[1]}`],
  [/^\/overview\/messages\/export\/?$/, () => '/unified/messages'],
  [/^\/overview\/automations(\/.*)?$/, () => '/automations'],
  [/^\/overview\/users\/?$/, () => '/users'],
  [/^\/overview\/(audit|dashboard)\/?$/, () => '/'],
  [/^\/(preferences|server)(\/.*)?$/, () => '/settings'],
  [/^\/you(\/.*)?$/, () => '/'],
  // A device-settings category is today's section on the Configuration or Settings tab (classicSettings).
  [/^\/source\/([^/]+)\/settings\/([^/].*?)\/?$/, (m) => classicSettings(m[1], m[2])],
  // A node, a DM and the DM inbox (Task 2.6) are Classic's DM tab (MeshCore's page ignores the path).
  [/^\/source\/([^/]+)\/(node\/[^/]+(\/.*)?|dm\/[^/]+\/?|dms\/?)$/, (m) => `/source/${m[1]}/messages`],
  [/^\/source\/([^/]+)\/channel\/[^/]+\/?$/, (m) => `/source/${m[1]}/channels`],
  // The device map (Task 3.1) is Classic's Nodes tab, which holds its map.
  [/^\/source\/([^/]+)\/map\/?$/, (m) => `/source/${m[1]}/nodes`],
  [/^\/source\/([^/]+)\/(dms|activity|room)(\/.*)?$/, (m) => `/source/${m[1]}/`],
  [/^\/automations\/[^/]+(\/.*)?$/, () => '/automations'],
  // Tools (q1) is Classic's Info tab; an Info group is Info; Quiet nodes is the Security tab's Dead nodes (Task 8.5).
  [/^\/source\/([^/]+)\/tools\/?$/, (m) => `/source/${m[1]}/info`],
  [/^\/source\/([^/]+)\/info\/[^/]+\/?$/, (m) => `/source/${m[1]}/info`],
  [/^\/source\/([^/]+)\/security\/quiet\/?$/, (m) => `/source/${m[1]}/security`],
  // A Meshtastic built-in's page and the built-ins list (Task 8.3) are Classic's Automation tab.
  [/^\/source\/([^/]+)\/automation\/[^/]+\/?$/, (m) => `/source/${m[1]}/automation`],
];

/**
 * Workspace device-settings category → today's `#section` (the reverse of
 * `SECTION_TO_CATEGORY` in settings/categories.ts, kept static here so that
 * module stays out of Classic's entry chunk). `config-*` sections are on the
 * Configuration tab, `settings-*` on the Settings tab.
 */
const RADIO_MODULES = [
  'ambientlighting', 'audio', 'cannedmsg', 'detectionsensor', 'extnotif', 'meshbeacon', 'mqtt', 'neighbor',
  'paxcounter', 'rangetest', 'remotehardware', 'serial', 'statusmessage', 'storeforward', 'tak', 'telemetry',
  'trafficmanagement',
];
const SETTINGS_SECTION: Record<string, string> = {
  identity: 'config-node-identity',
  lora: 'config-lora',
  channels: 'config-channels',
  security: 'config-security',
  'device/device': 'config-device',
  'device/position': 'config-position',
  'device/power': 'config-power',
  'device/display': 'config-display',
  'device/network': 'config-network',
  ...Object.fromEntries(RADIO_MODULES.map((m) => [`modules/${m}`, `config-${m}`])),
  'maintenance/backup': 'config-backup',
  'maintenance/firmware': 'config-firmware',
  'maintenance/danger': 'config-danger',
  'mqtt-bridge': 'settings-mqtt-bridge',
  'node-display': 'settings-node-display',
  telemetry: 'settings-telemetry',
  'pki-dm': 'settings-pki-dm',
  'reliable-pki': 'settings-reliable-pki',
  notifications: 'settings-notifications',
  'packet-monitor': 'settings-packet-monitor',
  data: 'settings-reset-ui',
  'coverage-recording': 'settings-coverage-mqtt',
};

function classicSettings(id: string, category: string): string {
  const section = SETTINGS_SECTION[category];
  if (section) return `/source/${id}/${section.startsWith('config-') ? 'configuration' : 'settings'}#${section}`;
  // A radio group's index; any other page (MeshCore's, whose Classic page ignores the path) is the Settings tab.
  return /^(device|modules|maintenance)$/.test(category) ? `/source/${id}/configuration` : `/source/${id}/settings`;
}

/**
 * The Classic location (path, and a `#section` where today has one) for a
 * Workspace-only location, or null when Classic serves it as is. The remote
 * target (`settings…?node=`) is today's Admin Commands tab.
 */
export function classicFallback(pathname: string, search = ''): string | null {
  const remote = pathname.match(/^\/source\/([^/]+)\/settings(\/.*)?$/);
  if (remote && new URLSearchParams(search).has('node')) return `/source/${remote[1]}/admin`;
  for (const [re, to] of RULES) {
    const m = pathname.match(re);
    if (m) return to(m);
  }
  return null;
}
