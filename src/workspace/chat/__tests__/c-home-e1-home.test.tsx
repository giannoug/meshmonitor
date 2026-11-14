/**
 * @vitest-environment jsdom
 *
 * Board c-home-e1-home (and a-chat-D-phone's content, Ruling AF; its board
 * test is in shell/__tests__/a-chat-D-phone.test.tsx): the phone
 * device Home at `/source/:id`. Header (device, status, the other devices'
 * quick squares), the "Jump to…" search pill, the Map / Nodes / Automation /
 * Tools tiles, Channels with unread, the most recent DMs and "All direct
 * messages", over the tab bar. App is not mounted here (Ruling AD).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;

async function home(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(g2, { phone: true, ...opts });
  await screen.findByRole('link', { name: 'Athens Rover, 1 unread' });
  return result;
}

describe('c-home-e1-home', () => {
  it('c-home-e1-home shows the board', async () => {
    const { container } = await home();
    expectBoard('c-home-e1-home', container);
  });

  it('renders the Workspace Home on the phone, with App not mounted', async () => {
    await home();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('keeps the re-hosted App on a desktop /source/:id', async () => {
    renderChat(g2);
    expect(await screen.findByTestId('page-app')).toBeInTheDocument();
  });

  it('tiles lead to the shell destinations; Automation and Tools to the re-hosted pages', async () => {
    await home();
    const tiles = within(screen.getByRole('navigation', { name: 'Device tools' }));
    expect(tiles.getByRole('link', { name: 'Map' })).toHaveAttribute('href', `${g2}/nodes`);
    expect(tiles.getByRole('link', { name: /^Nodes · 12/ })).toHaveAttribute('href', `${g2}/nodes`);
    expect(tiles.getByRole('link', { name: 'Automation' })).toHaveAttribute('href', `${g2}/automation`);
    expect(tiles.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', `${g2}/info`);
  });

  it('lists channels with unread and the latest DMs, with All direct messages', async () => {
    await home();
    expect(screen.getByRole('link', { name: 'LongFast, 2 unread' })).toHaveAttribute('href', `${g2}/channel/0`);
    expect(screen.getByRole('link', { name: 'Kifisia Rooftop' })).toHaveAttribute('href', `${g2}/dm/!a1b2c301`);
    expect(screen.getByRole('link', { name: /All direct messages/ })).toHaveAttribute('href', `${g2}/dms`);
  });

  it('shows the other devices as quick squares, with their DM unread', async () => {
    await home();
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: 'Heltec MeshCore, 2 unread' })).toHaveAttribute('href', `/source/${SOURCE_IDS.heltec}`);
    expect(header.getByRole('link', { name: 'Rooftop RAK' })).toHaveAttribute('href', `/source/${SOURCE_IDS.rak}`);
    // Two at most; the switcher holds the rest.
    expect(header.queryByRole('link', { name: /Reticulum node/ })).toBeNull();
  });

  it('the Jump to pill opens message search as a page', async () => {
    await home();
    fireEvent.click(screen.getByRole('button', { name: /Search Messages/ }));
    expect(await screen.findByRole('dialog', { name: 'Search Messages' })).toBeInTheDocument();
  });

  it('a viewer without search permission gets no pill; without messages:read no DMs', async () => {
    renderChat(g2, { phone: true, permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } } });
    await screen.findByRole('navigation', { name: 'Device tools' });
    expect(screen.queryByRole('button', { name: /Search Messages/ })).toBeNull();
    expect(screen.queryByText('Direct messages')).toBeNull();
    expect(screen.queryByText('Channels')).toBeNull();
  });

  it('messages:read alone does not show Channels, as Classic (no channel_N:read, no Channel Database entry)', async () => {
    renderChat(g2, {
      phone: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } },
      fixtures: { 'GET /api/channel-database': () => ({ success: true, count: 0, data: [] }) },
    });
    expect(await screen.findByText('Direct messages')).toBeInTheDocument();
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/api/channel-database'))).toBe(true));
    expect(screen.queryByText('Channels')).toBeNull();
  });

  it('a viewer with only a Channel Database entry sees Channels, as Classic (App.tsx hasAnyChannelPermission)', async () => {
    renderChat(g2, {
      phone: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } },
      fixtures: {
        'GET /api/channel-database': () => ({
          success: true,
          count: 1,
          data: [{ id: 4, name: 'Athens Secret', pskLength: 32, pskPreview: 'ab…', description: null, isEnabled: true, enforceNameValidation: false }],
        }),
      },
    });
    expect(await screen.findByText('Channels')).toBeInTheDocument();
  });
});
