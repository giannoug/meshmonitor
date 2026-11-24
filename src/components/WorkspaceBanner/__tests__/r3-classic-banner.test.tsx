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
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
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

const SAVE_FAILED = "Couldn't save your layout choice. Try again.";
const failingPut = {
  'PUT /api/user/preferences/:key': () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
};

const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

/** Lets every pending fetch settle, so "renders nothing" is not just "not yet". */
async function settle() {
  await waitFor(() => expect(urls().some((u) => u.includes('/api/auth/status'))).toBe(true));
  // Every request made so far has been answered; the render that follows is flushed by `act`.
  await act(async () => {
    await Promise.allSettled(vi.mocked(fetch).mock.results.map((r) => r.value));
  });
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
    await waitFor(() => expect(screen.queryByText('Try the Workspace layout.')).toBeNull());
  });

  it.each(['Try it', 'Not now', 'Dismiss'])('%s shows a message when the save fails', async (name) => {
    renderBanner({}, { fixtures: failingPut });
    fireEvent.click(await screen.findByRole('button', { name }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(screen.getByText('Try the Workspace layout.')).toBeTruthy();
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

  it('the user menu item shows the error, and keeps the menu open, when the save fails', async () => {
    const p = prefsFixture({ layout: 'classic' });
    renderWorkspace(<UserMenu />, { fixtures: { ...p.fixtures, ...failingPut } });
    fireEvent.click(await screen.findByTitle(/Athens Ops/));
    fireEvent.click(await screen.findByRole('button', { name: 'Try the Workspace layout' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
    expect(screen.getByRole('button', { name: 'Try the Workspace layout' })).toBeInTheDocument();
  });

  it('a double click on the user menu item sends one request', async () => {
    const p = prefsFixture({ layout: 'classic' });
    renderWorkspace(<UserMenu />, { fixtures: p.fixtures });
    fireEvent.click(await screen.findByTitle(/Athens Ops/));
    const item = await screen.findByRole('button', { name: 'Try the Workspace layout' });
    await waitFor(() => expect(item).toBeEnabled());
    fireEvent.click(item);
    fireEvent.click(item);
    await waitFor(() => expect(p.puts).toEqual([['layout', 'workspace']]));
    // The second click was dropped before it sent; the save's re-read has landed.
    await waitFor(() => expect(urls().filter((u) => u.endsWith('/api/user/preferences')).length).toBeGreaterThan(1));
    expect(p.puts).toEqual([['layout', 'workspace']]);
  });

  it('an anonymous user has no user menu, so no menu item', async () => {
    const { container } = renderWorkspace(<UserMenu />, { anonymous: true });
    await settle();
    expect(container).toBeEmptyDOMElement();
  });
});

// Shown, the banner is part of Classic's fixed top chrome: it sits below the
// header and extends `--app-header-height` on its shell by its own height, so
// every Classic surface (page padding, Nodes view, AppBanners) moves below it.
describe('r3-classic-banner offsets Classic below it', () => {
  let header: HTMLElement;
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    header = document.createElement('header');
    header.className = 'app-header';
    header.getBoundingClientRect = () => ({ bottom: 60, height: 60 }) as DOMRect;
    document.body.appendChild(header);
  });
  afterEach(() => {
    header.remove();
    vi.unstubAllGlobals();
  });

  it('while shown, sets the shell offset to header + banner; Not now clears it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return (this.tagName === 'SECTION' ? { bottom: 130, height: 70 } : { bottom: 0, height: 0 }) as DOMRect;
    });
    renderBanner();
    const banner = (await screen.findByText('Try the Workspace layout.')).closest('section')!;
    const shell = banner.parentElement!;
    expect(banner.style.top).toBe('60px');
    expect(shell.style.getPropertyValue('--app-header-height')).toBe('130px');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Try the Workspace layout.')).toBeNull());
    expect(shell.style.getPropertyValue('--app-header-height')).toBe('');
    vi.restoreAllMocks();
  });

  it('hidden, it sets nothing', async () => {
    const { container } = renderBanner({ layout: 'classic' });
    await settle();
    expect(container).toBeEmptyDOMElement();
    expect(container.style.getPropertyValue('--app-header-height')).toBe('');
  });
});
