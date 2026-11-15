/**
 * @vitest-environment jsdom
 *
 * Board 15-26 (phone): Add local marker here opens the marker sheet
 * (LocalMarkerEditorModal's logic, useLocalMarkerForm): saved in MeshMonitor
 * only, never sent to the mesh.
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

import { SOURCE_IDS } from '../../__fixtures__/athens';
import { mapRoute, openMapMenu, pick, sent } from './mapEditHelpers';

describe('15-26-local-marker', () => {
  it('15-26-local-marker shows the board', async () => {
    renderChat(mapRoute, { phone: true });
    await pick(await openMapMenu(), /^Add local marker here/);
    const sheet = await screen.findByRole('dialog', { name: 'New local marker' });
    expect(sheet).toHaveAttribute('data-side', 'bottom');
    expectBoard('15-26-local-marker', sheet);
  });

  it('Save stays off until the marker has a label', async () => {
    renderChat(mapRoute, { phone: true });
    await pick(await openMapMenu(), /^Add local marker here/);
    const sheet = within(await screen.findByRole('dialog', { name: 'New local marker' }));
    expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(sheet.getByLabelText('Label'), { target: { value: 'Site B' } });
    expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it("a saved marker's popup edits it in the sheet and deletes it through a plain confirm that sends nothing", async () => {
    const siteB = { id: 9, sourceId: SOURCE_IDS.g2, label: 'Site B', description: 'Water tower', latitude: 37.9715, longitude: 23.747,
      altitude: null, icon: 'antenna', color: 'info', createdByUserId: 1, createdAt: 0, updatedAt: 0 };
    renderChat(mapRoute, { phone: true, fixtures: {
      'GET /api/sources/:id/markers': () => ({ success: true, data: [siteB] }),
      'DELETE /api/sources/:id/markers/:markerId': () => ({ success: true }),
    } });
    const pin = await screen.findByTitle('Site B', {}, { timeout: 5000 });
    fireEvent.click(pin);
    fireEvent.click(within(document.querySelector<HTMLElement>('.leaflet-popup')!).getByRole('button', { name: 'Edit' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit local marker' });
    expect(within(sheet).getByLabelText('Label')).toHaveValue('Site B');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    fireEvent.click(pin);
    fireEvent.click(within(document.querySelector<HTMLElement>('.leaflet-popup')!).getByRole('button', { name: 'Delete' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Delete local marker "Site B"?' }));
    expect(confirm.getByText('Sends nothing on the mesh')).toBeInTheDocument();
    fireEvent.click(confirm.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(sent(`/api/sources/${SOURCE_IDS.g2}/markers/9`, 'DELETE')).toHaveLength(1));
  });

  it('a double press on Delete sends one DELETE (busy while it runs)', async () => {
    const siteB = { id: 9, sourceId: SOURCE_IDS.g2, label: 'Site B', description: null, latitude: 37.9715, longitude: 23.747,
      altitude: null, icon: 'pin', color: 'accent', createdByUserId: 1, createdAt: 0, updatedAt: 0 };
    renderChat(mapRoute, { phone: true, fixtures: {
      'GET /api/sources/:id/markers': () => ({ success: true, data: [siteB] }),
      'DELETE /api/sources/:id/markers/:markerId': () => ({ success: true }),
    } });
    fireEvent.click(await screen.findByTitle('Site B', {}, { timeout: 5000 }));
    fireEvent.click(within(document.querySelector<HTMLElement>('.leaflet-popup')!).getByRole('button', { name: 'Delete' }));
    const confirm = within(await screen.findByRole('dialog', { name: 'Delete local marker "Site B"?' }));
    fireEvent.click(confirm.getByRole('button', { name: 'Delete' }));
    fireEvent.click(confirm.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent(`/api/sources/${SOURCE_IDS.g2}/markers/9`, 'DELETE')).toHaveLength(1);
  });
});
