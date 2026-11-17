/**
 * @vitest-environment jsdom
 *
 * MeshCorePage — the Workspace's `dm/<key>` hand-off (#6365): the DM view opens
 * on that contact, and a repeat visit (a new `dmRequest`) opens it again after
 * the user picked another contact inside the view.
 */
import { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', async () => {
  const { createReactI18nextMock } = await import('../../test/mockI18n');
  return createReactI18nextMock();
});
vi.mock('../../hooks/useTxStatus', () => ({ useTxStatus: () => ({ isTxDisabled: false }) }));
vi.mock('./hooks/useMeshCore', () => ({
  useMeshCore: () => ({
    status: { connected: true, deviceType: 1 },
    nodes: [],
    contacts: [],
    messages: [],
    loading: false,
    hasLoadedOnce: true,
    error: null,
    actions: { clearError: vi.fn() },
  }),
  ConnectionStatus: {},
}));
vi.mock('../../hooks/useMeshCoreFilters', () => ({
  useMeshCoreIgnoredNodes: () => ({ data: [] }),
  useHiddenMeshCoreKeys: () => new Set(),
  useSetMeshCoreIgnoredNode: () => ({ mutateAsync: vi.fn() }),
  useRemoveMeshCoreIgnoredNode: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('./hooks/useMeshCoreUnread', () => ({ useMeshCoreUnread: () => ({ channels: false, dms: false }) }));
vi.mock('./hooks/useReadStateSync', () => ({ useReadStateSync: () => true }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ authStatus: { user: { isAdmin: false } }, hasPermission: () => true }) }));
vi.mock('../NotificationsTab', () => ({ default: () => null }));
vi.mock('./MeshCoreSubToolbar', () => ({ MeshCoreSubToolbar: () => null }));
vi.mock('./MeshCoreStatusBar', () => ({ MeshCoreStatusBar: () => null }));
// Today's DM view selects `initialSelectedContact` whenever it changes; the user can pick another.
vi.mock('./MeshCoreDirectMessagesView', () => ({
  MeshCoreDirectMessagesView: ({ initialSelectedContact }: { initialSelectedContact?: string | null }) => {
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => {
      if (initialSelectedContact) setSelected(initialSelectedContact);
    }, [initialSelectedContact]);
    return (
      <>
        <span data-testid="selected">{selected ?? 'none'}</span>
        <button type="button" onClick={() => setSelected('other')}>pick-other</button>
      </>
    );
  },
}));

import { MeshCorePage } from './MeshCorePage';

describe('MeshCorePage — dm/<key> hand-off (#6365)', () => {
  it('opens the contact, and opens it again on a repeat visit after another was picked', () => {
    const { rerender } = render(<MeshCorePage baseUrl="" sourceId="src-1" view="dms" dmContact="abcd" dmRequest="k1" />);
    expect(screen.getByTestId('selected').textContent).toBe('abcd');
    fireEvent.click(screen.getByText('pick-other'));
    expect(screen.getByTestId('selected').textContent).toBe('other');
    rerender(<MeshCorePage baseUrl="" sourceId="src-1" view="dms" dmContact="abcd" dmRequest="k1" />);
    expect(screen.getByTestId('selected').textContent).toBe('other');
    rerender(<MeshCorePage baseUrl="" sourceId="src-1" view="dms" dmContact="abcd" dmRequest="k2" />);
    expect(screen.getByTestId('selected').textContent).toBe('abcd');
  });
});
