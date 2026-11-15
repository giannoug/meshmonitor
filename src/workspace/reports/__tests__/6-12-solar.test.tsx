/**
 * @vitest-environment jsdom
 *
 * Board 6-12-solar (phone, s6n2/s6n3): Run analysis and Run forecast under
 * the title, the summary, the forecast, the node cards, and two ≥52 px rows
 * that open sheets — a card's daily patterns table (s6n2) and the manual
 * classification.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const ROUTE = '/overview/reports/solar';

async function runAndOpenGlyfada() {
  fireEvent.click(await screen.findByRole('button', { name: 'Run analysis' }, { timeout: 5000 }));
  fireEvent.click(screen.getByRole('button', { name: 'Run forecast' }));
  await screen.findByText('Solar Forecast');
  fireEvent.click((await screen.findAllByRole('button', { name: /Glyfada Beach/ }))[0]);
}

describe('6-12-solar', () => {
  it('6-12-solar shows the board', async () => {
    const { container } = renderReports(ROUTE, { phone: true });
    await runAndOpenGlyfada();
    await screen.findByRole('button', { name: /Recent daily patterns/ });
    expectBoard('6-12-solar', container);
  });

  it('a card’s daily patterns open in a sheet, not inline', async () => {
    renderReports(ROUTE, { phone: true });
    await runAndOpenGlyfada();
    expect(screen.queryByText('Sunrise')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Recent daily patterns/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Glyfada Beach' });
    expect(within(sheet).getByText('Sunrise')).toBeInTheDocument();
    expect(within(sheet).getAllByRole('row')).toHaveLength(4);
  });

  it('the forecast days are tiles, not today’s five-column table', async () => {
    renderReports(ROUTE, { phone: true });
    await runAndOpenGlyfada();
    expect(screen.queryByText('Historical Wh')).toBeNull();
    expect(screen.getByText('17 Wh').parentElement).toHaveTextContent('Low');
  });

  it('the manual classification opens in a sheet', async () => {
    renderReports(ROUTE, { phone: true });
    await runAndOpenGlyfada();
    expect(screen.queryByRole('button', { name: 'Mark as solar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Manual solar classification/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Manual solar classification' });
    expect(within(sheet).getByRole('button', { name: 'Mark as solar' })).toBeInTheDocument();
  });
});
