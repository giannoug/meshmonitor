export type Layout = 'classic' | 'workspace';

/** Narrow an unknown stored value to a Layout, or null. */
export function asLayout(v: unknown): Layout | null {
  return v === 'classic' || v === 'workspace' ? v : null;
}

/**
 * Which layout a user sees. Without the server preview flag (D3) everyone gets
 * Classic; otherwise the user's own choice wins over the install default.
 */
export function resolveLayout(i: { preview: boolean; userLayout?: Layout | null; defaultLayout?: Layout | null }): Layout {
  if (!i.preview) return 'classic';
  return i.userLayout ?? i.defaultLayout ?? 'classic';
}
