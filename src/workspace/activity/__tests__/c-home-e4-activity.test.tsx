/**
 * @vitest-environment jsdom
 *
 * Board c-home-e4-activity (phone): `/source/:id/activity` on a Meshtastic-family
 * device, App not mounted (Ruling AD). Replies, collapsed reactions and
 * mentions of this device's node, grouped by day, unseen ones dotted, the tab
 * badged; a row opens its conversation at that message.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const feed = () => screen.findByRole('list', { name: 'Activity' });
const tabBar = () => screen.findByRole('navigation', { name: 'Tabs' });

async function open(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(`${g2}/activity`, { phone: true, ...opts });
  await within(await feed()).findByText(/replied in #LongFast/);
  return result;
}

describe('c-home-e4-activity', () => {
  it('c-home-e4-activity shows the board', async () => {
    const { container } = await open();
    expectBoard('c-home-e4-activity', container);
  });

  it('App is not mounted on /activity (one owner per screen)', async () => {
    await open();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('groups by day, collapses reactors, quotes our message and names the mention', async () => {
    await open();
    const list = within(await feed());
    expect(list.getByText('Today')).toBeInTheDocument();
    expect(list.getByText('Yesterday')).toBeInTheDocument();
    const rows = list.getAllByRole('button');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Marousi Mobile replied in #LongFast');
    expect(rows[0]).toHaveTextContent('to you: Welcome back! Hearing you direct from Kifisia');
    expect(rows[1]).toHaveTextContent('Athens Rover and 2 others reacted in #LongFast');
    expect(rows[1]).toHaveTextContent('👍 2');
    expect(rows[2]).toHaveTextContent('Piraeus Base mentioned you in #Athens Ops');
    expect(rows[2]).toHaveTextContent('@Station G2 are you hearing the Hymettus relay?');
    expect(rows[3]).toHaveTextContent('Kifisia Rooftop replied in a DM');
  });

  it('dots the items newer than the last-seen pref and badges the tab with their count', async () => {
    await open();
    expect(await within(await tabBar()).findByRole('link', { name: 'Activity, 3 unread' })).toHaveAttribute('href', `${g2}/activity`);
    const rows = within(await feed()).getAllByRole('button');
    expect(rows.map((r) => r.closest('li')!.hasAttribute('data-unseen'))).toEqual([true, true, true, false, false]);
  });

  it('Mark all read (in ⋯) writes the newest item time to the pref and clears the badge', async () => {
    const prefs = prefsFixture(athensFixture.userPreferences);
    await open({ fixtures: prefs.fixtures });
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    await waitFor(() =>
      expect(prefs.puts).toEqual([[`workspace.activity.${SOURCE_IDS.g2}`, athensFixture.activity[SOURCE_IDS.g2][0].timestamp]]),
    );
    await waitFor(() => expect(within(screen.getByRole('navigation', { name: 'Tabs' })).getByRole('link', { name: 'Activity' })).toBeInTheDocument());
  });

  it('a reaction opens its conversation at our reacted-to message', async () => {
    Element.prototype.scrollIntoView = () => {};
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    await open();
    fireEvent.click(within(await feed()).getByRole('button', { name: /Athens Rover and 2 others/ }));
    const target = `${SOURCE_IDS.g2}_${0xa1b2c300}_6`;
    await waitFor(() => {
      const row = document.querySelector(`[data-message-id="${target}"]`)!;
      expect(row).not.toBeNull();
      expect(scroll.mock.contexts).toContain(row);
      expect(row.className).toMatch(/searchHighlight/);
    });
  });

  it('a reply or mention opens its conversation at that message', async () => {
    Element.prototype.scrollIntoView = () => {};
    const glyfada = athensFixture.messages.find((m) => m.text === 'Glyfada Beach checking in')!;
    renderChat(`${g2}/activity`, {
      phone: true,
      fixtures: {
        'GET /api/sources/:id/activity': () => ({
          success: true,
          data: {
            items: [{ kind: 'mention', id: glyfada.id, targetMessageId: null, conversation: { type: 'channel', channel: 0 },
              fromId: glyfada.fromNodeId, fromName: 'Glyfada Beach', text: glyfada.text, timestamp: glyfada.timestamp }],
            nextBefore: null,
          },
        }),
      },
    });
    fireEvent.click(await within(await feed()).findByRole('button', { name: /Glyfada Beach mentioned you/ }));
    await waitFor(() => expect(document.querySelector(`[data-message-id="${glyfada.id}"]`)?.className).toMatch(/searchHighlight/));
  });

  it('MeshCore keeps today’s page: no Activity tab (MeshCore chat is Phase 7)', async () => {
    renderChat(`/source/${SOURCE_IDS.heltec}/channels`, { phone: true });
    const bar = within(await tabBar());
    expect(bar.queryByRole('link', { name: /^Activity/ })).toBeNull();
    expect(bar.getByText('Activity').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  });

  it('without read access to the device, the tab is disabled and the page says so', async () => {
    const permissions = { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } };
    renderChat(`${g2}/activity`, { phone: true, permissions });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    const bar = within(await tabBar());
    expect(bar.getByText('Activity').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/activity'))).toBe(false);
  });
});
