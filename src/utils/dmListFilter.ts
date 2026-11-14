import type { DmFilter } from '../types/ui.js';

export interface DmFilterSubject {
  unread: boolean;
  /** Last message time in ms. */
  lastMessageTime: number;
  isFavorite: boolean;
  hasPosition: boolean;
  isInfrastructure: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether a DM conversation passes the chosen filter. 'hops' and 'all' pass. */
export function passesDmFilter(s: DmFilterSubject, filter: DmFilter, nowMs: number = Date.now()): boolean {
  switch (filter) {
    case 'unread':
      return s.unread;
    case 'recent':
      return s.lastMessageTime > nowMs - DAY_MS;
    case 'favorites':
      return s.isFavorite;
    case 'withPosition':
      return s.hasPosition;
    case 'noInfra':
      return !s.isInfrastructure;
    case 'hops':
    case 'all':
    default:
      return true;
  }
}

/** A DM list row as Classic's list sorts it: the node with its conversation's unread count and last message time (ms). */
export interface DmListEntry {
  nodeNum: number;
  isFavorite?: boolean;
  lastHeard?: number;
  user?: { longName?: string };
  unreadCount: number;
  lastMessageTime: number;
}

/**
 * The DM list's order (MessagesTab, shared with the Workspace inbox): pinned first,
 * then unread (newest first, #6115), then hops for the hop-based filters, else
 * favourites, latest message, last heard, name.
 */
export function compareDmListEntries<T extends DmListEntry>(
  a: T,
  b: T,
  sticky: Set<number>,
  filter: DmFilter,
  hopsOf: (node: T) => number,
): number {
  // Sticky nodes always come first. Sticky is a deliberate user pin, so it
  // outranks the unread-first rule below (#6115 decision: sticky > unread).
  const aSticky = sticky.has(a.nodeNum);
  const bSticky = sticky.has(b.nodeNum);
  if (aSticky && !bSticky) return -1;
  if (!aSticky && bSticky) return 1;

  // #6115: conversations with unread DMs sort to the top — ahead of
  // favorites and of every filter's ordering — newest message first. A new
  // DM from a non-favorite node must not sit below favorites or get buried
  // by a hops-based filter.
  const aUnread = a.unreadCount > 0;
  const bUnread = b.unreadCount > 0;
  if (aUnread && !bUnread) return -1;
  if (!aUnread && bUnread) return 1;
  if (aUnread && bUnread) {
    const unreadMsgDiff = (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    if (unreadMsgDiff !== 0) return unreadMsgDiff;
  }

  // For hops-based filters, sort by hops ascending (0 first, unknown last)
  if (['hops', 'favorites', 'withPosition', 'noInfra'].includes(filter)) {
    return hopsOf(a) - hopsOf(b);
  }

  // Default sort: favorites first, then by last message time, then by last heard
  if (a.isFavorite && !b.isFavorite) return -1;
  if (!a.isFavorite && b.isFavorite) return 1;

  // 1. Prioritize nodes with messages (most recent message first; lastMessageTime is ms)
  const msgDiff = (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
  if (msgDiff !== 0) return msgDiff;

  // 2. Fallback for nodes without message history (or tied): most recently heard first (lastHeard is seconds)
  const heardDiff = (b.lastHeard || 0) - (a.lastHeard || 0);
  if (heardDiff !== 0) return heardDiff;

  // 3. Deterministic alphabetical fallback
  return (a.user?.longName || `Node ${a.nodeNum}`).localeCompare(b.user?.longName || `Node ${b.nodeNum}`);
}

/**
 * The DM list's filter field: long name, short name, node id, or a DM with the
 * text (#3922, `contentMatchIds` from getMessageContentMatchNodeIds). An empty filter passes.
 */
export function matchesDmListSearch(
  node: { user?: { longName?: string; shortName?: string; id?: string } },
  filter: string,
  contentMatchIds: Set<string>,
): boolean {
  if (!filter) return true;
  const searchTerm = filter.toLowerCase();
  return !!(
    node.user?.longName?.toLowerCase().includes(searchTerm) ||
    node.user?.shortName?.toLowerCase().includes(searchTerm) ||
    node.user?.id?.toLowerCase().includes(searchTerm) ||
    // Issue #3922: also match conversations by message content.
    (node.user?.id ? contentMatchIds.has(node.user.id) : false)
  );
}
