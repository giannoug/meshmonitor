/**
 * @vitest-environment jsdom
 *
 * Board 10-15 (desktop): message search, today's SearchModal moved into the
 * shell (note s10n5). The Search Messages field at the top of the device
 * sidebar, or ⌘K / Ctrl+K, opens it as a dialog over the conversation; it
 * searches the open device with today's filters, 25 at a time; picking a
 * result opens its conversation and closes search.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const sidebar = () => screen.findByRole('complementary', { name: 'Station G2' });
const dialog = () => screen.findByRole('dialog', { name: 'Search Messages' });

async function search(route = `${g2}/channel/0`, opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(route, opts);
  // The page's poll is in (search reads the device's channels and nodes from it).
  await within(await sidebar()).findByRole('link', { name: /LongFast/ });
  fireEvent.click(within(await sidebar()).getByRole('button', { name: /^Search Messages/ }));
  const d = within(await dialog());
  fireEvent.change(d.getByRole('textbox', { name: 'Search for text in messages...' }), { target: { value: 'relay' } });
  fireEvent.click(d.getByRole('button', { name: 'Search' }));
  await d.findByText('Showing 5 of 31 results');
  return { ...result, d };
}

afterEach(() => vi.restoreAllMocks());

describe('10-15-search-messages', () => {
  it('10-15-search-messages shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    await search();
    // The dialog is portaled to <body>, beside the sidebar's field and its ⌘K hint.
    expectBoard('10-15-search-messages', document.body);
  });

  it('searches the open device with today\'s parameters, 25 at a time', async () => {
    await search();
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/api/messages/search'));
    const url = new URL(String(call![0]), 'http://localhost');
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: 'relay', limit: '25', sourceId: SOURCE_IDS.g2 });
  });

  it('labels a result with its channel or DM peer, sender and highlight', async () => {
    const { d } = await search();
    const dm = d.getByRole('button', { name: /DM with Kifisia Rooftop/ });
    expect(dm).toHaveTextContent('Kifisia Rooftop (KFR)');
    expect(within(dm).getByText('relay', { selector: 'mark' })).toBeInTheDocument();
    expect(d.getByRole('button', { name: /Anyone hearing the Hymettus relay/ })).toHaveTextContent('Channel LongFast');
  });

  it('picking a result navigates to its conversation and closes search', async () => {
    const { d } = await search();
    fireEvent.click(d.getByRole('button', { name: /DM with Kifisia Rooftop/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
    expect(await screen.findByTestId('dm-header')).toBeInTheDocument();
  });

  it('a channel result opens /channel/:n', async () => {
    const { d } = await search(`${g2}/dms`);
    fireEvent.click(d.getByRole('button', { name: /Relay rebooted at 07:40/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
    expect(await screen.findByRole('heading', { name: /Athens Ops/ })).toBeInTheDocument();
  });

  it('Escape closes search, as today\'s modal', async () => {
    await search();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
  });

  it('keeps the search across close and reopen, as today\'s always-mounted modal', async () => {
    const { d } = await search();
    fireEvent.click(d.getByRole('button', { name: /Anyone hearing the Hymettus relay/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const again = within(await dialog());
    expect(again.getByRole('textbox', { name: 'Search for text in messages...' })).toHaveValue('relay');
    expect(again.getByText('Showing 5 of 31 results')).toBeInTheDocument();
  });

  it('another device starts a blank search', async () => {
    const { d } = await search();
    fireEvent.click(d.getByRole('button', { name: 'Close' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Devices' })).getByRole('link', { name: /^Athens MQTT/ }));
    const side = within(await screen.findByRole('complementary', { name: 'Athens MQTT' }));
    fireEvent.click(side.getByRole('button', { name: /^Search Messages/ }));
    const fresh = within(await dialog());
    expect(fresh.getByRole('textbox', { name: 'Search for text in messages...' })).toHaveValue('');
    expect(fresh.queryByText(/Showing/)).toBeNull();
  });

  it.each([
    // The poll's own rows, so the opened conversation holds them: a DM (Athens Rover) and a LongFast message.
    ['a DM', 5, 0xa1b2c302, '!a1b2c300', -1, 'Heading up Hymettus, will relay this morning'],
    ['a channel message', 3, 0xa1b2c303, '!ffffffff', 0, 'Glyfada Beach checking in'],
  ])('picking %s scrolls to it and highlights it, as today', async (_kind, n, fromNum, toNodeId, channel, text) => {
    const id = `${SOURCE_IDS.g2}_${fromNum}_${n}`;
    const hit = { ...athensFixture.searchResults[0], id, fromNodeId: `!${fromNum.toString(16)}`, fromNodeNum: fromNum, toNodeId, channel, text };
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { d } = await search(channel === -1 ? `${g2}/channel/0` : `${g2}/dms`, {
      fixtures: { 'GET /api/messages/search': () => ({ success: true, count: 5, total: 31, data: [hit, ...athensFixture.searchResults.slice(1)] }) },
    });
    fireEvent.click(d.getByRole('button', { name: new RegExp(text.slice(0, 20)) }));
    await waitFor(() => {
      const row = document.querySelector(`[data-message-id="${id}"]`)!;
      expect(row).not.toBeNull();
      expect(scroll.mock.contexts).toContain(row);
      expect(row.className).toMatch(/searchHighlight/);
    });
  });

  it('Load More asks for the next page', async () => {
    const { d } = await search();
    fireEvent.click(d.getByRole('button', { name: 'Load More' }));
    await waitFor(() => {
      const calls = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/api/messages/search'));
      expect(new URL(String(calls.at(-1)![0]), 'http://localhost').searchParams.get('offset')).toBe('5');
    });
  });

  it('⌘K and Ctrl+K toggle search; ⌘, does not open it', async () => {
    renderChat(`${g2}/channel/0`);
    await sidebar();
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(await dialog()).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
  });

  it('⌘K works with focus in a text field, as App\'s handler', async () => {
    renderChat(`${g2}/channel/0`);
    await screen.findByText('Glyfada Beach checking in');
    const box = document.querySelector('textarea')!;
    box.focus();
    fireEvent.keyDown(box, { key: 'k', metaKey: true });
    expect(await dialog()).toBeInTheDocument();
  });

  it('shows Ctrl+K off a Mac', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    renderChat(`${g2}/channel/0`);
    expect(within(await sidebar()).getByRole('button', { name: /^Search Messages/ })).toHaveTextContent('Ctrl+K');
  });

  it('Direct Messages Only needs messages:read', async () => {
    renderChat(`${g2}/channel/0`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: true } } } },
    });
    fireEvent.click(within(await sidebar()).getByRole('button', { name: /^Search Messages/ }));
    const d = within(await dialog());
    const scope = d.getByRole('combobox', { name: 'Scope' });
    expect(within(scope).queryByRole('option', { name: 'Direct Messages Only' })).toBeNull();
    expect(within(scope).getByRole('option', { name: 'Channels Only' })).toBeInTheDocument();
    // The channel filter lists only the channels the viewer can read.
    expect(within(d.getByRole('combobox', { name: 'Channels' })).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All Messages',
      'LongFast',
    ]);
  });

  it('a viewer with no messages:read and no channel read has no search', async () => {
    renderChat(`${g2}/nodes`, { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } } });
    const side = within(await sidebar());
    expect(side.queryByRole('button', { name: /^Search Messages/ })).toBeNull();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull();
  });

  it('is scoped to the device: a MeshCore device has no search here', async () => {
    renderChat(`/source/${SOURCE_IDS.heltec}/nodes`);
    const side = within(await screen.findByRole('complementary', { name: 'Heltec MeshCore' }));
    expect(side.queryByRole('button', { name: /^Search Messages/ })).toBeNull();
  });
});
