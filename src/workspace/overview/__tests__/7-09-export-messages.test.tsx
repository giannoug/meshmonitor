/**
 * @vitest-environment jsdom
 *
 * Board 7-09-export-messages (phone, s7n3): Export is a full-screen form with
 * the same fields as 7-02, back to Messages, and one Download CSV at its foot.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import apiService from '../../../services/api';
import { expectBoard } from '../../test/boardChecks';
import { renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/messages/export';

describe('7-09-export-messages', () => {
  it('7-09-export-messages shows the board', async () => {
    renderMessages(ROUTE, { phone: true });
    await screen.findByRole('checkbox', { name: /Station G2/ }, { timeout: 5000 });
    expectBoard('7-09-export-messages', document.body);
  });

  it('is a page, not a dialog, with its way back to Messages', async () => {
    renderMessages(ROUTE, { phone: true });
    await screen.findByRole('checkbox', { name: /Station G2/ }, { timeout: 5000 });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/overview/messages');
    expect(screen.getByRole('heading', { name: 'Export messages' })).toBeInTheDocument();
  });

  it('picks channels with All channels / Only these channels, and reactions with a switch', async () => {
    renderMessages(ROUTE, { phone: true });
    await screen.findByRole('checkbox', { name: /Station G2/ }, { timeout: 5000 });
    expect(screen.getByRole('radio', { name: 'All channels' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'LongFast' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Only these channels' }));
    expect(screen.getByRole('checkbox', { name: 'LongFast' })).not.toBeChecked();
    expect(screen.getByRole('switch', { name: 'Include emoji reactions' })).not.toBeChecked();
  });

  it('Download CSV downloads, then goes back to Messages', async () => {
    const download = vi.spyOn(apiService, 'exportMessagesCsv').mockResolvedValue(undefined);
    renderMessages(ROUTE, { phone: true });
    await screen.findByRole('checkbox', { name: /Station G2/ }, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText('Sender ID (optional)'), { target: { value: '!a3f9c2e1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0][0]).toMatchObject({ sources: undefined, channels: undefined, sender: '!a3f9c2e1' });
    expect(await screen.findByRole('link', { name: 'Overview' }, { timeout: 5000 })).toBeInTheDocument();
    download.mockRestore();
  });

  it('a failed download stays on the form with today’s error', async () => {
    const download = vi.spyOn(apiService, 'exportMessagesCsv').mockRejectedValue(new Error('Forbidden'));
    renderMessages(ROUTE, { phone: true });
    await screen.findByRole('checkbox', { name: /Station G2/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Export failed: Forbidden');
    expect(within(document.body).getByRole('heading', { name: 'Export messages' })).toBeInTheDocument();
    download.mockRestore();
  });
});
