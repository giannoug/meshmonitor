/**
 * @vitest-environment jsdom
 *
 * Board 7-03-telemetry-graphs (desktop, s7n0–s7n2): Overview › Telemetry's
 * Graphs: the range, the source filter and Refresh; favorited series by
 * category, each card with Split by source, device tags in its legend and a
 * menu holding Y-axis range, Export CSV and Remove from favorites.
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

async function card(title: RegExp): Promise<HTMLElement> {
  const [heading] = await screen.findAllByRole('heading', { name: title }, { timeout: 5000 });
  return heading.closest<HTMLElement>('[data-testid="combined-telemetry-chart"]')!;
}

async function openMenu(title: RegExp): Promise<HTMLElement> {
  fireEvent.click(within(await card(title)).getByRole('button', { name: 'Chart actions' }));
  return screen.findByRole('menu');
}

describe('7-03-telemetry-graphs', () => {
  it('7-03-telemetry-graphs shows the board', async () => {
    renderPage('/overview/telemetry');
    await openMenu(/^Temperature/);
    expectBoard('7-03-telemetry-graphs', document.body);
  });

  it('groups the favorited series by category, with device tags in each legend', async () => {
    renderPage('/overview/telemetry');
    const battery = await card(/^Battery Level/);
    const power = screen.getByRole('region', { name: 'Power' });
    expect(within(power).getAllByTestId('combined-telemetry-chart')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Environment & Weather' })).toBeInTheDocument();
    const legend = within(battery).getByRole('list', { name: 'Sources' });
    expect(legend).toHaveTextContent('SGAMMerged: Station G2, Athens MQTT');
  });

  it('Split by source draws one line per device', async () => {
    renderPage('/overview/telemetry');
    const battery = await card(/^Battery Level/);
    const split = within(battery).getByRole('button', { name: 'Split by source' });
    fireEvent.click(split);
    expect(split).toHaveAttribute('aria-pressed', 'true');
    const items = within(within(battery).getByRole('list', { name: 'Sources' })).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['SGStation G2', 'AMAthens MQTT']);
  });

  it('a range button refetches that window', async () => {
    renderPage('/overview/telemetry');
    await card(/^Battery Level/);
    const range = screen.getByRole('group', { name: 'Time range' });
    fireEvent.click(within(range).getByRole('button', { name: '15 m' }));
    expect(within(range).getByRole('button', { name: '15 m' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetched().some((u) => u.includes('/api/unified/telemetry/series?hours=0.25'))).toBe(true));
  });

  it('the source filter keeps the series a device holds', async () => {
    renderPage('/overview/telemetry');
    await card(/^Voltage/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by source' }), { target: { value: 'src-mqtt' } });
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Voltage/ })).toBeNull());
    expect(screen.getByRole('heading', { name: /^Humidity/ })).toBeInTheDocument();
  });

  it('the menu removes the series from every favorites list the viewer may change', async () => {
    renderPage('/overview/telemetry', { fixtures: { 'POST /api/settings': () => ({ success: true }) } });
    const menu = await openMenu(/^Temperature/);
    expect(menu).toHaveTextContent('Temperature · Kifisia Rooftop');
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Remove from favorites/ }));
    await waitFor(() => {
      const posts = fetched().filter((u) => u.startsWith('POST /api/settings'));
      expect(posts.some((u) => u.includes('sourceId=src-g2'))).toBe(true);
      expect(posts.some((u) => u.includes('sourceId=src-mqtt'))).toBe(true);
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('the menu opens the Y-axis range editor', async () => {
    renderPage('/overview/telemetry');
    const menu = await openMenu(/^Temperature/);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Y-axis range/ }));
    expect(await within(await card(/^Temperature/)).findByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('with no favorites says how to add one', async () => {
    renderPage('/overview/telemetry', { fixtures: { 'GET /api/unified/telemetry/series': () => ({ success: true, data: { series: [] } }) } });
    expect(await screen.findByText(/No favorited telemetry yet/)).toBeInTheDocument();
  });
});
