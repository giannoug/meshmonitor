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
  'Default device for guests',
];

/** `/api/settings` that keeps what is posted. */
function settingsFixture() {
  const settings: Record<string, string> = { ...athensFixture.settings };
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

function renderCard(opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
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

  it('shows the stored values: default layout, banner offer, usage and the guests device', async () => {
    renderCard();
    expect(await screen.findByRole('combobox', { name: 'Default layout for new users' })).toHaveDisplayValue('Classic');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Offer Workspace to Classic users' })).toBeChecked());
    expect(within(row('Who uses which')).getByText('Signed-in users, last 30 days')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Default device for guests' })).toHaveDisplayValue('Station G2'),
    );
    // Today's options: Automatic, then the Meshtastic TCP sources only.
    const options = within(screen.getByRole('combobox', { name: 'Default device for guests' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Automatic (first started)', 'Station G2', 'Rooftop RAK']);
  });

  it('autosaves each control with a Saved tick', async () => {
    const s = settingsFixture();
    renderCard({ fixtures: s.fixtures });
    const layout = await screen.findByRole('combobox', { name: 'Default layout for new users' });
    fireEvent.change(layout, { target: { value: 'workspace' } });
    await waitFor(() => expect(within(row('Default layout for new users')).getByText('Saved')).toBeInTheDocument());

    const offer = screen.getByRole('switch', { name: 'Offer Workspace to Classic users' });
    await waitFor(() => expect(offer).toBeChecked());
    fireEvent.click(offer);
    await waitFor(() => expect(within(row('Offer Workspace to Classic users')).getByText('Saved')).toBeInTheDocument());

    const guests = screen.getByRole('combobox', { name: 'Default device for guests' });
    await waitFor(() => expect(guests).toHaveDisplayValue('Station G2'));
    fireEvent.change(guests, { target: { value: SOURCE_IDS.rak } });
    await waitFor(() => expect(within(row('Default device for guests')).getByText('Saved')).toBeInTheDocument());

    expect(s.posts).toEqual([
      { defaultLayout: 'workspace' },
      { offerWorkspaceBanner: 'false' },
      { defaultMeshtasticSourceId: SOURCE_IDS.rak },
    ]);
  });

  it('a failed save puts the old value back and says so', async () => {
    renderCard({
      fixtures: {
        'POST /api/settings': () => new Response(JSON.stringify({ success: false, error: 'nope' }), { status: 500 }),
      },
    });
    const layout = await screen.findByRole('combobox', { name: 'Default layout for new users' });
    fireEvent.change(layout, { target: { value: 'workspace' } });
    expect(await screen.findByText('Failed to save settings')).toBeInTheDocument();
    expect(layout).toHaveDisplayValue('Classic');
    expect(screen.queryByText('Saved')).toBeNull();
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
