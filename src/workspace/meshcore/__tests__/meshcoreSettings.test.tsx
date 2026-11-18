/**
 * @vitest-environment jsdom
 *
 * A MeshCore radio's settings pages beyond the boards (Task 7.4, note s8n4):
 * every page opens (today's sections on the undrawn ones), MESHCORE_FIELDS
 * lists every row the kit pages draw (settings search finds them, mounted or
 * not), and the In MeshMonitor pages send today's one request per change,
 * nothing to the radio.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { MESHCORE_CATEGORIES } from '../../settings/categories';
import { MESHCORE_FIELDS } from '../settings/meshcoreSearch';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const settingsWrites: unknown[] = [];
const fixtures = {
  'POST /api/settings': (u: URL, init?: RequestInit) => {
    if (u.searchParams.get('sourceId') !== SOURCE_IDS.heltec) return undefined;
    settingsWrites.push(JSON.parse(String(init?.body)));
    return { success: true };
  },
  'POST /api/sources/:id/meshcore/saved-regions': () => ({ success: true, region: { id: 2, name: 'gr-pir', note: null, createdAt: 1, updatedAt: 1 } }),
};
const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const rowIds = () =>
  Array.from(document.querySelectorAll('[data-setting-id]'), (el) => el.getAttribute('data-setting-id')!).filter((id) => id.startsWith('meshcore.')).sort();

describe('every MeshCore page opens', () => {
  it.each(MESHCORE_CATEGORIES.filter((c) => !['adverts', 'clock'].includes(c.id)).map((c) => c.id))('%s', async (id) => {
    renderMeshCore(`${HELTEC}/settings/${id}`, { fixtures });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await waitFor(() => expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', `${HELTEC}/settings/${id}`));
    expect(await screen.findByRole('main')).toBeInTheDocument();
    await pause();
    // No raw i18n key on the page.
    expect(document.body.textContent).not.toMatch(/\b(workspace|meshcore)\.[a-z_]+\.[a-z_]+/);
  });

  it.each(['adverts', 'clock'])('a local repeater\'s %s', async (id) => {
    renderMeshCore(`${HELTEC}/settings/${id}`, { meshcore: { deviceType: 2 } });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await waitFor(() => expect(within(nav).getByRole('link', { current: 'page' })).toHaveAttribute('href', `${HELTEC}/settings/${id}`));
  });
});

describe('settings search over MeshCore pages (MESHCORE_FIELDS)', () => {
  const pages = [...new Set(MESHCORE_FIELDS.map((f) => f.categoryId))];

  it.each(pages)('MESHCORE_FIELDS lists every row of %s', async (id) => {
    renderMeshCore(`${HELTEC}/settings/${id}`, { fixtures });
    const first = MESHCORE_FIELDS.find((f) => f.categoryId === id)!;
    await waitFor(() => expect(document.querySelector(`[data-setting-id="${first.id}"]`)).not.toBeNull());
    await pause();
    expect(rowIds()).toEqual(MESHCORE_FIELDS.filter((f) => f.categoryId === id).map((f) => f.id).sort());
  });

  it('⌘, finds a row on a page that is not open, and opens the page at that row', async () => {
    renderMeshCore(`${HELTEC}/settings/name`);
    await screen.findByLabelText('Name');
    fireEvent.keyDown(document, { key: ',', ctrlKey: true, metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'spreading' } });
    expect(d.getByRole('option', { name: /Spreading Factor/ })).toHaveAttribute('href', `${HELTEC}/settings/radio#setting-meshcore.sf`);
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'observer' } });
    expect(d.getAllByRole('option').some((o) => o.getAttribute('href') === `${HELTEC}/settings/observer`)).toBe(true);
  });
});

describe('In MeshMonitor pages', () => {
  it('Receive-only: on at once; off asks first (today), each one POST /api/settings and nothing to the radio', async () => {
    settingsWrites.length = 0;
    const { log } = renderMeshCore(`${HELTEC}/settings/receive-only`, { fixtures });
    const toggle = await screen.findByRole('switch', { name: 'Strict receive-only (never transmit)' });
    fireEvent.click(toggle);
    await waitFor(() => expect(settingsWrites).toEqual([{ meshcoreReceiveOnly: true }]));
    expect(log.writes).toHaveLength(0);
  });

  it('Receive-only: turning it off asks in a sheet; Cancel sends nothing', async () => {
    settingsWrites.length = 0;
    renderMeshCore(`${HELTEC}/settings/receive-only`, {
      fixtures: { ...fixtures, 'GET /api/device/tx-status': (u: URL) => (u.searchParams.get('sourceId') === SOURCE_IDS.heltec ? { txEnabled: false, canTransmit: false } : undefined) },
    });
    const toggle = await screen.findByRole('switch', { name: 'Strict receive-only (never transmit)' });
    await waitFor(() => expect(toggle).toBeChecked());
    fireEvent.click(toggle);
    const sheet = await screen.findByRole('dialog', { name: 'Allow this MeshCore node to transmit again?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await pause();
    expect(settingsWrites).toHaveLength(0);
    fireEvent.click(toggle);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Allow transmitting' }));
    await waitFor(() => expect(settingsWrites).toEqual([{ meshcoreReceiveOnly: false }]));
  });

  it('Answer discovery requests carries its Sends line and saves once', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/connection`);
    const toggle = await screen.findByRole('switch', { name: 'Answer discovery requests' });
    expect(screen.getByText('When on, answers discovery requests over the air: zero-hop, rate-limited.')).toBeInTheDocument();
    fireEvent.click(toggle);
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/config/discoverable'))).toHaveLength(1));
    expect(log.writes).toHaveLength(1);
  });

  it('a Regions save is one MeshMonitor request and sends nothing to the radio', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/regions`, { fixtures });
    await screen.findByText('gr-ath');
    fireEvent.change(screen.getByRole('textbox', { name: 'Regions' }), { target: { value: 'gr-pir' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes('/saved-regions') && i?.method === 'POST')).toHaveLength(1));
    expect(log.writes).toHaveLength(0);
  });

  it('the In MeshMonitor pages need settings:read; a viewer without it keeps only On the radio', async () => {
    renderMeshCore(`${HELTEC}/settings/radio`, {
      permissions: { bySource: { [SOURCE_IDS.heltec]: { connection: { read: true, write: false }, configuration: { read: true, write: false } } } },
    });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await within(nav).findByRole('link', { name: 'Radio' });
    expect(within(nav).queryByRole('link', { name: 'Receive-only' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Console' })).toBeNull();
  });
});
