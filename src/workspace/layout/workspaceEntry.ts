/**
 * The Classic entry points to the Workspace (D18, spec §5.2): the r3 banner
 * and the "Try the Workspace layout" user-menu item. On since Task 9.3 (its
 * own commit, D4). Set false to hide both: they then render nothing. (The
 * layout gate still reads the preferences and install settings either way.)
 */
export const WORKSPACE_ENTRY_ENABLED = true;
