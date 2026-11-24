/**
 * @vitest-environment jsdom
 *
 * Boards 17-04-states (desktop) and 17-11-states (phone), Task 9.1: the route
 * states on StateView. Loading is today's plain "Loading…"; an empty page
 * says what it waits for; no permission names today's grant; an error that
 * reaches a route shows today's error screen inside the shell (Error details,
 * Try again, Reload page), and leaving the route clears it. Each state is a
 * render of its own (D9c), collected for one board check. None sends anything.
 */
import { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { joined } from '../../chat/__tests__/renderChat';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { fetched, G2, nonGets, renderTools } from '../../tools/__tests__/renderTools';
import WorkspaceShell from '../../shell/WorkspaceShell';
import ToastHost from '../ToastHost';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

afterEach(() => vi.restoreAllMocks());

const never = () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } });

const boom = { fail: true };
function Thrower(): never | null {
  if (boom.fail) throw new TypeError("Cannot read properties of undefined (reading 'nodeNum')");
  return null;
}
function Elsewhere() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => void navigate('/overview/telemetry')}>Go elsewhere</button>;
}
function Healthy() {
  const [n] = useState(1);
  return <p>Page {n} drawn</p>;
}

function renderError(phone = false) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  boom.fail = true;
  return renderWorkspace(
    <ToastHost>
      <Elsewhere />
      <WorkspaceShell>
        <Routes>
          <Route path="overview/packets" element={<Thrower />} />
          <Route path="overview/telemetry" element={<Healthy />} />
        </Routes>
      </WorkspaceShell>
    </ToastHost>,
    { route: '/overview/packets', phone },
  );
}

describe('17-04 / 17-11 states', () => {
  it('17-04-states shows the board (each state in turn)', async () => {
    const texts: string[] = [];

    // Loading: the device list has not answered.
    renderTools(`${G2}/telemetry`, { fixtures: { 'GET /api/sources': never } });
    texts.push((await screen.findAllByText('Loading…'))[0].textContent ?? '');
    cleanup();

    // Empty: capture is on and nothing is logged yet.
    renderTools(`${G2}/packetmonitor`, { fixtures: { 'GET /api/packets': () => ({ packets: [], total: 0, offset: 0, limit: 100 }) } });
    texts.push((await screen.findByText('No packets logged yet')).closest('[data-kind]')?.textContent ?? '');
    cleanup();

    // No permission: today's words for Direct messages.
    renderTools(`${G2}/dms`, { phone: true, permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false } } } } });
    const denied = await screen.findByText(/permission to view direct messages/);
    expect(denied.closest('[data-kind]')).toHaveAttribute('data-kind', 'noPermission');
    expect(denied.closest('[data-kind]')?.querySelector('strong')).toHaveTextContent('messages:read');
    texts.push(denied.closest('[data-kind]')?.textContent ?? '');
    cleanup();

    // Error: a route that throws.
    renderError();
    texts.push((await screen.findByRole('alert')).textContent ?? '');

    expectBoard('17-04-states', joined(...texts));
  });

  it('17-11-states shows the board', async () => {
    renderError(true);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Cannot read properties of undefined (reading 'nodeNum')");
    expectBoard('17-11-states', alert);
  });

  it('Try again re-renders the route; Reload page reloads; leaving the route clears the error', async () => {
    renderError();
    await screen.findByRole('alert');
    boom.fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());

    cleanup();
    renderError();
    await screen.findByRole('alert');
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location);
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Go elsewhere' }));
    expect(await screen.findByText('Page 1 drawn')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the states send nothing', async () => {
    renderTools(`${G2}/packetmonitor`, { fixtures: { 'GET /api/packets': () => ({ packets: [], total: 0, offset: 0, limit: 100 }) } });
    await screen.findByText('No packets logged yet');
    expect(fetched().length).toBeGreaterThan(0);
    expect(nonGets()).toEqual([]);
  });
});
