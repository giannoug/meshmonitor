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
  [/^\/overview\/(messages|telemetry|packets)\/?$/, (m) => `/unified/${m[1]}`],
  [/^\/overview\/automations\/?$/, () => '/automations'],
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
];

/** The Classic path for a Workspace-only path, or null when Classic serves it as is. */
export function classicFallback(pathname: string): string | null {
  for (const [re, to] of RULES) {
    const m = pathname.match(re);
    if (m) return to(m);
  }
  return null;
}
