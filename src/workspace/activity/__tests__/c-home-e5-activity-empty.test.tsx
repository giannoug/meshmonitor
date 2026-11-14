/**
 * @vitest-environment jsdom
 *
 * Board c-home-e5-activity-empty (phone): a device with no activity shows the
 * e5 copy through StateView, with the link to its notification settings. An
 * empty first page that still has `nextBefore` offers Load More (Ruling AT).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const rak = `/source/${SOURCE_IDS.rak}`;

describe('c-home-e5-activity-empty', () => {
  it('c-home-e5-activity-empty shows the board', async () => {
    const { container } = renderChat(`${rak}/activity`, { phone: true });
    await screen.findByText('Nothing about Rooftop RAK yet');
    expectBoard('c-home-e5-activity-empty', container);
  });

  it('the empty state links to the device’s notification settings, and offers no Load More', async () => {
    renderChat(`${rak}/activity`, { phone: true });
    expect(await screen.findByRole('link', { name: 'Choose what also pushes to this phone' })).toHaveAttribute(
      'href',
      `${rak}/settings/notifications`,
    );
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
    // Nothing unseen: no badge.
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page');
  });

  it('an empty first page with nextBefore set offers Load More, which pages on (Ruling AT)', async () => {
    renderChat(`${rak}/activity`, {
      phone: true,
      fixtures: {
        'GET /api/sources/:id/activity': (url: URL) => ({
          success: true,
          data: url.searchParams.has('before')
            ? { items: [{ kind: 'mention', id: 'm1', targetMessageId: null, conversation: { type: 'channel', channel: 0 },
                fromId: '!a1b2c303', fromName: 'Glyfada Beach', text: 'hi @!a1b2c300', timestamp: 1_000 }], nextBefore: null }
            : { items: [], nextBefore: 5_000 },
        }),
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Load More' }));
    await screen.findByText(/Glyfada Beach/);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull());
  });
});
