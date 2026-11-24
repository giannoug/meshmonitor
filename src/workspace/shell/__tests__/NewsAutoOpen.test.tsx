/**
 * @vitest-environment jsdom
 *
 * s13n2 (Task 6.3 fix round 1, Ruling GO): new news opens by itself once.
 * The shell reads today's `GET /api/news/unread` once when it mounts for a
 * signed-in user, and opens the news sheet (17-09, today's popup logic; the
 * unseen items) when it lists
 * any. No interval; a guest asks nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { NEWS_FEED } from '../../__fixtures__/preferences';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

function renderShell(unread: string[], opts: RenderWorkspaceOptions = {}) {
  const calls: string[] = [];
  const count = (path: string, reply: unknown) => () => {
    calls.push(path);
    return reply;
  };
  renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <p>page</p>
      </WorkspaceShell>
    </ToastProvider>,
    {
      route: '/you',
      ...opts,
      fixtures: {
        'GET /api/news/unread': count('unread', { items: NEWS_FEED.items.filter((i) => unread.includes(i.id)) }),
        'GET /api/news': count('feed', NEWS_FEED),
        'GET /api/news/user/status': count('status', { lastSeenNewsId: 'n1', dismissedNewsIds: ['n2'] }),
      },
    },
  );
  return calls;
}

describe('news opens by itself once (s13n2)', () => {
  it('opens today\'s popup on the unseen item, after one unread read, and never asks again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = renderShell(['n3']);
      expect(await screen.findByText(/Embed profiles moved to/)).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(10 * 60_000);
      });
      expect(calls.filter((c) => c === 'unread')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays shut with nothing unread', async () => {
    const calls = renderShell([]);
    await waitFor(() => expect(calls).toContain('unread'));
    await screen.findByText('page');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls).toEqual(['unread']);
  });

  it('a guest asks nothing', async () => {
    const calls = renderShell(['n3'], { anonymous: true });
    await screen.findByText('page');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(calls).toEqual([]);
  });
});
