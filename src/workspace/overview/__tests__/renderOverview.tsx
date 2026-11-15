/**
 * The Overview map with Analysis (Task 4.2) under the real Workspace routes,
 * against the Athens fixture. Leaflet places markers and lines only on a map
 * with a size, so the map gets one; `analysis` presets today's Map Analysis
 * config (localStorage `mapAnalysis.config.v1`), as a returning user has it.
 */
import type { ReactNode } from 'react';
import { vi, onTestFinished } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { DEFAULT_CONFIG, type MapAnalysisConfig } from '../../../hooks/useMapAnalysisConfig';
import WorkspaceApp from '../../WorkspaceApp';

export const CONFIG_KEY = 'mapAnalysis.config.v1';

type Layers = Partial<Record<keyof MapAnalysisConfig['layers'], Partial<MapAnalysisConfig['layers']['markers']>>>;

export interface OverviewOptions extends RenderWorkspaceOptions {
  /** Layers to preset on (merged over today's defaults). */
  layers?: Layers;
  config?: Partial<MapAnalysisConfig>;
}

export function storedConfig(): MapAnalysisConfig {
  return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') ?? DEFAULT_CONFIG;
}

export function renderOverview(route: string, opts: OverviewOptions = {}) {
  localStorage.clear();
  const layers = Object.fromEntries(
    Object.entries(DEFAULT_CONFIG.layers).map(([k, v]) => [k, { ...v, ...(opts.layers?.[k as keyof Layers] ?? {}) }]),
  );
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...DEFAULT_CONFIG, ...opts.config, layers }));
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700);
  onTestFinished(() => {
    width.mockRestore();
    height.mockRestore();
    localStorage.clear();
  });
  return renderWorkspace(<WorkspaceApp />, { route, ...opts });
}

/** The marker whose label (short name) is `short`. */
export function marker(short: string): Promise<HTMLElement> {
  return waitFor(
    () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')).find((m) => m.textContent?.includes(short));
      if (!el) throw new Error(`no marker ${short}`);
      return el;
    },
    { timeout: 5000 },
  );
}

export async function openLayers(): Promise<HTMLElement> {
  if (!screen.queryByTestId('layers-drawer')) {
    (await screen.findByRole('button', { name: /^Layers/ }, { timeout: 5000 })).click();
  }
  return screen.findByTestId('layers-drawer');
}

export async function openTools(): Promise<HTMLElement> {
  (await screen.findByRole('button', { name: 'Tools' }, { timeout: 5000 })).click();
  return screen.findByRole('menu', { name: 'Tools' });
}

export const inDrawer = async (): Promise<ReturnType<typeof within>> => within(await openLayers());

/** Phone (Task 4.3): a bar button opens its sheet. Tools and Time open the one Tools sheet. */
export async function openPhoneSheet(button: 'Tools' | 'Time' | 'Layers'): Promise<HTMLElement> {
  const bar = await screen.findByRole('toolbar', { name: 'Map tools' }, { timeout: 5000 });
  fireEvent.click(within(bar).getByRole('button', { name: new RegExp(`^${button}`) }));
  return screen.findByRole('dialog', { name: button === 'Layers' ? 'Layers' : 'Tools' });
}

/** The first interactive line in a Map Analysis pane (`neighbors`, `paths`, `trails`). */
export function lineIn(pane: string): Promise<Element> {
  return waitFor(
    () => {
      const el = document.querySelector(`.leaflet-${pane}-pane path.leaflet-interactive`);
      if (!el) throw new Error(`no line in ${pane}`);
      return el;
    },
    { timeout: 5000 },
  );
}

export const ON_24H = { enabled: true, lookbackHours: 24 };

/** Requests that are not reads: none may leave while browsing (nothing transmits). */
export const nonGets = () => vi.mocked(fetch).mock.calls.filter(([, i]) => (i?.method ?? 'GET') !== 'GET').map(([u]) => String(u));

export const passthrough = ({ children }: { children: ReactNode }) => <>{children}</>;
