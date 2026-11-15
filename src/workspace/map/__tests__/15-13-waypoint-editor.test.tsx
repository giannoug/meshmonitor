/**
 * @vitest-environment jsdom
 *
 * Board 15-13 (phone): the waypoint editor as a bottom sheet, opened from the
 * long-press menu; its geofence is a row that opens GeofencePage (15-24).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

import { mapRoute, openMapMenu, pick } from './mapEditHelpers';

describe('15-13-waypoint-editor', () => {
  it('15-13-waypoint-editor shows the board', async () => {
    renderChat(mapRoute, { phone: true });
    await pick(await openMapMenu(), /^Add waypoint here/);
    const editor = await screen.findByRole('dialog', { name: 'New waypoint' });
    fireEvent.change(within(editor).getByLabelText(/^Rebroadcast every/), { target: { value: '30' } });
    expectBoard('15-13-waypoint-editor', editor);
  });

  it('is a bottom sheet; the geofence is a row, not inline fields', async () => {
    renderChat(mapRoute, { phone: true });
    await pick(await openMapMenu(), /^Add waypoint here/);
    const editor = await screen.findByRole('dialog', { name: 'New waypoint' });
    expect(editor).toHaveAttribute('data-side', 'bottom');
    expect(within(editor).getByRole('button', { name: /^Geofence/ })).toHaveTextContent('None');
    expect(within(editor).queryByRole('combobox', { name: 'Shape' })).toBeNull();
  });
});
