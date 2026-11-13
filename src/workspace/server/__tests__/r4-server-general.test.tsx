/**
 * @vitest-environment jsdom
 *
 * Board r4-server-general, Layout and Sources cards (Task 1.8). The Server
 * sidebar and the rest of General are Task 6.4's, which owns the full
 * `expectBoard('r4-server-general')`; here only the cards' must strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import type { FixtureHandler } from '../../__fixtures__/fixtureApi';
import { ToastProvider } from '../../../components/ToastContainer';
import { useLayout } from '../../layout/useLayout';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import GeneralLayoutCard from '../GeneralLayoutCard';

const check = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../__fixtures__/board-checks/r4-server-general.json'), 'utf8'),
) as { must: string[]; absent: string[] };

/** The board's must strings in the two cards; the sidebar's are 6.4's. */
const CARD_MUST = [
  'General',
  'Default layout for new users',
  'People who already picked one keep their choice.',
  'Offer Workspace to Classic users',
  'Who uses which',
];

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
  it('r4-server-general shows the board (cards)', async () => {
    const { container } = renderCard();
    await screen.findByText('Classic 9 · Workspace 4');
    expect(check.must).toEqual(expect.arrayContaining(CARD_MUST));
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    for (const s of CARD_MUST) expect(text).toContain(s);
    for (const s of check.absent) expect(text).not.toContain(s);
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
