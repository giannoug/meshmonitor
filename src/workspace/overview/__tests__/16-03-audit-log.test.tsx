/**
 * @vitest-environment jsdom
 *
 * Board 16-03-audit-log (phone, s16n0, s16n3): the Audit log as two-line rows
 * with a Filters sheet holding today's filters, the source (UI / API token)
 * and time as segmented controls, and "Show N entries".
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { gets, renderUsers } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function filters() {
  renderUsers('/overview/audit', { phone: true });
  await screen.findAllByTestId('audit-row', {}, { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  return screen.findByRole('dialog', { name: 'Filters' });
}

const lastLogsUrl = () => new URL(gets().filter((u) => u.startsWith('/api/audit?')).at(-1)!, 'http://x');

describe('16-03-audit-log', () => {
  it('16-03-audit-log shows the board', async () => {
    await filters();
    expectBoard('16-03-audit-log', document.body);
  });

  it('rows are two lines: action, then user · resource and the time', async () => {
    renderUsers('/overview/audit', { phone: true });
    const [first] = await screen.findAllByTestId('audit-row', {}, { timeout: 5000 });
    expect(first).toHaveTextContent('settings_updated');
    expect(first).toHaveTextContent('giannoug · settings');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/overview');
  });

  it('the sheet\'s controls set today\'s query; the Filters button counts them; Show closes', async () => {
    const sheet = await filters();
    fireEvent.click(within(within(sheet).getByRole('group', { name: 'Source' })).getByRole('button', { name: 'API Token Only' }));
    await waitFor(() => expect(lastLogsUrl().searchParams.get('action')).toBe('api_token_used'));
    fireEvent.click(within(within(sheet).getByRole('group', { name: 'Time' })).getByRole('button', { name: '7 d' }));
    await waitFor(() => expect(lastLogsUrl().searchParams.get('startDate')).not.toBeNull());
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show 42 entries' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).toBeNull());
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('Filters2');
  });
});
