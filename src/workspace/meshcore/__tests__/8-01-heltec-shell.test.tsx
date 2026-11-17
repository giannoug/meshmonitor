/**
 * @vitest-environment jsdom
 *
 * Board 8-01 (desktop): Heltec MeshCore's shell and #athens. The sidebar
 * (tools, Channels, Rooms, Direct messages), the device bar with the two
 * adverts and their Sends lines, the channel header (Scope, Mute, Clear),
 * the messages (route details, heard-by, required repeater, resends left,
 * Sent as, ignored, New), the composer and its scoped Sends line. The Scope
 * menu and a message's actions are opened one at a time (D9c).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/channel/1`;
const GLY = 'Morning, anyone on the coast road? Testing a new antenna.';
const OWN = 'Heading to Glyfada, will report back on the coast road';

describe('8-01-heltec-shell', () => {
  it('8-01-heltec-shell shows the board', async () => {
    const { container } = renderMeshCore(route);
    await screen.findByText(GLY);
    await screen.findByText(OWN);
    const side = await screen.findByRole('complementary', { name: 'Heltec MeshCore' });
    await within(side).findByText('Athens Room');
    await within(side).findByText('Glyfada Beach');
    // The thread scrolled up from the bottom: Jump to bottom shows.
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 500 });
    log.scrollTop = 100;
    fireEvent.scroll(log);
    await screen.findByRole('button', { name: /Jump to Bottom/ });
    const page = container.textContent ?? '';
    // The Scope menu, then our message's actions (one at a time, D9c).
    fireEvent.click(screen.getByRole('button', { name: /^Scope: gr-att/ }));
    const scope = await screen.findByRole('menu', { name: /Send scope for # athens/ });
    const scopeText = scope.textContent ?? '';
    fireEvent.keyDown(scope, { key: 'Escape' });
    const own = screen.getByText(OWN).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(own).getByRole('button', { name: 'More actions' }));
    const more = own.textContent ?? '';
    expectBoard('8-01-heltec-shell', joined(page, scopeText, more));
  });

  it('lists the device tools, channels (virtual tagged), rooms by login state and direct messages', async () => {
    renderMeshCore(route);
    const side = await screen.findByRole('complementary', { name: 'Heltec MeshCore' });
    expect(await within(side).findByRole('link', { name: 'Map' })).toHaveAttribute('href', `${HELTEC}/map`);
    expect(within(side).getByRole('link', { name: /^Nodes/ })).toHaveAttribute('href', `${HELTEC}/nodes`);
    expect(within(side).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', `${HELTEC}/telemetry`);
    expect(within(side).getByRole('link', { name: 'Automations' })).toHaveAttribute('href', `${HELTEC}/automations`);
    expect(await within(side).findByRole('link', { name: /athens/ })).toHaveAttribute('href', `${HELTEC}/channel/1`);
    expect(within(side).getByText('Virtual · receive-only')).toBeInTheDocument();
    const kifisia = await within(side).findByRole('link', { name: /Kifisia BBS/ });
    expect(kifisia.querySelector('[data-room]')).toHaveAttribute('data-room', 'saved');
    expect(within(side).getByRole('link', { name: /Psychiko Board/ }).querySelector('[data-room]')).toHaveAttribute('data-room', 'off');
    // Direct messages open today's DM view with that contact.
    expect(await within(side).findByRole('link', { name: /Glyfada Beach/ })).toHaveAttribute('href', expect.stringContaining(`${HELTEC}/dm/6a1b0188`));
    // More tools… holds Info and Packet monitor (and today's other tabs).
    fireEvent.click(within(side).getByRole('button', { name: 'More tools…' }));
    const tools = await screen.findByRole('menu', { name: 'More tools…' });
    expect(within(tools).getByRole('menuitem', { name: /Info/ })).toBeInTheDocument();
    expect(within(tools).getByRole('menuitem', { name: /Packet Monitor/ })).toBeInTheDocument();
  });

  it('the composer says what Send transmits, and Send posts once with no scope override', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText(GLY);
    expect(await screen.findByText('Sends 1 flood message, scoped to gr-att')).toBeInTheDocument();
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'On my way' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/meshcore/messages/send'))).toHaveLength(1));
    expect(log.writes.find((w) => w.path.endsWith('/messages/send'))!.body).toEqual({ text: 'On my way', channelIdx: 1 });
  });

  it('Unscoped flood in the Scope menu sends the next message unscoped', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText(GLY);
    fireEvent.click(await screen.findByRole('button', { name: /^Scope: gr-att/ }));
    const menu = await screen.findByRole('menu', { name: /Send scope/ });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Unscoped flood/ }));
    expect(await screen.findByText('Sends 1 flood message; every repeater forwards it')).toBeInTheDocument();
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'Unscoped hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(log.writes.find((w) => w.path.endsWith('/messages/send'))?.body).toEqual({ text: 'Unscoped hello', channelIdx: 1, scope: '' }));
  });

  it('Advert nearby sends one advert per press; Flood asks first with today\'s words', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText(GLY);
    expect(screen.getByText('Nearby: Sends 1 advert to nodes in direct range; repeaters do not forward it')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Advert (nearby, zero-hop)' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/meshcore/advert'))).toHaveLength(1));
    expect(log.writes[0].body).toEqual({ mode: 'zero_hop' });
    fireEvent.click(screen.getByRole('button', { name: 'Flood advert' }));
    const sheet = await screen.findByRole('dialog', { name: 'Send a flood advert?' });
    expect(sheet).toHaveTextContent('A flood advert is repeated by every repeater within 8 hops.');
    expect(log.writes.filter((w) => w.path.endsWith('/meshcore/advert'))).toHaveLength(1);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send flood advert' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/meshcore/advert'))).toHaveLength(2));
    expect(log.writes[1].body).toEqual({ mode: 'flood' });
  });

  it('Resend asks first, with the resends left, and sends once', async () => {
    const { log } = renderMeshCore(route);
    const own = (await screen.findByText(OWN)).closest('[data-message-id]') as HTMLElement;
    expect(own).toHaveTextContent('2 of 3 resends left for this message.');
    fireEvent.click(within(own).getByRole('button', { name: 'More actions' }));
    fireEvent.click(within(own).getByRole('button', { name: /^Resend/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Resend message?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(log.writes.filter((w) => /\/messages\/m-own\/resend$/.test(w.path))).toHaveLength(1));
  });

  it('the New line sits above the first message past the last-read mark', async () => {
    renderMeshCore(route);
    const nikos = (await screen.findByText('Hearing Lycabettus loud and clear from Marousi')).closest('[data-message-id]') as HTMLElement;
    const line = await screen.findByRole('separator', { name: 'New messages' });
    expect(line.nextElementSibling).toBe(nikos);
  });

  it('opening the channel and a re-render of the whole tree send nothing', async () => {
    const { log, rerenderWorkspace } = renderMeshCore(route);
    await screen.findByText(OWN);
    await new Promise((r) => setTimeout(r, 300));
    const before = vi.mocked(fetch).mock.calls.length;
    expect(log.writes).toHaveLength(0);
    // Every component re-renders with its state kept (as a settings save or a socket push causes).
    rerenderWorkspace();
    rerenderWorkspace();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText(OWN)).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.slice(before).filter(([, i]) => (i?.method ?? 'GET') !== 'GET')).toHaveLength(0);
  });

  it('Enter in the flood confirm sends nothing; only the button does', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText(GLY);
    fireEvent.click(screen.getByRole('button', { name: 'Flood advert' }));
    const sheet = await screen.findByRole('dialog', { name: 'Send a flood advert?' });
    fireEvent.keyDown(sheet, { key: 'Enter' });
    fireEvent.submit(sheet.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 100));
    expect(log.writes.filter((w) => w.path.endsWith('/meshcore/advert'))).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Send a flood advert?' })).toBeInTheDocument();
  });

  it('Enter in the resend confirm sends nothing; only the button does', async () => {
    const { log } = renderMeshCore(route);
    const own = (await screen.findByText(OWN)).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(own).getByRole('button', { name: 'More actions' }));
    fireEvent.click(within(own).getByRole('button', { name: /^Resend/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Resend message?' });
    fireEvent.keyDown(sheet, { key: 'Enter' });
    fireEvent.submit(sheet.querySelector('form')!);
    await new Promise((r) => setTimeout(r, 100));
    expect(log.writes.filter((w) => w.path.endsWith('/resend'))).toHaveLength(0);
  });

  it('region discovery runs once, on the first open of the Scope menu', async () => {
    const { log } = renderMeshCore(route);
    await screen.findByText(OWN);
    expect(log.writes.filter((w) => w.path.endsWith('/regions/discover'))).toHaveLength(0);
    const scope = await screen.findByRole('button', { name: /^Scope: gr-att/ });
    fireEvent.click(scope);
    const menu = await screen.findByRole('menu', { name: /Send scope/ });
    expect(menu).toHaveTextContent('Opening this the first time asks nearby repeaters for their regions (zero-hop, once)');
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/regions/discover'))).toHaveLength(1));
    fireEvent.click(scope);
    fireEvent.click(scope);
    await new Promise((r) => setTimeout(r, 100));
    expect(log.writes.filter((w) => w.path.endsWith('/regions/discover'))).toHaveLength(1);
    expect(await within(await screen.findByRole('menu', { name: /Send scope/ })).findByText('gr-pir')).toBeInTheDocument();
  });

  it('a virtual channel shows the receive-only note in place of the composer', async () => {
    renderMeshCore(`${HELTEC}/channel/9`);
    expect(await screen.findByRole('heading', { name: '# Athens Ops' })).toBeInTheDocument();
    expect(await screen.findByText(/receive-only/i, { selector: '[role="note"], [role="note"] *' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
