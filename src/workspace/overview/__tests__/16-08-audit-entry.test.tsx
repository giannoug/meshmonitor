/**
 * @vitest-environment jsdom
 *
 * Board 16-08-audit-entry (phone, s16n0): one audit entry as a sheet: today's
 * fields (User, IP Address, Resource, Details) and, when the entry carries
 * them, today's Before / After values.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { auditLogs } from '../../__fixtures__/users';
import { renderUsers } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

async function entry(opts = {}) {
  renderUsers('/overview/audit', { phone: true, ...opts });
  const [first] = await screen.findAllByTestId('audit-row', {}, { timeout: 5000 });
  fireEvent.click(first);
  return screen.findByRole('dialog', { name: 'settings_updated' });
}

describe('16-08-audit-entry', () => {
  it('16-08-audit-entry shows the board', async () => {
    await entry();
    expectBoard('16-08-audit-entry', document.body);
  });

  it('shows today\'s fields and the pretty details', async () => {
    const sheet = await entry();
    expect(sheet).toHaveTextContent('Usergiannoug');
    expect(sheet).toHaveTextContent('IP Address192.168.1.23');
    expect(sheet).toHaveTextContent('Resourcesettings');
    expect(within(sheet).getByText(/"keys": \[/)).toBeInTheDocument();
    expect(within(sheet).queryByText('Before:')).toBeNull();
  });

  it('shows today\'s Before / After when the entry carries them', async () => {
    const withValues = [{ ...auditLogs[0], valueBefore: '{"hop_limit":3}', valueAfter: '{"hop_limit":4}' }, ...auditLogs.slice(1)];
    const sheet = await entry({ fixtures: { 'GET /api/audit': () => ({ logs: withValues, total: 42 }) } });
    expect(within(sheet).getByText('Before:').parentElement).toHaveTextContent('"hop_limit": 3');
    expect(within(sheet).getByText('After:').parentElement).toHaveTextContent('"hop_limit": 4');
  });

  it('Escape closes the entry', async () => {
    await entry();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'settings_updated' })).toBeNull());
  });
});
