/**
 * @vitest-environment jsdom
 *
 * Board 7-02-export-messages (desktop): Export opens today's export form over
 * the feed, each source with its device tag, the viewed channel ticked. Download
 * CSV is an HTTP download (s7n1: it sends nothing on the mesh).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import apiService from '../../../services/api';
import { expectBoard } from '../../test/boardChecks';
import { feedRow, renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function openExport() {
  renderMessages();
  await feedRow('Anyone hearing the Hymettus relay this morning?');
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  return screen.findByRole('dialog', { name: 'Export messages' });
}

describe('7-02-export-messages', () => {
  it('7-02-export-messages shows the board', async () => {
    await openExport();
    expectBoard('7-02-export-messages', document.body);
  });

  it('lists each source with its device tag, and ticks the channel in view', async () => {
    const dialog = await openExport();
    expect(within(dialog).getByRole('checkbox', { name: /Rooftop RAK/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Rooftop RAK/ }).closest('label')).toHaveTextContent('RR');
    expect(within(dialog).getByRole('radio', { name: 'Only these channels' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'LongFast' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Hiking' })).not.toBeChecked();
  });

  it('Download CSV sends today’s filters and closes', async () => {
    const download = vi.spyOn(apiService, 'exportMessagesCsv').mockResolvedValue(undefined);
    const dialog = await openExport();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Heltec MeshCore/ }));
    fireEvent.change(within(dialog).getByLabelText('Leave out messages with'), { target: { value: 'test' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Include emoji reactions' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0][0]).toMatchObject({
      sources: ['src-mqtt', 'src-rak', 'src-g2'],
      channels: ['LongFast'],
      exclude: ['test'],
      includeReactions: true,
      type: 'all',
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Export messages' })).toBeNull());
    download.mockRestore();
  });

  it('Cancel closes without a download', async () => {
    const download = vi.spyOn(apiService, 'exportMessagesCsv').mockResolvedValue(undefined);
    const dialog = await openExport();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Export messages' })).toBeNull());
    expect(download).not.toHaveBeenCalled();
    download.mockRestore();
  });
});
