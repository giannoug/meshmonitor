/**
 * @vitest-environment jsdom
 *
 * Board c-home-e3-dms (phone): the DM inbox at `/source/:id/dms`. One row per
 * conversation with its last message (ours prefixed "You:"), time and unread,
 * each opening the DM. App is not mounted here. Its filters, Mark All Read
 * and Pin are 10-11-dm-inbox.test.tsx.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
const inbox = () => screen.findByRole('list', { name: 'Direct messages' });

async function open(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(`${g2}/dms`, { phone: true, ...opts });
  await within(await inbox()).findByText('You: Thanks!');
  return result;
}

beforeEach(() => localStorage.removeItem('meshmonitor-sticky-dm-nodes'));

describe('c-home-e3-dms', () => {
  it('c-home-e3-dms shows the board', async () => {
    const { container } = await open();
    expectBoard('c-home-e3-dms', container);
  });

  it('App is not mounted on /dms, phone or desktop', async () => {
    await open();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('App is not mounted on a desktop /dms either', async () => {
    renderChat(`${g2}/dms`);
    await within(await inbox()).findByText('You: Thanks!');
    expect(screen.queryByTestId('page-app')).toBeNull();
    // A desktop page, not the phone layout (its header padding and 44 px targets are the phone's).
    expect(screen.getByRole('heading', { name: 'Direct messages' }).closest('[data-phone]')).toBeNull();
  });

  it('lists conversations newest first, unread first, each linking to its DM', async () => {
    await open();
    const rows = within(await inbox()).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([`${g2}/dm/!a1b2c302`, `${g2}/dm/!a1b2c301`]);
    expect(rows[0]).toHaveTextContent('Heading up Hymettus, will relay this morning');
  });

  it('the search field finds a conversation by its text, and any node by name', async () => {
    await open();
    const search = screen.getByRole('searchbox', { name: 'Filter nodes or messages...' });
    fireEvent.change(search, { target: { value: 'traceroute' } });
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Direct messages' })).getAllByRole('link').map((r) => r.getAttribute('href'))).toEqual([
        `${g2}/dm/!a1b2c301`,
      ]),
    );
    fireEvent.change(search, { target: { value: 'Glyfada' } });
    expect(await within(screen.getByRole('list', { name: 'Direct messages' })).findByRole('link', { name: /Glyfada Beach/ })).toHaveAttribute(
      'href',
      `${g2}/dm/!a1b2c303`,
    );
  });

  it('the pencil (Message a node) moves to the search field', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Message a node' }));
    expect(screen.getByRole('searchbox', { name: 'Filter nodes or messages...' })).toHaveFocus();
  });

  it('has its own header (no device header) and the DMs tab is current', async () => {
    await open();
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Tabs' })).getByRole('link', { name: /^DMs/ })).toHaveAttribute('aria-current', 'page');
  });

  it('without messages:read shows no conversations', async () => {
    renderChat(`${g2}/dms`, { phone: true, permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false } } } } });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Direct messages' })).toBeNull();
  });
});
