/**
 * @vitest-environment jsdom
 *
 * Mesh impact (Task 8.1): the Dashboard only reads. Opening it, editing the
 * board, saving and re-rendering send nothing over the air: every request is
 * a GET, except the one PUT of the user's board on Done. The reads are
 * today's: the device's settings and nodes, the user's preferences, each
 * chart's telemetry and each widget's own read.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { boardLoaded, renderDashboard } from './renderDashboard';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const calls = () =>
  vi.mocked(fetch).mock.calls.map(([u, i]) => {
    const url = new URL(String(u), 'http://localhost');
    return { method: (i?.method ?? 'GET').toUpperCase(), path: url.pathname, search: url.search };
  });

describe('Dashboard mesh impact', () => {
  it('opening, editing, saving and re-rendering send nothing over the air', async () => {
    const { rerenderWorkspace } = renderDashboard();
    await boardLoaded();
    await screen.findByRole('heading', { name: /^Kifisia Rooftop/ });
    await pause();
    const open = calls().filter((c) => !c.path.startsWith('/api/auth') && c.path !== '/api/csrf-token');
    expect(open.every((c) => c.method === 'GET')).toBe(true);
    // The device's settings: SettingsProvider's read (as under App) and the Dashboard's; the user's board adds none.
    expect(open.filter((c) => c.path === '/api/settings' && c.search === '?sourceId=src-g2')).toHaveLength(2);
    expect(open.filter((c) => c.path === '/api/nodes')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const list = await screen.findByRole('list', { name: 'Your board' });
    fireEvent.click(within(within(list).getAllByRole('listitem')[0]).getByRole('button', { name: 'Move Node Status down' }));
    const done = screen.getByRole('button', { name: 'Done' });
    await waitFor(() => expect(done).toBeEnabled());
    fireEvent.click(done);
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Your board' })).toBeNull());
    rerenderWorkspace();
    await pause();

    const writes = calls().filter((c) => c.method !== 'GET' && c.path !== '/api/csrf-token');
    expect(writes).toEqual([{ method: 'PUT', path: '/api/user/preferences/dashboard.src-g2', search: '' }]);
    // Nothing that reaches a radio: no message, traceroute, admin or request route.
    const radio = /\/api\/(messages\/send|traceroute|admin|nodes\/[^/]+\/(request|exchange)|position\/request|telemetry\/request)/;
    expect(calls().filter((c) => radio.test(c.path))).toEqual([]);
  });
});
