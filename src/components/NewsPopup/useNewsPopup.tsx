/**
 * NewsPopup's feed, paging and dismissal (#6365 Rule X): moved out of the
 * popup unchanged so the Workspace's news sheet runs the same logic. Opening
 * reads the feed (and, signed in, the user's news status); closing without
 * `forceShowAll` dismisses every item it showed and marks the newest feed
 * item seen.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Components } from 'react-markdown';
import type { NewsItem, NewsFeed } from '../../types/ui';
import api from '../../services/api';
import { unseenNewsItems } from './unseenNews';

/**
 * News content is authored as blog posts on meshmonitor.org, so any
 * site-root-relative link in it ("/features/atak") points at the docs site,
 * not at this instance. Resolving it here would send the user to
 * <instance-base-url>/features/atak, which does not exist. The feed generator
 * absolutizes these, but older feed items are already published relative — so
 * rewrite them on render too.
 */
const NEWS_SITE_ORIGIN = 'https://meshmonitor.org';

export const absolutizeNewsUrl = (url: string | undefined): string | undefined => {
  if (!url) return url;
  // Root-relative only: leave protocol-relative ("//host"), absolute, anchor,
  // and mailto/data URLs alone.
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `${NEWS_SITE_ORIGIN}${url}`;
  }
  return url;
};

/** Links open in a new tab and resolve against meshmonitor.org. */
export const newsMarkdownComponents: Components = {
  a(props) {
    const { node: _node, href, ...rest } = props;
    return (
      <a
        {...rest}
        href={absolutizeNewsUrl(href)}
        target="_blank"
        rel="noopener noreferrer"
      />
    );
  },
  img(props) {
    const { node: _node, src, ...rest } = props;
    return <img {...rest} src={absolutizeNewsUrl(src)} />;
  },
};

export interface NewsPopupOptions {
  isOpen: boolean;
  onClose: () => void;
  forceShowAll?: boolean;
  isAuthenticated: boolean;
}

export function useNewsPopup({ isOpen, onClose, forceShowAll = false, isAuthenticated }: NewsPopupOptions) {
  const { t } = useTranslation();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Track the full feed for updating lastSeenNewsId
  const [fullFeed, setFullFeed] = useState<NewsItem[]>([]);

  // Ref to scroll content to top on navigation
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch news data when popup opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const feed: NewsFeed = await api.getNewsFeed();
        let status: { lastSeenNewsId: string | null; dismissedNewsIds: string[] } | null = null;

        if (isAuthenticated) {
          status = await api.getUserNewsStatus();
        }

        // Store full feed for later use
        const allItems = feed.items || [];
        setFullFeed(allItems);

        // Filter items based on forceShowAll and user status
        let items = [...allItems];

        if (!forceShowAll && status) {
          items = unseenNewsItems(allItems, status);
        }

        setNewsItems(items);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Error fetching news:', error);
        setNewsItems([]);
        setFullFeed([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [isOpen, forceShowAll, isAuthenticated]);

  // Reset state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  const handleClose = useCallback(async () => {
    // Closing the popup always marks the shown items as "don't show again"
    // (unless we're in the forced "view all" mode opened via the News icon).
    // Users can re-open the feed any time from the News icon.
    if (isAuthenticated && !forceShowAll && newsItems.length > 0) {
      try {
        for (const item of newsItems) {
          await api.dismissNewsItem(item.id);
        }
      } catch (error) {
        console.error('Error dismissing news items:', error);
      }
    }

    // Update lastSeenNewsId to the most recent item in the feed (so user won't see current items again)
    if (isAuthenticated && fullFeed.length > 0 && !forceShowAll) {
      // Find the most recent item by date
      const sortedItems = [...fullFeed].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const mostRecentId = sortedItems[0].id;
      try {
        // Get current status to preserve dismissedNewsIds
        const status = await api.getUserNewsStatus();
        await api.updateUserNewsStatus(mostRecentId, status.dismissedNewsIds || []);
      } catch (error) {
        console.error('Error updating lastSeenNewsId:', error);
      }
    }

    onClose();
  }, [isAuthenticated, newsItems, onClose, fullFeed, forceShowAll]);

  const handleNext = useCallback(() => {
    if (currentIndex < newsItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Scroll content to top for new item
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      void handleClose();
    }
  }, [currentIndex, newsItems.length, handleClose]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      // Scroll content to top for new item
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentIndex]);

  const getCategoryLabel = (category: NewsItem['category']): string => {
    switch (category) {
      case 'release':
        return t('news.category.release', 'Release');
      case 'security':
        return t('news.category.security', 'Security');
      case 'feature':
        return t('news.category.feature', 'Feature');
      case 'maintenance':
        return t('news.category.maintenance', 'Maintenance');
      default:
        return category;
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return {
    newsItems,
    currentIndex,
    loading,
    contentRef,
    handleClose,
    handleNext,
    handlePrevious,
    getCategoryLabel,
    formatDate,
  };
}
