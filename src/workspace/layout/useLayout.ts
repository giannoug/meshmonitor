/**
 * The layout this user should see (spec §5.1), from the server preview flag,
 * the user's `layout` preference and the install `defaultLayout` setting.
 * Until those answer, the localStorage mirror `mm.layout` decides, else
 * Classic, so Classic never waits on a fetch. Preference and setting are only
 * fetched when the preview flag is on.
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
  const preview = config.data?.workspacePreview === true;
  const settings = useQuery({
    queryKey: ['settings', 'defaultLayout'],
    queryFn: () => apiService.get<{ defaultLayout?: string }>('/api/settings'),
    staleTime: 5 * 60_000,
    enabled: preview,
  });
  const { prefs, isSuccess: prefsOk, isError: prefsFailed, setPref } = useUserPreferences({ enabled: preview });

  // Only a full successful answer replaces the mirror: a transient error must not.
  const resolvedOk = config.isSuccess && (!preview || (settings.isSuccess && prefsOk));
  // A failed fetch settles on the mirror or Classic, so nothing waits on it forever.
  const failed = config.isError || settings.isError || prefsFailed;
  const resolved = resolveLayout({
    preview,
    userLayout: asLayout(prefs.layout),
    defaultLayout: asLayout(settings.data?.defaultLayout),
  });

  useEffect(() => {
    if (!resolvedOk) return;
    try {
      window.localStorage.setItem(MIRROR_KEY, resolved);
    } catch {
      // Storage blocked (private window): the next load starts in Classic again.
    }
  }, [resolvedOk, resolved]);

  const setLayout = useCallback((l: Layout) => setPref('layout', l), [setPref]);

  return {
    layout: resolvedOk ? resolved : (mirror ?? 'classic'),
    ready: resolvedOk || mirror !== null || failed,
    preview,
    setLayout,
  };
}
