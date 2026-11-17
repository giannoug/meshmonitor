/**
 * @vitest-environment jsdom
 *
 * Review round 1 (Task 7.2): crafted node URLs, tabs a node type lacks, the
 * favourite override, the repeater's login state and Log in's reason, and
 * Export's reason on a non-Companion device.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../../components/ToastContainer';
import type { MeshCoreActions } from '../../../components/MeshCore/hooks/useMeshCore';
import { MC, mcStatus } from '../../__fixtures__/meshcore';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';
import { renderWorkspace } from '../../test/renderWorkspace';
import { useContactActions } from '../useContactActions';
import { HELTEC, renderMeshCore } from './renderMeshCore';
import { meshcoreFixtures } from '../../__fixtures__/meshcore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

function Where() {
  const { pathname } = useLocation();
  return <span data-testid="where">{pathname}</span>;
}

function renderAt(route: string) {
  Element.prototype.scrollIntoView ??= () => {};
  return renderWorkspace(
    <ToastProvider>
      <Where />
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
    </ToastProvider>,
    { route, fixtures: meshcoreFixtures() },
  );
}

describe('ContactPage review fixes', () => {
  it('M1: a crafted node URL does not throw, and an unknown tab moves to the encoded node URL', async () => {
    renderAt(`${HELTEC}/node/%25/bogus`);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${HELTEC}/node/%25`));
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });

  it('M2: a tab the node type lacks moves to its Overview URL', async () => {
    renderAt(`${HELTEC}/node/${MC.glyfada}/neighbours`);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${HELTEC}/node/${MC.glyfada}`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' })).toBeInTheDocument();
  });

  it('M2: a repeater has no Links tab', async () => {
    renderAt(`${HELTEC}/node/${MC.lycabettus}/links`);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${HELTEC}/node/${MC.lycabettus}`));
  });

  it('M3: the favourite override gives way once the node list catches up, and to a change from elsewhere', async () => {
    const actions = { setNodeFavorite: vi.fn().mockResolvedValue(true) } as unknown as MeshCoreActions;
    const { result, rerender } = renderHook(({ fav }) => useContactActions(MC.glyfada, null, actions, fav), { initialProps: { fav: false } });
    await act(async () => result.current.toggleFavorite());
    expect(actions.setNodeFavorite).toHaveBeenCalledWith(MC.glyfada, true);
    expect(result.current.isFavorite).toBe(true);
    rerender({ fav: true });
    expect(result.current.isFavorite).toBe(true);
    rerender({ fav: false });
    expect(result.current.isFavorite).toBe(false);
  });

  it('M4/M5: without remote_admin:write the repeater claims no login state, and Log in says why it is off', async () => {
    renderMeshCore(`${HELTEC}/node/${MC.lycabettus}`, {
      phone: true,
      permissions: { bySource: { 'src-heltec': { connection: { read: true, write: false }, nodes: { read: true, write: true } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Lycabettus Repeater' });
    expect(screen.getByText('Log in: Needs remote_admin:write')).toBeInTheDocument();
    expect(screen.queryByText('Admin login')).toBeNull();
    expect(screen.queryByText('Not logged in')).toBeNull();
  });

  it('M9: on a device that is not a Companion, Export says why it is off', async () => {
    const repeater = { ...mcStatus, deviceType: 2, deviceTypeName: 'Repeater' };
    const gly = { publicKey: MC.glyfada, advName: 'Glyfada Beach', advType: 1 };
    renderMeshCore(`${HELTEC}/node/${MC.glyfada}`, {
      fixtures: {
        'GET /api/sources/:id/meshcore/status': () => ({ success: true, data: repeater }),
        'GET /api/sources/:id/meshcore/snapshot': () => ({ success: true, data: { status: repeater, contacts: [gly], nodes: [], messages: [], seqCursor: 0 } }),
        'GET /api/sources/:id/meshcore/contacts': () => ({ success: true, data: [gly], count: 1 }),
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Glyfada Beach' });
    const exportButton = await screen.findByRole('button', { name: 'Export meshcore://' });
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute('title', 'Needs a connected Companion radio');
    expect(screen.getAllByText('Needs a connected Companion radio').length).toBeGreaterThan(0);
  });

  it('M7: desktop path-chip buttons and the Nodes star are 36 px; the phone editor 44 px', () => {
    const page = readFileSync(join(__dirname, '../ContactPage.module.css'), 'utf8');
    const nodes = readFileSync(join(__dirname, '../MeshCoreNodesTable.module.css'), 'utf8');
    expect(page).toMatch(/\.chipButton \{\s*width: 36px;\s*height: 36px;/);
    expect(page).toMatch(/\.editor\[data-phone\] \.chipButton \{\s*min-height: 44px;\s*min-width: 44px;/);
    expect(nodes).toMatch(/\.star \{\s*width: 36px;\s*height: 36px;/);
  });
});
