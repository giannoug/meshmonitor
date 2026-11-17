/**
 * `/preferences/*` (Task 6.3): the Workspace's own Preferences pages, lazy
 * like the other You pages. Today's Units & Formats, Sorting and Link
 * Previews categories live on Language & units, so their URLs (and a search
 * result's `#setting-…` anchor) land there; any other category lands on
 * Appearance, as `/settings` does for a non-admin. MeshCore Messaging moved
 * to Server › General (Task 6.4).
 */
import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

const LanguageUnits = lazy(() => import('./LanguageUnitsPage.tsx'));
const Appearance = lazy(() => import('./AppearancePage.tsx'));
const Themes = lazy(() => import('./ThemesPage.tsx'));
const ThemeEditor = lazy(() => import('./ThemeEditorPage.tsx'));
const MapPrefs = lazy(() => import('./MapPrefsPage.tsx'));

function To({ pathname }: { pathname: string }) {
  const { hash } = useLocation();
  return <Navigate replace to={{ pathname, hash }} />;
}

export function PreferencesRoutes() {
  return (
    <Routes>
      <Route path="language" element={<LanguageUnits />} />
      {['units', 'sorting', 'link-previews'].map((p) => (
        <Route key={p} path={p} element={<To pathname="/preferences/language" />} />
      ))}
      <Route path="appearance" element={<Appearance />} />
      <Route path="appearance/themes" element={<Themes />} />
      <Route path="appearance/themes/:slug" element={<ThemeEditor />} />
      <Route path="map" element={<MapPrefs />} />
      {/* Moved to Server › General (Task 6.4, s13n5). */}
      <Route path="meshcore-messaging" element={<Navigate replace to="/server/general" />} />
      <Route path="*" element={<To pathname="/preferences/appearance" />} />
    </Routes>
  );
}
