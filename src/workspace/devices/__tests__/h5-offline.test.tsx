/**
 * @vitest-environment jsdom
 *
 * Board h5 (Task 6.7): a desktop device that is offline. The history stays,
 * the composer stays but is off with the reason, a banner says why, and the
 * sidebar's status line opens the device's Connection card: today's status
 * word, the status reply's last error, Edit connection, and today's Connect /
 * Disconnect (one request per press, no confirm, as today).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture as A, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { renderDevices } from './devicesHarness';
import { deviceList } from '../../__fixtures__/devices';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const rak = `/source/${SOURCE_IDS.rak}/channel/0`;
const g2 = `/source/${SOURCE_IDS.g2}/channel/0`;
/** Rooftop RAK's stored history (the fixture serves G2's poll for it). */
const RAK_HISTORY = { 'GET /api/poll': () => A.poll };
const ok = () => ({ success: true });

/** Every request so far, as `METHOD /path?query`. */
function requests(): string[] {
  return vi.mocked(globalThis.fetch).mock.calls.map(([input, init]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    return `${init?.method ?? 'GET'} ${url.pathname}${url.search}`;
  });
}
const count = (req: string) => requests().filter((r) => r === req).length;
const bodyOf = (req: string) => {
  const call = vi.mocked(globalThis.fetch).mock.calls.find(([input, init]) => `${init?.method ?? 'GET'} ${new URL(String(input), 'http://localhost').pathname}` === req);
  return call?.[1]?.body ? JSON.parse(String(call[1].body)) : undefined;
};

async function openCard(statusLine: string | RegExp) {
  fireEvent.click(await screen.findByRole('button', { name: statusLine }));
  return within(await screen.findByRole('dialog', { name: 'Connection' }));
}

describe('h5 offline', () => {
  it('h5-offline shows the board', async () => {
    renderChat(rak, { fixtures: RAK_HISTORY });
    await screen.findByText('Glyfada Beach checking in');
    await openCard('Disconnected');
    expectBoard('h5-offline', document.body);
  });

  it('keeps the history and pauses sending, with the reason on the composer', async () => {
    renderChat(rak, { fixtures: RAK_HISTORY });
    await screen.findByText('Glyfada Beach checking in');
    const box = await screen.findByRole('combobox');
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('title', 'Sending is paused while Rooftop RAK is offline');
    expect(screen.getByText('Sending is paused while Rooftop RAK is offline')).toBeInTheDocument();
    for (const name of ['Send position', 'Bell']) expect(screen.getByRole('button', { name })).toBeDisabled();
    // Opening the channel marks it read, as today; nothing is sent.
    expect(requests().filter((r) => r.startsWith('POST ') && r !== 'POST /api/messages/mark-read')).toEqual([]);
  });

  it('the banner says why and opens the Connection card', async () => {
    renderChat(rak, { fixtures: RAK_HISTORY });
    const banner = (await screen.findByText(/Rooftop RAK is offline\. History stays here/)).closest('[role="status"]') as HTMLElement;
    fireEvent.click(within(banner).getByRole('button', { name: 'Connection' }));
    expect(await screen.findByRole('dialog', { name: 'Connection' })).toBeInTheDocument();
  });

  it('a device that retries on its own: today\'s word and Edit connection, no Connect or Disconnect; one connection read', async () => {
    renderChat(rak, { fixtures: RAK_HISTORY });
    const card = await openCard('Disconnected');
    expect(card.getByText('Connecting')).toBeInTheDocument();
    expect(card.getByText('Meshtastic node · 192.168.1.42:4403')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Edit connection' })).toHaveAttribute('href', `/server/devices?edit=${SOURCE_IDS.rak}`);
    expect(card.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(card.queryByRole('button', { name: 'Disconnect' })).toBeNull();
    await waitFor(() => expect(count(`GET /api/connection?sourceId=${SOURCE_IDS.rak}`)).toBe(1));
    expect(requests().filter((r) => r.startsWith('POST ') && r !== 'POST /api/messages/mark-read')).toEqual([]);
  });

  it('shows the status reply\'s last error', async () => {
    renderChat(`/source/${SOURCE_IDS.mqtt}/channel/0`, {
      fixtures: { 'GET /api/sources/:id/status': (u) => (u.pathname.includes(SOURCE_IDS.mqtt) ? { ...A.statuses[SOURCE_IDS.mqtt], connected: false, lastError: 'connection refused' } : A.statuses[u.pathname.split('/')[3]]) },
    });
    const card = await openCard('Disconnected');
    expect(card.getByText('Last error: connection refused')).toBeInTheDocument();
  });

  it('an MQTT mirror that is offline is not told sending is paused', async () => {
    renderChat(`/source/${SOURCE_IDS.mqtt}/channel/0`, {
      fixtures: { 'GET /api/sources/:id/status': (u) => (u.pathname.includes(SOURCE_IDS.mqtt) ? { ...A.statuses[SOURCE_IDS.mqtt], connected: false } : A.statuses[u.pathname.split('/')[3]]) },
    });
    const banner = (await screen.findByText('Athens MQTT is offline. History stays here.')).closest('[role="status"]') as HTMLElement;
    expect(banner).not.toHaveTextContent(/paused/);
    expect(screen.getByText(/no radio of its own/)).toBeInTheDocument();
  });

  it('Disconnect on a connected node: today\'s /api/connection/disconnect, once, with no confirm', async () => {
    renderChat(g2, { fixtures: { 'POST /api/connection/disconnect': ok } });
    const card = await openCard(/^Connected/);
    expect(count(`GET /api/connection?sourceId=${SOURCE_IDS.g2}`)).toBe(0);
    fireEvent.click(card.getByRole('button', { name: 'Disconnect' }));
    await screen.findByText('Disconnected from node');
    expect(count('POST /api/connection/disconnect')).toBe(1);
    expect(bodyOf('POST /api/connection/disconnect')).toEqual({ sourceId: SOURCE_IDS.g2 });
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('Connect after a user disconnect: today\'s /api/connection/reconnect, once', async () => {
    renderChat(g2, {
      fixtures: {
        'GET /api/sources/:id/status': (u) => ({ ...A.statuses[u.pathname.split('/')[3]], connected: false }),
        'GET /api/connection': () => ({ ...A.poll.connection, connected: false, userDisconnected: true }),
        'POST /api/connection/reconnect': () => ({ success: true, status: 'connecting' }),
      },
    });
    const card = await openCard('Disconnected');
    fireEvent.click(await card.findByRole('button', { name: 'Connect' }));
    await screen.findByText('Reconnecting to node...');
    expect(count('POST /api/connection/reconnect')).toBe(1);
    expect(bodyOf('POST /api/connection/reconnect')).toEqual({ sourceId: SOURCE_IDS.g2 });
  });

  it('Connect on a device that does not connect on its own: today\'s /api/sources/:id/connect, once', async () => {
    renderChat(rak, {
      fixtures: {
        ...RAK_HISTORY,
        'GET /api/sources': () => A.sources.map((s) => (s.id === SOURCE_IDS.rak ? { ...s, config: { ...s.config, autoConnect: false } } : s)),
        'POST /api/sources/:id/connect': ok,
      },
    });
    const card = await openCard('Disconnected');
    expect(card.getByText('Idle (manual)')).toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(count(`POST /api/sources/${SOURCE_IDS.rak}/connect`)).toBe(1));
    expect(card.getByRole('button', { name: 'Connecting…' })).toBeDisabled();
  });

  it('a viewer who may not manage the connection sees the state only', async () => {
    renderChat(rak, {
      fixtures: RAK_HISTORY,
      permissions: { bySource: { [SOURCE_IDS.rak]: { nodes: { read: true, write: false }, channel_0: { read: true, write: false } } } },
    });
    const card = await openCard('Disconnected');
    expect(card.getByText('Connecting')).toBeInTheDocument();
    expect(card.queryByRole('link', { name: 'Edit connection' })).toBeNull();
    expect(card.queryByRole('button', { name: /Connect|Disconnect/ })).toBeNull();
    expect(requests().some((r) => r.startsWith('GET /api/connection'))).toBe(false);
  });

  it('Escape closes the card only', async () => {
    renderChat(rak, { fixtures: RAK_HISTORY });
    await openCard('Disconnected');
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Connection' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Connection' })).toBeNull());
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});

describe('Server › Devices and the Connection card', () => {
  it('a row\'s status line opens its Connection card', async () => {
    renderDevices();
    const status = await screen.findByRole('button', { name: 'Rooftop RAK: Connecting' });
    fireEvent.click(status);
    const card = within(await screen.findByRole('dialog', { name: 'Connection' }));
    expect(card.getByText('Rooftop RAK')).toBeInTheDocument();
  });

  it('one connect per device: the row\'s Connect running holds the card\'s Connect, so only one POST is sent', async () => {
    const manual = deviceList().map((d) => (d.id === SOURCE_IDS.rak ? { ...d, config: { ...d.config, autoConnect: false } } : d));
    const { log } = renderDevices('/server/devices', { fixtures: { 'GET /api/sources': () => manual } });
    const row = (await screen.findAllByTestId('device-row')).find((r) => within(r).queryByText('Rooftop RAK'))!;
    fireEvent.click(within(row).getByRole('button', { name: 'More for Rooftop RAK' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Connect' }));
    const connects = () => log.writes.filter((w) => w.path === `/api/sources/${SOURCE_IDS.rak}/connect`).length;
    await waitFor(() => expect(connects()).toBe(1));
    fireEvent.click(within(row).getByRole('button', { name: 'Rooftop RAK: Idle (manual)' }));
    const card = within(await screen.findByRole('dialog', { name: 'Connection' }));
    const button = card.getByRole('button', { name: 'Connecting…' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(connects()).toBe(1);
  });

  it('?edit=<id> opens the edit flow on that device', async () => {
    renderDevices(`/server/devices?edit=${SOURCE_IDS.rak}`);
    expect(await screen.findByRole('dialog', { name: 'Edit device' })).toBeInTheDocument();
  });
});
