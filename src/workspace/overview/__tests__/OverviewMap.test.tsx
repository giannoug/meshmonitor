/**
 * @vitest-environment jsdom
 *
 * OverviewMap's wiring around today's Map Analysis canvas (mocked here, to
 * read what the Overview gives it): a popup's source row opens that device,
 * and the admin's default landing page applies on `/` only. The map itself is
 * covered by the 5-01 … 5-06 board tests.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import { useAnalysisSurface, type AnalysisSurface } from '../../../components/MapAnalysis/analysisSurface';
import OverviewMap from '../OverviewMap';

const seen: { surface: AnalysisSurface | null } = { surface: null };
vi.mock('../../../components/MapAnalysis/MapAnalysisCanvas', () => ({
  default: function Canvas() {
    seen.surface = useAnalysisSurface();
    return <div data-testid="analysis-canvas" />;
  },
}));
vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  seen.surface = null;
  // SettingsContext caches the landing page in localStorage.
  localStorage.clear();
});

function RealUrl() {
  const { pathname } = useLocation();
  return <output data-testid="real-url">{pathname}</output>;
}

function renderMap(route: string, opts: RenderWorkspaceOptions & { landing?: boolean } = {}) {
  return renderWorkspace(
    <SettingsProvider>
      <ToastProvider>
        <OverviewMap landing={opts.landing} />
        <RealUrl />
      </ToastProvider>
    </SettingsProvider>,
    { route, ...opts },
  );
}

const map = () => screen.findByTestId('analysis-canvas');
const realUrl = () => screen.getByTestId('real-url').textContent;
const withLanding = (value: string) => ({ 'GET /api/settings': () => ({ ...athensFixture.settings, defaultLandingPage: value }) });

describe('OverviewMap', () => {
  it('a popup\'s source row opens that device: a Meshtastic node page, a MeshCore device', async () => {
    renderMap('/overview/map');
    await map();
    seen.surface!.onSourceSelect!({ sourceId: SOURCE_IDS.g2, sourceName: 'Station G2', protocol: 'Meshtastic' }, '!a1b2c301');
    await waitFor(() => expect(realUrl()).toBe(`/source/${SOURCE_IDS.g2}/node/!a1b2c301`));
    seen.surface!.onSourceSelect!({ sourceId: SOURCE_IDS.heltec, sourceName: 'Heltec MeshCore', protocol: 'MeshCore' }, 'n1');
    await waitFor(() => expect(realUrl()).toBe(`/source/${SOURCE_IDS.heltec}`));
  });

  it.each([
    ['reports', '/reports'],
    ['unified-messages', '/unified/messages'],
    [SOURCE_IDS.rak, `/source/${SOURCE_IDS.rak}/`],
  ])('on / the default landing page %s moves to %s', async (value, to) => {
    renderMap('/', { landing: true, fixtures: withLanding(value) });
    await waitFor(() => expect(realUrl()).toBe(to));
  });

  it.each([
    ['/', true, 'unified'],
    ['/overview/map', false, 'reports'],
  ])('%s stays put (landing %s, setting %s)', async (route, landing, value) => {
    renderMap(route, { landing, fixtures: withLanding(value) });
    await map();
    await new Promise((r) => setTimeout(r, 50));
    expect(realUrl()).toBe(route);
  });
});
