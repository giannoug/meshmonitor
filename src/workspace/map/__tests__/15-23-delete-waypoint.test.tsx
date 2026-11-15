/**
 * @vitest-environment jsdom
 *
 * Board 15-23 (phone): Delete waypoint as a bottom-sheet plain confirm with
 * today's broadcast words, the sending source and a Sends line.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

import { mapRoute, openWaypointPopup, sent, waypointsUrl } from './mapEditHelpers';

const fixtures = { 'DELETE /api/sources/:id/waypoints/:waypointId': () => ({ success: true }) };

async function openConfirm() {
  fireEvent.click(within(await openWaypointPopup('Trailhead')).getByRole('button', { name: 'Delete…' }));
  return screen.findByRole('dialog', { name: 'Delete waypoint “Trailhead”?' });
}

describe('15-23-delete-waypoint', () => {
  it('15-23-delete-waypoint shows the board', async () => {
    renderChat(mapRoute, { phone: true, fixtures });
    expectBoard('15-23-delete-waypoint', await openConfirm());
  });

  it('is a bottom sheet with no typed word; Cancel sends nothing, Delete sends one DELETE', async () => {
    renderChat(mapRoute, { phone: true, fixtures });
    const sheet = await openConfirm();
    expect(sheet).toHaveAttribute('data-side', 'bottom');
    expect(within(sheet).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent(waypointsUrl, 'DELETE')).toHaveLength(0);
    fireEvent.click(within(await openConfirm()).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(sent(`${waypointsUrl}/101`, 'DELETE')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
