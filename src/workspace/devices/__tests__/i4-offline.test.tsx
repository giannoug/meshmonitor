/**
 * @vitest-environment jsdom
 *
 * Board i4 (Task 6.7): the phone Home of an offline device. A banner under
 * the header says the history is here and sending is paused; tapping it opens
 * the Connection sheet (the same card as h5, from the bottom).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { athensFixture as A, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const rakHome = `/source/${SOURCE_IDS.rak}`;
const RAK_HISTORY = { 'GET /api/poll': () => A.poll };

async function openSheet() {
  fireEvent.click(await screen.findByRole('button', { name: /Rooftop RAK is offline\. History is here; sending is paused\./ }));
  return within(await screen.findByRole('dialog', { name: 'Connection' }));
}

describe('i4 offline', () => {
  it('i4-offline shows the board', async () => {
    renderChat(rakHome, { phone: true, fixtures: RAK_HISTORY });
    await openSheet();
    expectBoard('i4-offline', document.body);
  });

  it('the banner opens the Connection sheet, with the device and Edit connection', async () => {
    renderChat(rakHome, { phone: true, fixtures: RAK_HISTORY });
    const sheet = await openSheet();
    expect(sheet.getByText('Rooftop RAK')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Edit connection' })).toHaveAttribute('href', `/server/devices?edit=${SOURCE_IDS.rak}`);
    fireEvent.click(sheet.getByRole('link', { name: 'Edit connection' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Connection' })).toBeNull());
  });

  it('the header\'s status line is its own button and opens the Connection sheet', async () => {
    renderChat(rakHome, { phone: true, fixtures: RAK_HISTORY });
    fireEvent.click(await screen.findByRole('button', { name: 'Rooftop RAK: Disconnected' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Connection' }));
    expect(sheet.getByText('Rooftop RAK')).toBeInTheDocument();
  });

  it('the square and name still open the switcher, not the card', async () => {
    renderChat(rakHome, { phone: true, fixtures: RAK_HISTORY });
    fireEvent.click(await screen.findByRole('button', { name: 'Rooftop RAK: switch device' }));
    expect(await screen.findByRole('dialog', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Connection' })).toBeNull();
  });

  it('the status line and the switcher share no hit area: separate buttons, neither inside the other', async () => {
    renderChat(rakHome, { phone: true, fixtures: RAK_HISTORY });
    const switcher = await screen.findByRole('button', { name: 'Rooftop RAK: switch device' });
    const status = await screen.findByRole('button', { name: 'Rooftop RAK: Disconnected' });
    expect(status).not.toBe(switcher);
    expect(switcher.contains(status)).toBe(false);
    expect(status.contains(switcher)).toBe(false);
    // The 44 px square is the switcher's; the status line holds only the dot and the words.
    expect(within(switcher).getByText('RR')).toBeInTheDocument();
    expect(status).toHaveTextContent(/^Disconnected$/);
  });

  it('a non-admin with connection:write reaches today\'s Disconnect from the phone status line', async () => {
    const R = { read: true, write: false };
    renderChat(`/source/${SOURCE_IDS.g2}`, {
      phone: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { connection: { read: true, write: true }, nodes: R, messages: R, channel_0: R } } },
      fixtures: { 'POST /api/connection/disconnect': () => ({ success: true }) },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Station G2: Connected · 12 online' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Connection' }));
    expect(sheet.queryByRole('link', { name: 'Edit connection' })).toBeNull();
    fireEvent.click(sheet.getByRole('button', { name: 'Disconnect' }));
    await screen.findByText('Disconnected from node');
    const posts = vi.mocked(globalThis.fetch).mock.calls.filter(([u, init]) => init?.method === 'POST' && String(u).includes('/api/connection/disconnect'));
    expect(posts).toHaveLength(1);
  });

  it('a connected device shows no banner', async () => {
    renderChat(`/source/${SOURCE_IDS.g2}`, { phone: true });
    await screen.findByRole('link', { name: 'Athens Rover, 1 unread' });
    expect(screen.queryByText(/is offline/)).toBeNull();
  });
});
