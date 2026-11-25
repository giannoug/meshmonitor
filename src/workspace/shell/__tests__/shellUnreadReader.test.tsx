/**
 * @vitest-environment jsdom
 *
 * The shell's unread readers add no observer to the polled key: invalidating it (a new message does,
 * useWebSocket) with only a reader mounted must not write a missing queryFn onto the query.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { renderWorkspace } from '../../test/renderWorkspace';
import { useOpenDeviceUnread } from '../shellUnread';

const key = ['unreadCounts', '', 'src-x', true];
const counts = { channels: { 0: 2 }, directMessages: {} };

function Reader() {
  const { data } = useOpenDeviceUnread('src-x');
  return <p>{`channel 0: ${data?.channels[0] ?? 'none'}`}</p>;
}
function Owner({ queryFn }: { queryFn: () => Promise<typeof counts> }) {
  useQuery({ queryKey: key, queryFn });
  return null;
}

describe('shell unread readers', () => {
  it('invalidating the key with only a reader mounted logs no error and keeps the data', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const queryFn = vi.fn(async () => counts);
    const { queryClient } = renderWorkspace(<Reader />, { route: '/overview' });
    await queryClient.fetchQuery({ queryKey: key, queryFn });
    expect(await screen.findByText('channel 0: 2')).toBeInTheDocument();
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryState(key)?.status).toBe('success');
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/Missing queryFn/);
    error.mockRestore();
  });

  it("the owner's poller refetches the key and the reader follows", async () => {
    const queryFn = vi.fn(async () => (queryFn.mock.calls.length > 1 ? { ...counts, channels: { 0: 5 } } : counts));
    const { queryClient } = renderWorkspace(
      <>
        <Owner queryFn={queryFn} />
        <Reader />
      </>,
      { route: '/overview' },
    );
    expect(await screen.findByText('channel 0: 2')).toBeInTheDocument();
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
    });
    await waitFor(() => expect(screen.getByText('channel 0: 5')).toBeInTheDocument());
  });
});
