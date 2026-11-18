/**
 * @vitest-environment jsdom
 *
 * Boards 9-03 (Interfaces), 9-04 (Paths) and 9-12 (phone Interfaces and
 * Paths), native (Task 7.6). Probe is today's one probe packet per press with
 * no retry ("Sends 1 probe packet"); the Remote Fleet query one status request
 * per press; Add to Dashboard saves today's telemetry favourites and sends
 * nothing on the network.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RNS, rnsInterfaces } from '../../__fixtures__/reticulum';
import { RNS_URL, renderReticulum, rnsRequests } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const row = (name: string) => screen.getByText(name, { selector: 'strong' }).closest('tr')!;

/** Holds every probe of `hash` unanswered, as a probe in flight. */
function holdProbe(hash: string) {
  const real = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((u, init) =>
    String(u).endsWith('/paths/probe') && String(init?.body).includes(hash) ? new Promise<Response>(() => {}) : real(u, init),
  );
}

async function probe(name: string) {
  const button = within(row(name)).getByRole('button', { name: 'Probe' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('9-03-interfaces', () => {
  it('9-03-interfaces shows the board', async () => {
    // Two polls (the second a Refresh): the counters grew, and Default Interface is new, so its rate waits.
    let polls = 0;
    const { container } = renderReticulum(`${RNS_URL}/interfaces`, {
      fixtures: {
        'GET /api/sources/:id/reticulum/interfaces': () => {
          polls += 1;
          const rows = rnsInterfaces.map((i) => ({ ...i, txBytes: i.txBytes + polls * 600, rxBytes: i.rxBytes + polls * 2000 }));
          return { success: true, data: polls === 1 ? rows.filter((i) => i.interfaceName !== 'Default Interface') : rows };
        },
      },
    });
    await screen.findByText('RX rate');
    expect(screen.getAllByText('Rate pending next poll…')).toHaveLength(3);
    await waitFor(() => expect(container.querySelectorAll('path[data-tone]').length).toBeGreaterThan(0));
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    await screen.findByText('Default Interface', { selector: 'h2' });
    await waitFor(() => expect(screen.getAllByText('Rate pending next poll…')).toHaveLength(1));
    expectBoard('9-03-interfaces', container);
  });

  it('Add to Dashboard saves the chart for every interface, once each, and sends nothing on the network', async () => {
    const posts: unknown[] = [];
    const { log } = renderReticulum(`${RNS_URL}/interfaces`, {
      fixtures: {
        'POST /api/settings': (_u: URL, init?: RequestInit) => {
          posts.push(JSON.parse(String(init?.body)));
          return { success: true };
        },
      },
    });
    await screen.findByText('RX rate');
    const add = within(screen.getByRole('region', { name: 'RX rate' })).getByRole('button', { name: /Add to Dashboard/ });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    await waitFor(() => expect(posts).toHaveLength(4));
    await pause();
    expect(posts).toHaveLength(4);
    expect(log.writes).toEqual([]);
  });
});

describe('9-04-paths', () => {
  it('9-04-paths shows the board', async () => {
    const { container } = renderReticulum(`${RNS_URL}/paths`);
    await screen.findByText('Glyfada Propagation');
    await probe('Kifisia Sideband');
    await within(row('Kifisia Sideband')).findByText(/1840ms · 2 hops/);
    await probe('Glyfada Propagation');
    await within(row('Glyfada Propagation')).findByText('No reply');
    holdProbe(RNS.psychiko);
    await probe('Psychiko NomadNet');
    await within(row('Psychiko NomadNet')).findByText('Probing…');
    const input = screen.getByRole('textbox', { name: 'Destination hash…' });
    fireEvent.change(input, { target: { value: RNS.halandriT } });
    const query = screen.getByRole('button', { name: 'Query' });
    await waitFor(() => expect(query).toBeEnabled());
    fireEvent.click(query);
    await screen.findByText(/is reachable/);
    expectBoard('9-04-paths', container);
  });

  it('Probe shows "Sends 1 probe packet" and sends one probe per press, with no retry', async () => {
    const { log } = renderReticulum(`${RNS_URL}/paths`);
    await screen.findByText('Glyfada Propagation');
    expect(screen.getByText(/sends 1 probe packet/)).toBeInTheDocument();
    await probe('Glyfada Propagation');
    await within(row('Glyfada Propagation')).findByText('No reply');
    await pause();
    expect(log.writes).toEqual([{ method: 'POST', path: '/api/sources/src-rns/reticulum/paths/probe', body: { destinationHash: RNS.glyfada } }]);
  });

  it('the Remote Fleet query is one status request per press, with its Sends line', async () => {
    renderReticulum(`${RNS_URL}/paths`);
    await screen.findByText('Glyfada Propagation');
    expect(screen.getByText(/Sends 1 status request to that transport node/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Destination hash…' }), { target: { value: RNS.halandriT } });
    const query = screen.getByRole('button', { name: 'Query' });
    await waitFor(() => expect(query).toBeEnabled());
    fireEvent.click(query);
    await screen.findByText(/112 known path/);
    await pause();
    expect(rnsRequests('GET', /\/remote-status\//)).toBe(1);
  });

  it("without nodes:write there is no Probe, as today", async () => {
    renderReticulum(`${RNS_URL}/paths`, { permissions: { bySource: { 'src-rns': { nodes: { read: true, write: false }, messages: { read: true, write: false } } } } });
    await screen.findByText('Glyfada Propagation');
    expect(screen.queryByRole('button', { name: 'Probe' })).toBeNull();
  });
});

describe('9-12-interfaces-paths', () => {
  it('9-12-interfaces-paths shows the board', async () => {
    const { container } = renderReticulum(`${RNS_URL}/paths`, { phone: true });
    await screen.findByText('Glyfada Propagation');
    const glyfada = screen.getByText('Glyfada Propagation').closest('li')!;
    const button = within(glyfada).getByRole('button', { name: 'Probe' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await within(glyfada).findByText('No reply');
    fireEvent.change(screen.getByRole('textbox', { name: 'Destination hash…' }), { target: { value: RNS.halandriT } });
    const query = screen.getByRole('button', { name: 'Query' });
    await waitFor(() => expect(query).toBeEnabled());
    fireEvent.click(query);
    await screen.findByText(/is reachable/);
    expect(screen.getByRole('link', { name: 'Interfaces' })).toHaveAttribute('href', `${RNS_URL}/interfaces`);
    expectBoard('9-12-interfaces-paths', container);
  });
});
