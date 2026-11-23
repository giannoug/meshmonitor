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
  [/^\/source\/([^/]+)\/settings\/[^/].*$/, (m) => `/source/${m[1]}/settings`],
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

/** The Classic path for a Workspace-only path, or null when Classic serves it as is. */
export function classicFallback(pathname: string): string | null {
  for (const [re, to] of RULES) {
    const m = pathname.match(re);
    if (m) return to(m);
  }
  return null;
}
