/**
 * @vitest-environment jsdom
 *
 * Every device type's Dashboard is the one Workspace DeviceDashboard (Task
 * 8.1), at today's URLs, with today's data source; today's Dashboard grid is
 * not mounted (Rulings 7.3 HH, 7.6 HU).
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { meshcoreFixtures } from '../../__fixtures__/meshcore';
import { reticulumFixtures } from '../../__fixtures__/reticulum';
import { renderDashboard, requests } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
vi.mock('../../../pages/MeshCoreSourcePage', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('meshcore') }));

const workspaceDashboard = async () => {
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
  await screen.findByTestId('device-dashboard');
  expect(document.querySelector('.dashboard, .dashboard-loading')).toBeNull();
  expect(screen.queryByTestId('page-app')).toBeNull();
  expect(screen.queryByTestId('page-meshcore')).toBeNull();
};

describe('Dashboard routes', () => {
  it.each(['/source/src-g2/dashboard', '/source/src-mqtt/dashboard'])('%s is the Workspace dashboard', async (route) => {
    renderDashboard(route);
    await workspaceDashboard();
    const id = route.split('/')[2];
    await waitFor(() => expect(requests('GET', '/api/nodes', `sourceId=${id}`)).toBe(1));
  });

  it("MeshCore's Dashboard (today's `telemetry` view) is the Workspace dashboard over MeshCore's nodes", async () => {
    renderDashboard('/source/src-heltec/telemetry', { fixtures: meshcoreFixtures() });
    await workspaceDashboard();
    await waitFor(() => expect(requests('GET', '/api/sources/src-heltec/meshcore/nodes')).toBeGreaterThan(0));
    expect(requests('GET', '/api/nodes')).toBe(0);
  });

  it("Reticulum's Dashboard is the Workspace dashboard over its interfaces, with no Add widget", async () => {
    renderDashboard('/source/src-rns/dashboard', { fixtures: reticulumFixtures() });
    await workspaceDashboard();
    await waitFor(() => expect(requests('GET', '/api/sources/src-rns/reticulum/interfaces')).toBeGreaterThan(0));
    // No mesh health for a Reticulum node; nothing on its board to add.
    expect(screen.queryByRole('list', { name: 'Mesh health' })).toBeNull();
  });
});
