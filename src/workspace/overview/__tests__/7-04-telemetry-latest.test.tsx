/**
 * @vitest-environment jsdom
 *
 * Board 7-04-telemetry-latest (desktop, s7n0): Overview › Telemetry's Latest:
 * the latest reading per node per device, grouped by device, with the range,
 * search, source, type and sort controls, Jump to chips, and a star on each
 * reading the viewer may favorite.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderMessages as renderPage } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const fetched = () => vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`);

async function openLatest() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Latest' }));
  await screen.findAllByText('Kifisia Rooftop', {}, { timeout: 5000 });
}

const section = (name: string) => screen.getByRole('region', { name });
const nodeCard = (name: string, within_: HTMLElement) =>
  within(within_).getByText(name).closest<HTMLElement>('[data-testid="node-card"]')!;

describe('7-04-telemetry-latest', () => {
  it('7-04-telemetry-latest shows the board', async () => {
    renderPage('/overview/telemetry');
    await openLatest();
    expectBoard('7-04-telemetry-latest', document.body);
  });

  it('groups nodes by device, each section tagged with its node count', async () => {
    renderPage('/overview/telemetry');
    await openLatest();
    const g2 = section('Station G2');
    expect(g2).toHaveTextContent('SGStation G24 nodes');
    const kifisia = nodeCard('Kifisia Rooftop', g2);
    expect(kifisia).toHaveTextContent('4m ago');
    expect(kifisia).toHaveTextContent('Battery87%');
    expect(section('Heltec MeshCore')).toHaveTextContent('2 nodes');
  });

  it('Jump to lists each device with its tag and node count', async () => {
    renderPage('/overview/telemetry');
    await openLatest();
    const jump = screen.getByRole('group', { name: 'Jump to' });
    expect(within(jump).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'SGStation G24', 'HMHeltec MeshCore2', 'RRRooftop RAK2', 'AMAthens MQTT1',
    ]);
  });

  it('the star saves a reading to its own device\'s favorites', async () => {
    renderPage('/overview/telemetry', { fixtures: { 'POST /api/settings': () => ({ success: true }) } });
    await openLatest();
    const kifisia = nodeCard('Kifisia Rooftop', section('Station G2'));
    const star = within(kifisia).getAllByRole('button', { name: 'Add to favorites' })[0];
    fireEvent.click(star);
    expect(star).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetched().some((u) => u.startsWith('POST /api/settings?sourceId=src-g2'))).toBe(true));
  });

  it('search keeps the matching nodes', async () => {
    renderPage('/overview/telemetry');
    await openLatest();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes' }), { target: { value: 'Glyfada' } });
    await waitFor(() => expect(screen.queryByText('Kifisia Rooftop')).toBeNull());
    expect(screen.getAllByText('Glyfada Beach').length).toBeGreaterThan(0);
  });

  it('a range button refetches that window', async () => {
    renderPage('/overview/telemetry');
    await openLatest();
    fireEvent.click(within(screen.getByRole('group', { name: 'Time range' })).getByRole('button', { name: '3 d' }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/unified/telemetry?hours=72'))).toBe(true));
  });
});
