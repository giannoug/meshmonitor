/**
 * @vitest-environment jsdom
 *
 * Board h6 (Task 6.7): first run. An admin on an install with no devices
 * lands on a welcome page in place of the Overview, with no sidebar; it leads
 * to the Add device flow (Task 6.6) and to Server › Backup to restore one.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderServer } from '../../server/__tests__/serverHarness';

const NO_DEVICES = { 'GET /api/sources': () => [] };

describe('h6 first run', () => {
  it('h6-first-run shows the board', async () => {
    const { container } = renderServer('/', { fixtures: NO_DEVICES });
    await screen.findByText('Welcome to MeshMonitor');
    expectBoard('h6-first-run', container);
  });

  it('leads to Add device, Server › Backup and the guide; the rail keeps only Add device', async () => {
    renderServer('/', { fixtures: NO_DEVICES });
    expect(await screen.findByRole('link', { name: 'Add your first device' })).toHaveAttribute('href', '/server/devices?add=1');
    expect(screen.getByRole('link', { name: 'Restore a backup' })).toHaveAttribute('href', '/server/backup');
    expect(screen.getByRole('link', { name: 'Read the getting-started guide' })).toHaveAttribute('href', 'https://meshmonitor.org/getting-started');
    expect(screen.queryByRole('link', { name: 'Overview: all devices' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Add device' })).toHaveAttribute('aria-current', 'page');
  });

  it('a viewer who is not an admin gets the usual page', async () => {
    let served = 0;
    renderServer('/', {
      fixtures: { 'GET /api/sources': () => (served++, []) },
      permissions: { bySource: {} },
    });
    await waitFor(() => expect(served).toBeGreaterThan(0));
    // The usual page: the rail's Overview square, which first run hides.
    expect(await screen.findByRole('link', { name: 'Overview: all devices' })).toBeInTheDocument();
    expect(screen.queryByText('Welcome to MeshMonitor')).toBeNull();
  });

  it('an install with devices gets the usual page', async () => {
    renderServer('/');
    await screen.findByRole('link', { name: 'Station G2' });
    expect(screen.queryByText('Welcome to MeshMonitor')).toBeNull();
  });
});
