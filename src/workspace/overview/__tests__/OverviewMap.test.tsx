/**
 * @vitest-environment jsdom
 *
 * OverviewMap's wiring around today's DashboardMap (mocked here, to read its
 * props): the Unified data with 2+ devices and one device's data otherwise,
 * as DashboardPage; the search pill narrows the pins; a popup's source row
 * opens that device; and the admin's default landing page applies on `/` only.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import type { DashboardMapProps } from '../../../components/Dashboard/DashboardMap';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../components/ToastContainer';
import OverviewMap from '../OverviewMap';

const seen: { props: DashboardMapProps | null } = { props: null };
vi.mock('../../../components/Dashboard/DashboardMap', () => ({
  default: (props: DashboardMapProps) => {
    seen.props = props;
    return <div data-testid="dashboard-map" data-source={props.sourceId ?? ''} data-count={props.nodes.length} />;
  },
}));
vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  seen.props = null;
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

const map = () => screen.findByTestId('dashboard-map');
const realUrl = () => screen.getByTestId('real-url').textContent;
const withLanding = (value: string) => ({ 'GET /api/settings': () => ({ ...athensFixture.settings, defaultLandingPage: value }) });

describe('OverviewMap', () => {
  it('shows every device merged (Unified) when there are two or more', async () => {
    renderMap('/overview/map');
    await waitFor(async () => expect(await map()).toHaveAttribute('data-count', String(athensFixture.nodes.length)));
    expect(await map()).toHaveAttribute('data-source', '__unified__');
  });

  it('shows the one device\'s own data when there is only one', async () => {
    const only = athensFixture.sources[0];
    renderMap('/overview/map', {
      fixtures: {
        'GET /api/sources': () => [only],
        'GET /api/sources/:id/dashboard': () => ({ sourceId: only.id, nodes: athensFixture.nodes.slice(0, 2), traceroutes: [], neighborInfo: [], channels: [] }),
      },
    });
    await waitFor(async () => expect(await map()).toHaveAttribute('data-count', '2'));
    expect(await map()).toHaveAttribute('data-source', only.id);
  });

  it('the search pill narrows the pins by name or id', async () => {
    renderMap('/overview/map');
    await waitFor(async () => expect(await map()).toHaveAttribute('data-count', String(athensFixture.nodes.length)));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter nodes' }), { target: { value: 'hymettus' } });
    expect(await map()).toHaveAttribute('data-count', '1');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter nodes' }), { target: { value: 'Kifisia' } });
    expect(await map()).toHaveAttribute('data-count', '2');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter nodes' }), { target: { value: '!a1b2c306' } });
    expect(await map()).toHaveAttribute('data-count', '1');
  });

  it('a popup\'s source row opens that device: a Meshtastic node page, a MeshCore device', async () => {
    renderMap('/overview/map');
    await map();
    seen.props!.onNodeSourceSelect!({ sourceId: SOURCE_IDS.g2, sourceName: 'Station G2', protocol: 'Meshtastic' }, '!a1b2c301');
    await waitFor(() => expect(realUrl()).toBe(`/source/${SOURCE_IDS.g2}/node/!a1b2c301`));
    seen.props!.onNodeSourceSelect!({ sourceId: SOURCE_IDS.heltec, sourceName: 'Heltec MeshCore', protocol: 'MeshCore' }, 'n1');
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
