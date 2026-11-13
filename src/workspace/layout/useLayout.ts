/**
 * The layout this user should see (spec §5.1), from the server preview flag,
 * the user's `layout` preference and the install `defaultLayout` setting.
 * The answer is mirrored to localStorage `mm.layout` so a reload can draw the
 * right layout before the three fetches land.
 */
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '../../services/api';
import { useUserPreferences } from '../prefs/useUserPreferences';
import { asLayout, resolveLayout, type Layout } from './resolveLayout';

const MIRROR_KEY = 'mm.layout';

function readMirror(): Layout | null {
  try {
    return asLayout(window.localStorage.getItem(MIRROR_KEY));
  } catch {
    return null;
  }
}

export function useLayout(): { layout: Layout; ready: boolean; preview: boolean; setLayout(l: Layout): Promise<void> } {
  const [mirror] = useState(readMirror);
  const config = useQuery({
    queryKey: ['config', 'workspacePreview'],
    queryFn: () => apiService.get<{ workspacePreview?: boolean }>('/api/config'),
    staleTime: 5 * 60_000,
  });
  const settings = useQuery({
    queryKey: ['settings', 'defaultLayout'],
    queryFn: () => apiService.get<{ defaultLayout?: string }>('/api/settings'),
    staleTime: 5 * 60_000,
  });
  const { prefs, isLoading: prefsLoading, setPref } = useUserPreferences();

  const fetched = !config.isPending && !settings.isPending && !prefsLoading;
  const preview = config.data?.workspacePreview === true;
  const resolved = resolveLayout({
    preview,
    userLayout: asLayout(prefs.layout),
    defaultLayout: asLayout(settings.data?.defaultLayout),
  });

  useEffect(() => {
    if (!fetched) return;
    try {
      window.localStorage.setItem(MIRROR_KEY, resolved);
    } catch {
      // Storage blocked (private window): the next load just waits for the fetches.
    }
  }, [fetched, resolved]);

  const setLayout = useCallback((l: Layout) => setPref('layout', l), [setPref]);

  return {
    layout: fetched ? resolved : (mirror ?? 'classic'),
    ready: fetched || mirror !== null,
    preview,
    setLayout,
  };
}
