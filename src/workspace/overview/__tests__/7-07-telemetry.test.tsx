/**
 * @vitest-environment jsdom
 *
 * Board 7-07-telemetry (phone, s7n3): the page's own header with Refresh, a
 * Graphs / Latest segmented control, range and source chips, and a filter
 * sheet holding range and source for Graphs, and range, search, source, type,
 * sort and the Jump to chips for Latest.
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

const fetched = () => vi.mocked(globalThis.fetch).mock.calls.map(([u]) => String(u));

describe('7-07-telemetry', () => {
  it('7-07-telemetry shows the board', async () => {
    renderPage('/overview/telemetry', { phone: true });
    await screen.findAllByRole('heading', { name: /^Battery Level/ }, { timeout: 5000 });
    expectBoard('7-07-telemetry', document.body);
  });

  it('the header leads back to the Overview, and Refresh refetches', async () => {
    renderPage('/overview/telemetry', { phone: true });
    await screen.findAllByRole('heading', { name: /^Battery Level/ }, { timeout: 5000 });
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
    const before = fetched().filter((u) => u.includes('/api/unified/telemetry/series')).length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetched().filter((u) => u.includes('/api/unified/telemetry/series')).length).toBe(before + 1));
  });

  it('Graphs filters hold range and source', async () => {
    renderPage('/overview/telemetry', { phone: true });
    await screen.findAllByRole('heading', { name: /^Battery Level/ }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(within(sheet).getByRole('group', { name: 'Time range' })).toBeInTheDocument();
    expect(within(sheet).getByRole('combobox', { name: 'Filter by source' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('searchbox')).toBeNull();
  });

  it('Latest filters add search, type, sort and Jump to', async () => {
    renderPage('/overview/telemetry', { phone: true });
    fireEvent.click(await screen.findByRole('tab', { name: 'Latest' }));
    await screen.findAllByText('Kifisia Rooftop', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters' });
    expect(within(sheet).getByRole('searchbox', { name: 'Search nodes' })).toBeInTheDocument();
    expect(within(sheet).getByRole('combobox', { name: 'Filter by type' })).toBeInTheDocument();
    expect(within(sheet).getByRole('combobox', { name: 'Sort nodes' })).toBeInTheDocument();
    expect(within(sheet).getByRole('group', { name: 'Jump to' })).toBeInTheDocument();
  });
});
