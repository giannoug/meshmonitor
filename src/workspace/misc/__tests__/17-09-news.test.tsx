/**
 * @vitest-environment jsdom
 *
 * Boards 17-09-news (desktop) and 17-16-news (phone), Task 9.2: today's news
 * popup (useNewsPopup) drawn as a Workspace sheet. It opens by itself once when
 * there are unread items, and closing it (Close on the last item, or ×)
 * dismisses every item it showed, Important ones included. Help & about ›
 * Show all news reopens the whole feed and dismisses nothing. The feed is read
 * when the sheet opens, as today; no interval.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { newsFixtures } from '../../__fixtures__/oddPages';
import { renderPrefs } from '../../you/preferences/__tests__/prefsHarness';

const T = { timeout: 10_000 };
const none = { 'GET /api/news/unread': () => ({ items: [] }) };

async function showAll(phone = false) {
  const writes: string[] = [];
  renderPrefs('/you/help', { phone, fixtures: { ...newsFixtures(writes), ...none } });
  fireEvent.click(await screen.findByRole('button', { name: 'Show all news' }, T));
  const sheet = await screen.findByRole('dialog');
  await within(sheet).findByText('Server › Embed profiles');
  return { sheet, writes };
}

describe('17-09-news', () => {
  it('17-09-news shows the board', async () => {
    const { sheet } = await showAll();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Next' }));
    expect(await within(sheet).findByRole('heading', { name: 'Security fix in 4.15.2' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('2 / 3');
    expect(within(sheet).getByRole('link', { name: 'release notes' })).toHaveAttribute('href', 'https://meshmonitor.org/releases/4.15.2');
    expectBoard('17-09-news', document.body);
  });

  it('17-16-news shows the board', async () => {
    const { sheet } = await showAll(true);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Next' }));
    await within(sheet).findByRole('heading', { name: 'Security fix in 4.15.2' });
    expectBoard('17-16-news', sheet);
  });

  it('Show all news pages through the whole feed and dismisses nothing, whichever way it closes', async () => {
    const { sheet, writes } = await showAll();
    expect(within(sheet).queryByRole('button', { name: 'Previous' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Next' }));
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Next' }));
    expect(await within(sheet).findByText('3 / 3')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Previous' }));
    expect(await within(sheet).findByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual([]);
  });

  it('opens by itself on unread items; Close on the last dismisses every item it showed', async () => {
    const writes: string[] = [];
    renderPrefs('/you/help', { fixtures: newsFixtures(writes) });
    const sheet = await screen.findByRole('dialog', {}, T);
    expect(await within(sheet).findByText('1 / 3')).toBeInTheDocument();
    expect(writes).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Next' }));
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Next' }));
    await within(sheet).findByText('3 / 3');
    // The footer's Close (the head's × is the first button of that name).
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual([
      'POST /api/news/dismiss/n3',
      'POST /api/news/dismiss/n2',
      'POST /api/news/dismiss/n1',
      'POST /api/news/user/status',
    ]);
  });

  it('× dismisses every item it showed, the Important one included', async () => {
    const writes: string[] = [];
    // Seen up to n1: n3 is new, n2 is Important and not dismissed.
    renderPrefs('/you/help', { fixtures: newsFixtures(writes, { lastSeenNewsId: 'n1', dismissedNewsIds: [] }) });
    const sheet = await screen.findByRole('dialog', {}, T);
    expect(await within(sheet).findByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(within(sheet).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual(['POST /api/news/dismiss/n3', 'POST /api/news/dismiss/n2', 'POST /api/news/user/status']);
  });
  it('a second close while the first runs sends no more dismissals', async () => {
    const writes: string[] = [];
    renderPrefs('/you/help', { fixtures: newsFixtures(writes, { lastSeenNewsId: 'n1', dismissedNewsIds: [] }) });
    const sheet = await screen.findByRole('dialog', {}, T);
    await within(sheet).findByText('1 / 2');
    const x = within(sheet).getAllByRole('button', { name: 'Close' })[0];
    fireEvent.click(x);
    fireEvent.click(x);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual(['POST /api/news/dismiss/n3', 'POST /api/news/dismiss/n2', 'POST /api/news/user/status']);
  });

  it('changing page scrolls the body to top', async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
    try {
      const { sheet } = await showAll();
      scrollTo.mockClear();
      fireEvent.click(within(sheet).getByRole('button', { name: 'Next' }));
      await within(sheet).findByText('2 / 3');
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
      expect(scrollTo.mock.contexts.at(-1)).toContainElement(within(sheet).getByRole('article'));
    } finally {
      delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });
});
