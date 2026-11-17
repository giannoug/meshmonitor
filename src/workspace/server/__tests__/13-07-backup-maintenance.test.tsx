/**
 * @vitest-environment jsdom
 *
 * Boards 13-07 (desktop) and 13-24 (phone), Task 6.4: Server › Backup &
 * maintenance, for every viewer with settings access; each action keeps
 * today's gate, confirm and words.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/backup';
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

describe('13-07 / 13-24 backup & maintenance', () => {
  it.each([
    ['13-07-backup-maintenance', false],
    ['13-24-backup-maintenance', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    await screen.findAllByTestId('system-backup');
    await screen.findByRole('button', { name: /Restart Container/ });
    // Desktop draws the six retention rows; phone a Retention row to their page (s13n7).
    if (phone) await screen.findByRole('link', { name: /Retention/ });
    else await screen.findByLabelText('Message Retention');
    expectBoard(board, container);
  });

  it('on phone Retention is a page of its own with the six rows, saved as you go (s13n7)', async () => {
    const { log } = renderServer(PATH, { phone: true });
    const link = await screen.findByRole('link', { name: /Retention.*Messages 90 days · 6 kinds/ });
    expect(screen.queryByLabelText('Message Retention')).toBeNull();
    fireEvent.click(link);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/backup/retention'));
    const messages = await screen.findByLabelText('Message Retention');
    expect(screen.getByLabelText('MeshCore CLI History Retention')).toHaveValue(30);
    expect(screen.getAllByRole('link', { name: /Backup & maintenance/ }).some((a) => a.getAttribute('href') === '/server/backup')).toBe(true);
    // One status read for the page and its sub-page (shared).
    expect(log.reads.filter((r) => r === '/api/maintenance/status')).toHaveLength(1);
    fireEvent.change(messages, { target: { value: '45' } });
    fireEvent.blur(messages);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { messageRetentionDays: '45' } }));
  });

  it('Create writes once and reads the list again', async () => {
    const { log } = renderServer(PATH);
    await screen.findAllByTestId('system-backup');
    const before = log.reads.filter((r) => r === '/api/system/backup/list').length;
    fireEvent.click(screen.getByRole('button', { name: /Create Backup Now/ }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/system/backup', body: undefined }));
    await waitFor(() => expect(log.reads.filter((r) => r === '/api/system/backup/list').length).toBe(before + 1));
  });

  it('deleting a backup asks with today\'s words and sends today\'s request', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete meshmonitor-2026-11-16-030000' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Are you sure you want to delete the system backup "meshmonitor-2026-11-16-030000"?')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/system/backup/delete/meshmonitor-2026-11-16-030000', body: undefined }));
  });

  it('the backup schedule saves as you go through today\'s one request', async () => {
    const { log } = renderServer(PATH);
    const keep = await screen.findByLabelText('Maximum Backups to Keep');
    fireEvent.change(keep, { target: { value: '14' } });
    fireEvent.blur(keep);
    await waitFor(() =>
      expect(log.writes).toContainEqual({ method: 'POST', path: '/api/system/backup/settings', body: { enabled: true, maxBackups: 14, backupTime: '03:00' } }),
    );
  });

  it('retention saves on blur as today\'s key, and Run now runs once with no confirm (today has none)', async () => {
    const { log } = renderServer(PATH);
    const messages = await screen.findByLabelText('Message Retention');
    expect(messages).toHaveValue(90);
    fireEvent.change(messages, { target: { value: '60' } });
    fireEvent.blur(messages);
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'POST', path: '/api/settings', body: { messageRetentionDays: '60' } }));
    fireEvent.click(screen.getByRole('button', { name: /Run Maintenance Now/ }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/maintenance/run')).toHaveLength(1));
  });

  it('Restart asks with today\'s words, Enter does not confirm, and one request goes out', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: /Restart Container/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Are you sure you want to restart MeshMonitor?' });
    expect(within(sheet).getByText('The container will restart automatically and be unavailable for approximately 10-30 seconds.')).toBeInTheDocument();
    fireEvent.submit(sheet.querySelector('form') ?? sheet);
    await new Promise((r) => setTimeout(r, 20));
    expect(log.writes.filter((w) => w.path === '/api/system/restart')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Restart Container' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path === '/api/system/restart')).toHaveLength(1));
    expect(await screen.findByText('MeshMonitor is restarting…')).toBeInTheDocument();
  });

  it('outside Docker the action is today\'s Shut down', async () => {
    renderServer(PATH, { fixtures: { 'GET /api/system/status': () => ({ isDocker: false }) } });
    expect(await screen.findByText('Shutdown MeshMonitor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Shutdown/ }));
    expect(await screen.findByRole('dialog', { name: 'Are you sure you want to shut down MeshMonitor?' })).toBeInTheDocument();
  });

  it('a settings viewer: no backup list or restart is asked for; today\'s admin-only words', async () => {
    renderServer(PATH, { permissions: grants({ read: true }) });
    expect(await screen.findByText('Only an administrator can restart or shut down MeshMonitor. It affects every source.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Backup Now/ })).toBeDisabled();
    expect(screen.getByText('Only an administrator can create, download or delete system backups.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().some((u) => u.includes('/api/system/backup/list'))).toBe(false);
    expect(urls().some((u) => u.includes('/api/system/status'))).toBe(false);
  });

  it('reads once on open: no poll', async () => {
    const { log } = renderServer(PATH);
    await screen.findAllByTestId('system-backup');
    await new Promise((r) => setTimeout(r, 100));
    for (const path of ['/api/maintenance/status', '/api/maintenance/size', '/api/system/backup/list', '/api/system/backup/settings']) {
      expect(log.reads.filter((r) => r === path)).toHaveLength(1);
    }
  });
});
