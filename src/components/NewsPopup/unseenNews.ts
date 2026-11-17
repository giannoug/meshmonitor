/**
 * Which news items a user has not seen: NewsPopup's filter, moved out
 * unchanged (Rule X) so the Workspace Help & about page (#6365) marks the
 * same items as new.
 */
import type { NewsItem } from '../../types/ui';

export interface NewsStatus {
  lastSeenNewsId: string | null;
  dismissedNewsIds: string[];
}

export function unseenNewsItems(allItems: NewsItem[], status: NewsStatus): NewsItem[] {
  const dismissedIds = new Set(status.dismissedNewsIds || []);

  // Find the date of the lastSeenNewsId item to filter out older items
  let lastSeenDate: Date | null = null;
  if (status.lastSeenNewsId) {
    const lastSeenItem = allItems.find(item => item.id === status.lastSeenNewsId);
    if (lastSeenItem) {
      lastSeenDate = new Date(lastSeenItem.date);
    }
  }

  return allItems.filter(item => {
    // Always show important items that haven't been dismissed
    if (item.priority === 'important' && !dismissedIds.has(item.id)) {
      return true;
    }
    // Hide dismissed items
    if (dismissedIds.has(item.id)) {
      return false;
    }
    // If we have a lastSeenDate, only show items newer than that
    if (lastSeenDate) {
      const itemDate = new Date(item.date);
      return itemDate > lastSeenDate;
    }
    // No lastSeenDate means show all non-dismissed items (first time user)
    return true;
  });
}
