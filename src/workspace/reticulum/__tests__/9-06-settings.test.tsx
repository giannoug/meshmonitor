/**
 * @vitest-environment jsdom
 *
 * Boards 9-06 (LXMF identity), 9-07 (RNode radio), 9-13 (phone settings list)
 * and 9-15 (phone LXMF identity), in the shared settings frame (Task 7.6).
 * Save sends only what changed, once per press, and never announces;
 * Announce now is one announce per press, and its countdown sends nothing;
 * Apply is today's one PUT. RETICULUM_FIELDS lists every row (settings search).
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RETICULUM_CATEGORIES } from '../../settings/categories';
import { RETICULUM_FIELDS } from '../settings/reticulumSearch';
import { RNS_URL, renderReticulum } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const pause = (ms = 50) => act(async () => new Promise((r) => setTimeout(r, ms)));
const IDENTITY = `${RNS_URL}/settings/lxmf-identity`;
const RNODE = `${RNS_URL}/settings/rnode`;
const READ_ONLY = { bySource: { 'src-rns': { nodes: { read: true, write: false }, configuration: { read: true, write: false } } } };
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-setting-id]'), (el) => el.getAttribute('data-setting-id')!).filter((id) => id.startsWith('reticulum.')).sort();

afterEach(() => vi.restoreAllMocks());

describe('9-06-settings-identity', () => {
  it('9-06-settings-identity shows the board (read-only, during the cooldown)', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderReticulum(IDENTITY, { permissions: READ_ONLY, reticulum: { cooldownRemainingSeconds: 42 } });
    await screen.findByText('Announce now (42 s)');
    expectBoard('9-06-settings-identity', container);
    expect(screen.getByLabelText('Display name')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Announce now/ })).toBeDisabled();
  });

  it('Save sends only the changed name, once per press, and does not announce', async () => {
    const { log } = renderReticulum(IDENTITY);
    const name = await screen.findByLabelText('Display name');
    await waitFor(() => expect(name).toHaveValue('GI desk'));
    fireEvent.change(name, { target: { value: 'GI desk 2' } });
    const save = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(log.writes).toHaveLength(1));
    await pause();
    expect(log.writes).toEqual([{ method: 'PUT', path: '/api/sources/src-rns/reticulum/display-name', body: { name: 'GI desk 2' } }]);
  });

  it('Announce now shows its Sends line and sends one announce per press; the countdown sends nothing', async () => {
    const { log } = renderReticulum(IDENTITY, {
      fixtures: {
        'POST /api/sources/:id/reticulum/announce': () => ({ success: true, data: { announced: true } }),
      },
    });
    expect(await screen.findByText(/Sends 1 announce on every interface/)).toBeInTheDocument();
    expect(screen.getByText(/one Announce now every 60 s/)).toBeInTheDocument();
    const announce = screen.getByRole('button', { name: 'Announce now' });
    await waitFor(() => expect(announce).toBeEnabled());
    const before = log.writes.length;
    fireEvent.click(announce);
    await pause(1200);
    expect(log.writes.length).toBe(before);
    // The override answers without logging: count the requests themselves.
    const posts = vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).endsWith('/reticulum/announce') && i?.method === 'POST');
    expect(posts).toHaveLength(1);
  });

  it('9-15-settings-identity shows the board', async () => {
    const { container } = renderReticulum(IDENTITY, { phone: true, reticulum: { cooldownRemainingSeconds: 42 } });
    await screen.findByText('Announce now (42 s)');
    expectBoard('9-15-settings-identity', container);
  });
});

describe('9-07-settings-rnode', () => {
  it('9-07-settings-rnode shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderReticulum(RNODE);
    await screen.findByText('ESP32-S3');
    fireEvent.click(screen.getAllByRole('button', { name: 'Increase' })[0]);
    expect(await screen.findByText(/1 change in RNode radio/)).toBeInTheDocument();
    expectBoard('9-07-settings-rnode', container);
  });

  it('Apply is one PUT with the radio\'s values; Discard drops the edit', async () => {
    const { log } = renderReticulum(RNODE);
    await screen.findByText('ESP32-S3');
    fireEvent.click(screen.getAllByRole('button', { name: 'Increase' })[0]);
    const apply = await screen.findByRole('button', { name: 'Apply' });
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    await waitFor(() => expect(log.writes).toHaveLength(1));
    await pause();
    expect(log.writes).toEqual([
      {
        method: 'PUT',
        path: '/api/sources/src-rns/reticulum/radio-config',
        body: { frequency: 869525000, bandwidth: 250000, spreadingFactor: 9, codingRate: 5, txPower: 14, stAlock: 15, ltAlock: 5, radioState: true },
      },
    ]);
  });

  it('is not listed outside own mode, as today', async () => {
    renderReticulum(`${RNS_URL}/settings`, { reticulum: { mode: 'attach' } });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await within(nav).findByRole('link', { name: 'LXMF identity' });
    expect(within(nav).queryByRole('link', { name: /RNode radio/ })).toBeNull();
  });
});

describe('9-13-settings-list', () => {
  it('9-13-settings-list shows the board', async () => {
    const { container } = renderReticulum(`${RNS_URL}/settings`, { phone: true });
    await screen.findByText('LXMF identity');
    expect(screen.getByRole('link', { name: /Global Settings/ })).toHaveAttribute('href', '/server/general');
    expectBoard('9-13-settings-list', container);
  });

  it("today's Configuration URL opens the settings", async () => {
    renderReticulum(`${RNS_URL}/configuration`);
    expect(await screen.findByRole('heading', { level: 1, name: 'LXMF identity' })).toBeInTheDocument();
  });
});

describe('settings search over Reticulum pages (RETICULUM_FIELDS)', () => {
  it.each(RETICULUM_CATEGORIES.map((c) => c.id))('RETICULUM_FIELDS lists every row of %s', async (id) => {
    renderReticulum(`${RNS_URL}/settings/${id}`);
    const first = RETICULUM_FIELDS.find((f) => f.categoryId === id)!;
    await waitFor(() => expect(document.querySelector(`[data-setting-id="${first.id}"]`)).not.toBeNull());
    await pause();
    expect(rowIds()).toEqual(RETICULUM_FIELDS.filter((f) => f.categoryId === id).map((f) => f.id).sort());
  });

  it('⌘, finds a row on a page that is not open, and opens the page at that row', async () => {
    renderReticulum(IDENTITY);
    await screen.findByLabelText('Display name');
    fireEvent.keyDown(document, { key: ',', ctrlKey: true, metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'spreading' } });
    expect(d.getByRole('option', { name: /Spreading Factor.*RNode radio/ })).toHaveAttribute('href', `${RNS_URL}/settings/rnode#setting-reticulum.spreadingFactor`);
  });
});
