/**
 * @vitest-environment jsdom
 *
 * Board o5-audit (desktop, s16n0, s16n3): Overview › Audit log, install-wide,
 * on today's endpoints: today's 30-day stats above the list, today's filters
 * (search, user, source, action, resource, dates) plus time presets, today's
 * table with the expanding detail row, Per Page and Previous / Next at the end,
 * Export CSV in the header, and MeshCore CLI activity (the board's Repeater
 * consoles). Needs audit:read.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import AuditLogTab from '../../../components/AuditLogTab';
import { usersFixtures } from '../../__fixtures__/users';
import { gets, renderUsers, writes } from './renderUsers';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const AUDIT_READ = { global: { audit: { read: true, write: false } }, bySource: {} };

async function audit(opts = {}) {
  renderUsers('/overview/audit', opts);
  return screen.findByRole('table', { name: 'Audit Log' }, { timeout: 5000 });
}

const auditGets = () => gets().filter((u) => u.startsWith('/api/audit') || u === '/api/users');
const lastLogsUrl = () => new URL(auditGets().filter((u) => u.startsWith('/api/audit?')).at(-1)!, 'http://x');

describe('o5-audit', () => {
  it('o5-audit shows the board', async () => {
    await audit();
    expectBoard('o5-audit', document.body);
  });

  it('reads the same endpoints as today\'s page', async () => {
    const today = renderWorkspace(<ToastProvider><AuditLogTab /></ToastProvider>, { fixtures: usersFixtures, permissions: AUDIT_READ, isAdmin: true });
    await screen.findByText('settings_updated', { selector: 'td' }, { timeout: 5000 });
    const classic = [...new Set(auditGets())].sort();
    today.unmount();
    await audit();
    await screen.findByText('Total Events (30 days)');
    expect([...new Set(auditGets())].sort()).toEqual(classic);
    expect(classic).toEqual(['/api/audit/stats/summary?days=30', '/api/audit?limit=100&offset=0', '/api/users']);
    expect(writes()).toEqual([]);
  });

  it('shows today\'s columns and stats; a row expands today\'s details', async () => {
    const table = await audit();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Details']);
    expect(screen.getByText('Total Events (30 days)').parentElement).toHaveTextContent('599');
    expect(screen.getByText('Most Active User').parentElement).toHaveTextContent('giannoug (530)');
    const row = within(table).getByText('permissions_updated').closest('tr')!;
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(within(table).getByText(/"sourceId": "src-rak"/)).toBeInTheDocument();
    // An entry without a user is today's System.
    expect(within(table).getByText('position_estimation_run').closest('tr')).toHaveTextContent('System');
  });

  it('today\'s filters drive today\'s query; the search field keeps today\'s placeholder', async () => {
    await audit();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveAttribute('placeholder', 'Search in details...');
    fireEvent.change(screen.getByLabelText('User'), { target: { value: '3' } });
    await waitFor(() => expect(lastLogsUrl().searchParams.get('userId')).toBe('3'));
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'ui' } });
    await waitFor(() => expect(lastLogsUrl().searchParams.get('excludeAction')).toBe('api_token_used'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(lastLogsUrl().search).toBe('?limit=100&offset=0'));
  });

  it('Last 24 h asks for entries from the last day; Dates… shows today\'s start and end dates', async () => {
    await audit();
    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'Last 24 h' }));
    await waitFor(() => expect(lastLogsUrl().searchParams.get('startDate')).not.toBeNull());
    const start = Number(lastLogsUrl().searchParams.get('startDate'));
    expect(start).toBeGreaterThanOrEqual(before - 86_400_000);
    expect(start).toBeLessThanOrEqual(Date.now() - 86_400_000);
    expect(screen.getByRole('button', { name: 'Last 24 h' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dates…' }));
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-11-01' } });
    await waitFor(() => expect(lastLogsUrl().searchParams.get('startDate')).toBe(String(new Date('2026-11-01').getTime())));
    expect(screen.getByRole('button', { name: 'Last 24 h' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('MeshCore CLI activity is today\'s CLI view', async () => {
    await audit();
    fireEvent.click(screen.getByRole('button', { name: 'MeshCore CLI activity' }));
    expect(screen.getByRole('button', { name: 'MeshCore CLI activity' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('table', { name: 'Audit Log' })).toBeNull();
  });

  it('a non-admin with audit:read gets the page', async () => {
    await audit({ permissions: AUDIT_READ });
    expect(screen.getByText('settings_updated', { selector: 'td' })).toBeInTheDocument();
  });

  it('without audit:read: today\'s denial and no audit request', async () => {
    renderUsers('/overview/audit', { permissions: { global: {}, bySource: {} } });
    expect(await screen.findByText('You do not have permission to view audit logs.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(auditGets()).toEqual([]);
  });
});
