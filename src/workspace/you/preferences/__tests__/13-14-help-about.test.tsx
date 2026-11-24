/**
 * @vitest-environment jsdom
 *
 * Boards 13-14 (desktop) and 13-29 (phone), Task 6.3: You › Help & about.
 * System status and news are read once when the page opens (no poll); Show
 * all news opens the news sheet (17-09, today's popup logic); the links are
 * today's, in a new tab.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../../test/boardChecks';
import { MESHMONITOR_GITHUB_URL, MESHMONITOR_KOFI_URL } from '../../../../components/SidebarFooter';
import { DOCS_URL } from '../HelpAboutPage';
import { renderPrefs } from './prefsHarness';

const help = (opts = {}) => renderPrefs('/you/help', opts);

describe('13-14-help-about', () => {
  it('13-14-help-about shows the board', async () => {
    const { container } = help();
    await screen.findByText('v24.11.0');
    await screen.findByText('Server › Embed profiles');
    expectBoard('13-14-help-about', container);
  });

  it('13-29-help-about shows the board', async () => {
    const { container } = help({ phone: true });
    await screen.findByText('v24.11.0');
    await screen.findByText('Server › Embed profiles');
    expectBoard('13-29-help-about', container);
  });

  it('reads status and news once on open, and never again while open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { log } = help();
      await screen.findByText('v24.11.0');
      await screen.findByText('Server › Embed profiles');
      await act(async () => {
        vi.advanceTimersByTime(10 * 60_000);
      });
      const count = (p: string) => log.reads.filter((r) => r === p).length;
      expect(count('/api/system/status')).toBe(1);
      expect(count('/api/news')).toBe(1);
      expect(count('/api/news/user/status')).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks the unseen item new, as today\'s popup counts it', async () => {
    help();
    const item = (await screen.findByText('Server › Embed profiles')).closest('div')!;
    await waitFor(() => expect(item.querySelector('[aria-label="New"]')).not.toBeNull());
    // Dismissed, though Important: not new.
    const fix = screen.getByText('Security fix in 4.15.2').closest('div')!;
    expect(fix).toHaveTextContent('Important');
    expect(fix.querySelector('[aria-label="New"]')).toBeNull();
  });

  it('Show all news opens today\'s news popup with every item', async () => {
    help();
    fireEvent.click(await screen.findByRole('button', { name: 'Show all news' }));
    // forceShowAll: the popup's first item is the feed's first, with its markdown.
    expect(await screen.findByText(/Embed profiles moved to/)).toBeInTheDocument();
  });

  it('closing the popup reads the seen state again, once', async () => {
    const { log } = help();
    fireEvent.click(await screen.findByRole('button', { name: 'Show all news' }));
    await screen.findByText(/Embed profiles moved to/);
    const before = log.reads.filter((r) => r === '/api/news/user/status').length;
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    await waitFor(() => expect(log.reads.filter((r) => r === '/api/news/user/status').length).toBe(before + 1));
  });

  it('opens today\'s links in a new tab', async () => {
    help();
    for (const [name, href] of [[/View Settings Documentation/, DOCS_URL], [/GitHub/, MESHMONITOR_GITHUB_URL], [/Support on Ko-fi/, MESHMONITOR_KOFI_URL]] as const) {
      const a = await screen.findByRole('link', { name });
      expect(a).toHaveAttribute('href', href);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('without dashboard:read the status is not asked for', async () => {
    const { log } = help({ permissions: { global: {}, bySource: {} } });
    await screen.findByText('Server › Embed profiles');
    expect(screen.getByText("You don't have permission to do this")).toBeInTheDocument();
    expect(log.reads).not.toContain('/api/system/status');
  });
});
