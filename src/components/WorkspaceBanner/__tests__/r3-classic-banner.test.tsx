/**
 * @vitest-environment jsdom
 *
 * Board r3-classic-banner (Task 1.8): the Classic entry points to the
 * Workspace, the banner and the user-menu item (D18), switched on by Task 9.3.
 * The board's tab names are today's Classic chrome (unchanged; the 1.4 chrome
 * snapshot guards it) and "Classic layout, unchanged" is the board's caption,
 * so only the banner's must strings are checked.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../../workspace/test/renderWorkspace';
import { athensFixture } from '../../../workspace/__fixtures__/athens';
import { prefsFixture } from '../../../workspace/__fixtures__/prefsFixture';
import { ShellContext } from '../../../contexts/ShellContext';
import UserMenu from '../../UserMenu';
import WorkspaceBanner from '../WorkspaceBanner';

const check = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../workspace/__fixtures__/board-checks/r3-classic-banner.json'),
    'utf8',
  ),
) as { must: string[]; absent: string[] };

const BANNER_MUST = ['Try the Workspace layout.', 'Try it', 'Not now', 'You › Layout'];

const offer = (on: boolean) => () => ({ ...athensFixture.settings, offerWorkspaceBanner: String(on) });

function renderBanner(prefs: Record<string, unknown> = {}, opts: RenderWorkspaceOptions = {}) {
  const p = prefsFixture(prefs);
  const view = renderWorkspace(<WorkspaceBanner />, { ...opts, fixtures: { ...p.fixtures, ...opts.fixtures } });
  return { ...view, puts: p.puts };
}

const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

/** Lets every pending fetch settle, so "renders nothing" is not just "not yet". */
async function settle() {
  await waitFor(() => expect(urls().some((u) => u.includes('/api/auth/status'))).toBe(true));
  await new Promise((r) => setTimeout(r, 50));
}

describe('r3-classic-banner', () => {
  it('r3-classic-banner shows the board (banner)', async () => {
    const { container } = renderBanner();
    await screen.findByText('Try the Workspace layout.');
    expect(check.must).toEqual(expect.arrayContaining(BANNER_MUST));
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    for (const s of BANNER_MUST) expect(text).toContain(s);
    for (const s of check.absent) expect(text).not.toContain(s);
  });

  it('Try it saves layout=workspace', async () => {
    const { puts } = renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: 'Try it' }));
    await waitFor(() => expect(puts).toEqual([['layout', 'workspace']]));
  });

  it('Not now saves layout=classic and the dismissal, and the banner goes', async () => {
    const { puts } = renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(puts).toEqual([
        ['layout', 'classic'],
        ['workspace.bannerDismissed', true],
      ]),
    );
    await waitFor(() => expect(screen.queryByText('Try the Workspace layout.')).toBeNull());
  });

  it('the close button is Not now', async () => {
    const { puts } = renderBanner();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(puts).toEqual([['layout', 'classic'], ['workspace.bannerDismissed', true]]));
  });

  it.each([
    ['the user already picked a layout', { layout: 'classic' }, {}],
    ['the user dismissed it', { 'workspace.bannerDismissed': true }, {}],
    ['the admin does not offer it', {}, { fixtures: { 'GET /api/settings': offer(false) } }],
    ['nobody is signed in', {}, { anonymous: true }],
  ] as const)('stays hidden when %s', async (_why, prefs, opts) => {
    const { container } = renderBanner(prefs, opts);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('is not shown on a Classic page re-hosted in the Workspace', async () => {
    const p = prefsFixture();
    const { container } = renderWorkspace(
      <ShellContext.Provider value={{ embedded: true }}>
        <WorkspaceBanner />
      </ShellContext.Provider>,
      { fixtures: p.fixtures },
    );
    await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('the user menu item saves layout=workspace', async () => {
    const p = prefsFixture({ layout: 'classic' });
    renderWorkspace(<UserMenu />, { fixtures: p.fixtures });
    fireEvent.click(await screen.findByTitle(/Athens Ops/));
    fireEvent.click(await screen.findByRole('button', { name: 'Try the Workspace layout' }));
    await waitFor(() => expect(p.puts).toEqual([['layout', 'workspace']]));
  });

  it('an anonymous user has no user menu, so no menu item', async () => {
    const { container } = renderWorkspace(<UserMenu />, { anonymous: true });
    await settle();
    expect(container).toBeEmptyDOMElement();
  });
});
