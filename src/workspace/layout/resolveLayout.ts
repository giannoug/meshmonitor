export type Layout = 'classic' | 'workspace';

/** Narrow an unknown stored value to a Layout, or null. */
export function asLayout(v: unknown): Layout | null {
  return v === 'classic' || v === 'workspace' ? v : null;
}

/** Which layout a user sees: their own choice, then the install default, then Classic. */
export function resolveLayout(i: { userLayout?: Layout | null; defaultLayout?: Layout | null }): Layout {
  return i.userLayout ?? i.defaultLayout ?? 'classic';
}
