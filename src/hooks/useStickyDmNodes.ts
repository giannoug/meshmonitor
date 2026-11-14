/**
 * The DM list's pinned ("sticky") nodes: kept at the top of the list regardless
 * of sorting and filters, stored in localStorage by nodeNum. Shared by
 * Classic's MessagesTab and the Workspace DM inbox (Rule X), so both read the
 * same pins. Moved verbatim out of MessagesTab.
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'meshmonitor-sticky-dm-nodes';

export function useStickyDmNodes(): [Set<number>, (nodeNum: number) => void] {
  const [stickyNodes, setStickyNodes] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Set(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // Ignore parse errors
    }
    return new Set();
  });

  const toggle = useCallback((nodeNum: number) => {
    setStickyNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeNum)) {
        newSet.delete(nodeNum);
      } else {
        newSet.add(nodeNum);
      }
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newSet]));
      return newSet;
    });
  }, []);

  return [stickyNodes, toggle];
}
