/**
 * The Classic entry points to the Workspace (D18, spec §5.2): the r3 banner
 * and the "Try the Workspace layout" user-menu item. Off while the Workspace
 * is built; Task 9.3 turns it on in its own commit (D4). While false, both
 * render nothing and Classic's DOM and requests are unchanged.
 */
export const WORKSPACE_ENTRY_ENABLED = false;
