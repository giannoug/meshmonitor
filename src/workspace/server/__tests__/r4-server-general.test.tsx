/**
 * @vitest-environment jsdom
 *
 * Board r4-server-general: Server › General (the Layout and Sources cards of
 * Task 1.8, the Server sidebar and the rest of General of Task 6.4: the
 * default landing page, MeshCore messaging and the Reticulum cap, s13n5).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';
import { ToastProvider } from '../../../components/ToastContainer';
import { useLayout } from '../../layout/useLayout';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import { expectBoard } from '../../test/boardChecks';
import { SERVER_SETTINGS } from '../../__fixtures__/server';
import GeneralLayoutCard from '../GeneralLayoutCard';
import { grants, renderServer } from './serverHarness';

/** `/api/settings` that keeps what is posted. */
function settingsFixture(initial: Record<string, string> = {}) {
  const settings: Record<string, string> = { ...athensFixture.settings, ...initial };
  const posts: Array<Record<string, string>> = [];
  const fixtures: Record<string, FixtureHandler> = {
    'GET /api/settings': () => ({ ...settings }),
    'POST /api/settings': (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      Object.assign(settings, body);
      posts.push(body);
      return { success: true };
    },
  };
  return { posts, fixtures };
}

/** What LayoutGate would decide right now, from the same queries. */
function GateProbe() {
  return <span data-testid="gate">{useLayout().layout}</span>;
}

function renderCard(opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <GateProbe />
      <GeneralLayoutCard />
    </ToastProvider>,
    { route: '/server/general', ...opts },
  );
}

const row = (title: string) => screen.getByText(title).closest('[data-testid="general-row"]') as HTMLElement;

describe('r4-server-general (Layout and Sources cards)', () => {
  it('r4-server-general shows the board', async () => {
    const { container } = renderServer('/server/general');
    await screen.findByText('Classic 9 · Workspace 4');
    expectBoard('r4-server-general', container);
  });

  it('shows the stored values: default layout, banner offer, usage and the default source', async () => {
    renderCard();
    expect(await screen.findByRole('combobox', { name: 'Default layout for new users' })).toHaveDisplayValue('Classic');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Offer Workspace to Classic users' })).toBeChecked());
    expect(within(row('Who uses which')).getByText('Signed-in users, last 30 days')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Default Meshtastic source' })).toHaveDisplayValue('Station G2'),
    );
    // Today's options: Automatic, then the Meshtastic TCP sources only.
    const options = within(screen.getByRole('combobox', { name: 'Default Meshtastic source' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Automatic (first started)', 'Station G2', 'Rooftop RAK']);
  });

  it('autosaves each control with a Saved tick', async () => {
    const s = settingsFixture();
    renderCard({ fixtures: s.fixtures });
    const layout = await screen.findByRole('combobox', { name: 'Default layout for new users' });
    await waitFor(() => expect(layout).toBeEnabled());
    fireEvent.change(layout, { target: { value: 'workspace' } });
    await waitFor(() => expect(within(row('Default layout for new users')).getByText('Saved')).toBeInTheDocument());

    const offer = screen.getByRole('switch', { name: 'Offer Workspace to Classic users' });
    await waitFor(() => expect(offer).toBeChecked());
    fireEvent.click(offer);
    await waitFor(() => expect(within(row('Offer Workspace to Classic users')).getByText('Saved')).toBeInTheDocument());

    const source = screen.getByRole('combobox', { name: 'Default Meshtastic source' });
    await waitFor(() => expect(source).toHaveDisplayValue('Station G2'));
    fireEvent.change(source, { target: { value: SOURCE_IDS.rak } });
    await waitFor(() => expect(within(row('Default Meshtastic source')).getByText('Saved')).toBeInTheDocument());

    expect(s.posts).toEqual([
      { defaultLayout: 'workspace' },
      { offerWorkspaceBanner: 'false' },
      { defaultMeshtasticSourceId: SOURCE_IDS.rak },
    ]);
  });

  it('the default layout waits for the admin\'s own choice to load', async () => {
    renderCard({ fixtures: { 'GET /api/user/preferences': () => new Response('{}', { status: 500 }) } });
    // The other controls work; this one stays off while the preference is unknown.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Default Meshtastic source' })).toHaveDisplayValue('Station G2'));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('combobox', { name: 'Default layout for new users' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/layout choice/);
  });

  it('a failed save keeps the old value and says so', async () => {
    renderCard({
      fixtures: {
        'POST /api/settings': () => new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 500 }),
      },
    });
    const layout = await screen.findByRole('combobox', { name: 'Default layout for new users' });
    await waitFor(() => expect(layout).toBeEnabled());
    fireEvent.change(layout, { target: { value: 'workspace' } });
    expect(await screen.findByText('Failed to save settings')).toBeInTheDocument();
    expect(layout).toHaveDisplayValue('Classic');
    expect(screen.queryByText('Saved')).toBeNull();
  });

  describe('changing the default never moves the admin (Ruling W)', () => {
    /** An admin with no layout of their own, in the Workspace through the install default. */
    function renderOnDefault(post?: FixtureHandler) {
      const s = settingsFixture({ defaultLayout: 'workspace' });
      const p = prefsFixture({});
      const order: string[] = [];
      const fixtures: Record<string, FixtureHandler> = {
        ...s.fixtures,
        ...p.fixtures,
        'PUT /api/user/preferences/:key': (url, init) => {
          order.push('pref');
          return p.fixtures['PUT /api/user/preferences/:key'](url, init);
        },
        'POST /api/settings': (url, init) => {
          order.push('setting');
          return (post ?? s.fixtures['POST /api/settings'])(url, init);
        },
      };
      renderCard({ fixtures });
      return { posts: s.posts, puts: p.puts, order };
    }

    it('keeps the admin in the Workspace: their layout is saved first, then the setting', async () => {
      const w = renderOnDefault();
      await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('workspace'));
      const layout = screen.getByRole('combobox', { name: 'Default layout for new users' });
      await waitFor(() => expect(layout).toHaveDisplayValue('Workspace'));
      await waitFor(() => expect(layout).toBeEnabled());
      fireEvent.change(layout, { target: { value: 'classic' } });
      await waitFor(() => expect(within(row('Default layout for new users')).getByText('Saved')).toBeInTheDocument());
      expect(w.order).toEqual(['pref', 'setting']);
      expect(w.puts).toEqual([['layout', 'workspace']]);
      expect(w.posts).toEqual([{ defaultLayout: 'classic' }]);
      expect(layout).toHaveDisplayValue('Classic');
      // Give the gate's refetches time to land: it still says Workspace.
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByTestId('gate')).toHaveTextContent('workspace');
    });

    it('a failed default save leaves the layout unchanged and shows the error', async () => {
      renderOnDefault(() => new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 500 }));
      await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('workspace'));
      const layout = screen.getByRole('combobox', { name: 'Default layout for new users' });
      await waitFor(() => expect(layout).toHaveDisplayValue('Workspace'));
      await waitFor(() => expect(layout).toBeEnabled());
      fireEvent.change(layout, { target: { value: 'classic' } });
      expect(await screen.findByText('Failed to save settings')).toBeInTheDocument();
      expect(layout).toHaveDisplayValue('Workspace');
      expect(screen.getByTestId('gate')).toHaveTextContent('workspace');
    });

    it('a failed layout save leaves the default alone and shows the error', async () => {
      const s = settingsFixture({ defaultLayout: 'workspace' });
      renderCard({
        fixtures: {
          ...s.fixtures,
          'GET /api/user/preferences': () => ({ success: true, data: { preferences: {} } }),
          'PUT /api/user/preferences/:key': () => new Response(JSON.stringify({ success: false }), { status: 500 }),
        },
      });
      const layout = await screen.findByRole('combobox', { name: 'Default layout for new users' });
      await waitFor(() => expect(layout).toHaveDisplayValue('Workspace'));
      await waitFor(() => expect(layout).toBeEnabled());
      fireEvent.change(layout, { target: { value: 'classic' } });
      expect(await screen.findByText('Failed to save settings')).toBeInTheDocument();
      expect(s.posts).toEqual([]);
      expect(layout).toHaveDisplayValue('Workspace');
    });
  });

  it('a non-admin does not see the card', async () => {
    renderCard({ permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: true } } } } });
    const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));
    await waitFor(() => expect(urls().some((u) => u.includes('/api/auth/status'))).toBe(true));
    // Let the auth status land and any follow-up render happen.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByTestId('general-row')).toBeNull();
    expect(urls().some((u) => u.includes('/api/admin/layout-usage'))).toBe(false);
  });
});

describe('Server › General, the rest of the page (Task 6.4, s13n5)', () => {
  it('draws, below the cards, the default landing page, MeshCore Messaging and the Reticulum cap', async () => {
    renderServer('/server/general');
    await screen.findByText('Classic 9 · Workspace 4');
    const titles = screen.getAllByRole('heading', { level: 2 }).filter((h) => !h.closest('aside')).map((h) => h.textContent);
    expect(titles).toEqual(['Layout', 'Sources', 'Landing page', 'MeshCore Messaging', 'Reticulum Settings']);
  });

  it('the default landing page saves as you go, with today\'s choices and the devices', async () => {
    const { log } = renderServer('/server/general');
    const select = await screen.findByRole('combobox', { name: 'Default Landing Page' });
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options.slice(0, 5)).toEqual(['Unified View (default)', 'Unified Messages', 'Unified Telemetry', 'Map Analysis', 'Reports']);
    expect(options).toContain('Station G2');
    fireEvent.change(select, { target: { value: 'reports' } });
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { defaultLandingPage: 'reports' } }));
  });

  it('MeshCore Messaging: today\'s rows, the retry\'s Sends line, today\'s keys', async () => {
    const { log } = renderServer('/server/general');
    const retry = await screen.findByRole('switch', { name: 'Auto-retry automated MeshCore channel sends' });
    expect(screen.getByText(/hears no repeater in 30 s is sent once more/)).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { meshcoreChannelRetryEnabled: '1' } }));
    const timeout = screen.getByLabelText('Remote CLI reply timeout (seconds)');
    expect(timeout).toHaveValue(15);
    fireEvent.change(timeout, { target: { value: '8' } });
    fireEvent.blur(timeout);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { meshcoreCliTimeoutSeconds: '8' } }));
    fireEvent.click(screen.getByRole('switch', { name: 'Use other sources to resolve unknown hops' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { meshcoreCrossSourceHopResolution: '1' } }));
  });

  it('reads only \'1\' / \'true\' as on for the MeshCore keys, as today', async () => {
    renderServer('/server/general', { settings: { ...SERVER_SETTINGS, meshcoreChannelRetryEnabled: 'yes', meshcoreCrossSourceHopResolution: 'true' } });
    expect(await screen.findByRole('switch', { name: 'Auto-retry automated MeshCore channel sends' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Use other sources to resolve unknown hops' })).toBeChecked();
  });

  it('the Reticulum cap saves on blur, 1–100000, and an unset cap reads as 2000', async () => {
    const { log } = renderServer('/server/general', { settings: { ...SERVER_SETTINGS, reticulum_destinations_max: '' } });
    const cap = await screen.findByLabelText('Destination retention cap');
    expect(cap).toHaveValue(2000);
    fireEvent.change(cap, { target: { value: '500' } });
    fireEvent.blur(cap);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { reticulum_destinations_max: '500' } }));
  });

  it('a non-admin settings writer gets only today\'s writer rows: MeshCore Messaging and the Reticulum cap', async () => {
    renderServer('/server/general', { permissions: grants({ write: true }) });
    await screen.findByRole('switch', { name: 'Auto-retry automated MeshCore channel sends' });
    expect(screen.getAllByRole('heading', { level: 2 }).filter((h) => !h.closest('aside')).map((h) => h.textContent)).toEqual(['MeshCore Messaging', 'Reticulum Settings']);
    expect(screen.queryByRole('combobox', { name: 'Default Landing Page' })).toBeNull();
  });

  it('a settings viewer without write gets no access', async () => {
    renderServer('/server/general', { permissions: grants({ read: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
  });

  it('You › Preferences › MeshCore Messaging lands here', async () => {
    renderServer('/server/meshcore-messaging');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/general'));
  });
});
