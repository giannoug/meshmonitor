/**
 * @vitest-environment jsdom
 *
 * Mesh impact (Task 7.6): today's ~30 s status poll runs once per device
 * screen, however many views are opened; opening and re-rendering every view
 * sends nothing over the air and writes nothing; Refresh is one re-read per
 * press.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { RNS } from '../../__fixtures__/reticulum';
import { RNS_URL, renderReticulum, rnsRequests } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const pollTimers = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([fn, ms]) => ms === 30000 && String(fn).includes('fetchAll')).length;

describe('Reticulum mesh impact', () => {
  it('the status poll runs once per device screen while the viewer moves between views', async () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    renderReticulum(`${RNS_URL}/destinations`);
    const sidebar = await screen.findByRole('complementary', { name: 'Reticulum node' });
    await screen.findByText('38 destinations · 4 interfaces');
    expect(rnsRequests('GET', '/reticulum/status')).toBe(1);
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Map' }));
    await screen.findByRole('tab', { name: 'Connections' });
    fireEvent.click(within(sidebar).getByRole('button', { name: /More tools/ }));
    for (const name of ['Interfaces', 'Paths', 'Info']) {
      fireEvent.click(within(sidebar).getByRole('link', { name }));
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name })).toBeInTheDocument());
    }
    fireEvent.click(within(sidebar).getByRole('link', { name: /Kifisia Sideband/ }));
    await screen.findByText('Bringing water either way');
    await pause();
    expect(rnsRequests('GET', '/reticulum/status')).toBe(1);
    expect(rnsRequests('GET', '/reticulum/destinations')).toBe(1);
    expect(pollTimers(spy)).toBe(1);
    spy.mockRestore();
  });

  it.each(['', '/destinations', '/interfaces', '/paths', '/map', '/info', '/dashboard', '/dms', `/dm/${RNS.kifisia}`, '/configuration', '/settings/lxmf-identity', '/settings/rnode'])(
    'opening %s and re-rendering sends nothing and writes nothing',
    async (path) => {
      const { log, rerenderWorkspace } = renderReticulum(`${RNS_URL}${path}`, { phone: path === '' });
      await waitFor(() => expect(log.reads.length).toBeGreaterThan(0));
      await pause();
      rerenderWorkspace();
      await pause();
      expect(log.writes).toEqual([]);
      expect(rnsRequests('POST', /./)).toBe(0);
      expect(rnsRequests('PUT', /./)).toBe(0);
      expect(rnsRequests('GET', /\/remote-status\//)).toBe(0);
    },
  );

  it('Refresh re-reads once per press and sends nothing', async () => {
    const { log } = renderReticulum(`${RNS_URL}/destinations`);
    await screen.findByText('38 destinations · 4 interfaces');
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    await waitFor(() => expect(rnsRequests('GET', '/reticulum/status')).toBe(2));
    await pause();
    expect(rnsRequests('GET', '/reticulum/status')).toBe(2);
    expect(rnsRequests('GET', '/reticulum/paths')).toBe(2);
    expect(log.writes).toEqual([]);
  });
});
