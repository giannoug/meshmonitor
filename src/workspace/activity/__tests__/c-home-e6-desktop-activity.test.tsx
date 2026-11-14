/**
 * @vitest-environment jsdom
 *
 * Board c-home-e6-desktop-activity: the bell in the sidebar header (badged
 * while anything is unseen) opens ActivityPanel, a right sheet with Mark all
 * read and the Settings › Notifications line. A row opens the conversation
 * and closes the panel.
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
const sidebar = () => screen.findByRole('complementary', { name: 'Station G2' });
const panel = () => screen.findByRole('dialog', { name: /Activity/ });

async function openPanel(opts: Parameters<typeof renderChat>[1] = {}) {
  const result = renderChat(`${g2}/channel/0`, opts);
  fireEvent.click(await within(await sidebar()).findByRole('button', { name: 'Activity, 3 unread' }));
  await within(await panel()).findByText(/replied in #LongFast/);
  return result;
}

describe('c-home-e6-desktop-activity', () => {
  it('c-home-e6-desktop-activity shows the board', async () => {
    await openPanel();
    await within(await sidebar()).findByText('12 online');
    expectBoard('c-home-e6-desktop-activity', document.body);
  });

  it('the bell badges the unseen count and the panel names the device', async () => {
    await openPanel();
    const d = within(await panel());
    expect(d.getByRole('heading', { name: 'Activity · Station G2' })).toBeInTheDocument();
    expect(d.getByRole('link', { name: 'Settings › Notifications' })).toHaveAttribute('href', `${g2}/settings/notifications`);
  });

  it('Mark all read writes the newest item time and clears the bell badge', async () => {
    const prefs = prefsFixture(athensFixture.userPreferences);
    await openPanel({ fixtures: prefs.fixtures });
    fireEvent.click(within(await panel()).getByRole('button', { name: 'Mark all read' }));
    await waitFor(() =>
      expect(prefs.puts).toEqual([[`workspace.activity.${SOURCE_IDS.g2}`, athensFixture.activity[SOURCE_IDS.g2][0].timestamp]]),
    );
    expect(await within(await sidebar()).findByRole('button', { name: 'Activity' })).toBeInTheDocument();
  });

  it('a failed Mark all read says so and keeps the badge', async () => {
    await openPanel({
      fixtures: {
        'PUT /api/user/preferences/:key': () =>
          new Response(JSON.stringify({ success: false, error: 'boom', code: 'INTERNAL_ERROR' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
      },
    });
    fireEvent.click(within(await panel()).getByRole('button', { name: 'Mark all read' }));
    expect(await screen.findByText('Failed to mark activity as read. Please try again.')).toBeInTheDocument();
    expect(within(await sidebar()).getByRole('button', { name: 'Activity, 3 unread' })).toBeInTheDocument();
  });

  it('a row opens the conversation at that message and closes the panel', async () => {
    Element.prototype.scrollIntoView = () => {};
    await openPanel();
    fireEvent.click(within(await panel()).getByRole('button', { name: /Kifisia Rooftop replied in a DM/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Activity/ })).toBeNull());
    expect(await screen.findByRole('heading', { name: /Kifisia Rooftop/ })).toBeInTheDocument();
  });

  it('a MeshCore device has no bell (MeshCore chat is Phase 7)', async () => {
    renderChat(`/source/${SOURCE_IDS.heltec}/nodes`);
    const side = within(await screen.findByRole('complementary', { name: 'Heltec MeshCore' }));
    await side.findByText(/Connected/);
    expect(side.queryByRole('button', { name: /^Activity/ })).toBeNull();
  });
});
