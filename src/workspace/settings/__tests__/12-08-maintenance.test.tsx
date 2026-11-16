/**
 * @vitest-environment jsdom
 *
 * Boards 12-08-maintenance (desktop), 12-18-maintenance and 12-27-restore-confirm
 * (phone), Task 5.7: the Maintenance page is the firmware card, Reload from
 * radio with today's changes table, the device backups (today's schedule, list,
 * create, download, restore after the server's summary, delete) and the danger
 * zone. Maintenance › Backup is the reload and backups part alone.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, renderSettings } from './renderSettings';
import { maintenanceFixtures, reloadFixtures } from './maintenanceFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

/** Requests sent so far as `METHOD path`, with their JSON bodies. */
const sent = () =>
  vi.mocked(fetch).mock.calls.map(([u, init]) => ({
    what: `${(init?.method ?? 'GET').toUpperCase()} ${new URL(String(u), 'http://x').pathname}`,
    body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
  }));

const fixtures = () => ({ ...maintenanceFixtures, ...reloadFixtures() });
const backupRow = async (file: string) =>
  (await screen.findByText(new RegExp(file.replace('.', '\\.')), {}, { timeout: 10_000 })).closest('li')!;

async function reload() {
  fireEvent.click(await screen.findByRole('button', { name: 'Reload Config' }, { timeout: 10_000 }));
  await screen.findByText('3 change(s) detected', {}, { timeout: 10_000 });
}

describe('12-08-maintenance', () => {
  it('12-08-maintenance shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(`${g2}/settings/maintenance`, { fixtures: fixtures() });
    await screen.findByRole('link', { name: /Firmware.*2\.7\.15.*2\.8\.2/ }, { timeout: 10_000 });
    await reload();
    fireEvent.click(within(await backupRow('g2-1111.yaml')).getByRole('button', { name: 'Restore' }));
    await screen.findByRole('dialog', { name: 'Restore this backup?' });
    expectBoard('12-08-maintenance', document.body);
  });

  it('12-18-maintenance shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/maintenance`, { phone: true, fixtures: fixtures() });
    await screen.findByRole('link', { name: /Firmware/ }, { timeout: 10_000 });
    await backupRow('g2-1112.yaml');
    await reload();
    expectBoard('12-18-maintenance', container);
  });

  it('12-27-restore-confirm shows the board, and restores only after Restore', async () => {
    renderSettings(`${g2}/settings/maintenance`, { phone: true, fixtures: fixtures() });
    fireEvent.click(within(await backupRow('g2-1111.yaml')).getByRole('button', { name: 'Restore' }));
    const sheet = await screen.findByRole('dialog', { name: 'Restore this backup?' });
    expectBoard('12-27-restore-confirm', document.body);
    // Today's summary: the slots it overwrites, the reboot note; and the sheet's Sends line.
    expect(within(sheet).getByText('Slot 2: Athens Ops')).toBeInTheDocument();
    expect(within(sheet).getByText('The device may reboot to apply the new configuration.')).toBeInTheDocument();
    expect(within(sheet).getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(sent().some((r) => r.what.startsWith('POST /api/backup/restore'))).toBe(false);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(sent().find((r) => r.what === 'POST /api/backup/restore/g2-1111.yaml')?.body).toEqual({ sourceId: SOURCE_IDS.g2 }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Reload from radio', () => {
  it('runs only on a click, says what it sends, and lists what changed', async () => {
    renderSettings(`${g2}/settings/maintenance/backup`, { fixtures: fixtures() });
    await screen.findByRole('button', { name: 'Reload Config' }, { timeout: 10_000 });
    expect(screen.getByText('Sends config requests to this node')).toBeInTheDocument();
    expect(sent().some((r) => r.what === 'POST /api/nodes/refresh')).toBe(false);
    await reload();
    expect(sent().filter((r) => r.what === 'POST /api/nodes/refresh')).toHaveLength(1);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'FieldPreviousCurrent',
      'Device: Role01',
      'LoRa: Hop Limit34',
      'LoRa: TX Power2720',
    ]);
  });
});

describe('Maintenance › Backup', () => {
  it('shows today\'s schedule, the saved backups and the Share and import link', async () => {
    renderSettings(`${g2}/settings/maintenance/backup`, { fixtures: fixtures() });
    expect(await screen.findByRole('switch', { name: 'Enable Automatic Backups' }, { timeout: 10_000 })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: 'Maximum Backups to Keep' })).toHaveValue(7);
    expect(screen.getByLabelText('Daily Backup Time')).toHaveValue('03:00');
    await backupRow('g2-1110.yaml');
    expect(screen.getByRole('heading', { name: 'Backups · 3 stored' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Share and import' })).toHaveAttribute('href', `${g2}/settings/channels/share`);
    // The page's header: Maintenance › Backup.
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Maintenance' })).toHaveAttribute('href', `${g2}/settings/maintenance`);
  });

  it('a schedule edit saves from today\'s save bar', async () => {
    renderSettings(`${g2}/settings/maintenance/backup`, {
      fixtures: { ...fixtures(), 'POST /api/backup/settings': () => ({ success: true }) },
    });
    fireEvent.click(await screen.findByRole('switch', { name: 'Enable Automatic Backups' }, { timeout: 10_000 }));
    fireEvent.click(await screen.findByRole('button', { name: /^Save/ }));
    await waitFor(() =>
      expect(sent().find((r) => r.what === 'POST /api/backup/settings')?.body).toEqual({
        enabled: false, maxBackups: 7, backupTime: '03:00', sourceId: SOURCE_IDS.g2,
      }),
    );
  });

  it('Delete asks with today\'s words, then deletes and reads the list again', async () => {
    renderSettings(`${g2}/settings/maintenance/backup`, {
      fixtures: { ...fixtures(), 'DELETE /api/backup/delete/:file': () => ({ success: true }) },
    });
    fireEvent.click(within(await backupRow('g2-1110.yaml')).getByRole('button', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Are you sure you want to delete the backup "g2-1110.yaml"?' });
    const lists = () => sent().filter((r) => r.what === 'GET /api/backup/list').length;
    const before = lists();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(sent().some((r) => r.what === 'DELETE /api/backup/delete/g2-1110.yaml')).toBe(true));
    await waitFor(() => expect(lists()).toBe(before + 1));
  });

  it('without configuration:write it is View only: create, download, restore, delete and the schedule are off; Reload stays (as today)', async () => {
    renderSettings(`${g2}/settings/maintenance/backup`, {
      fixtures: fixtures(),
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false } } } },
    });
    const row = await backupRow('g2-1112.yaml');
    for (const name of ['Download', 'Restore', 'Delete']) expect(within(row).getByRole('button', { name })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create Backup Now' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Enable Automatic Backups' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reload Config' })).toBeEnabled();
    expect(within(screen.getByRole('main')).getByText('View only')).toBeInTheDocument();
  });

  it('the firmware card is shown only with today\'s gate (an admin, OTA on)', async () => {
    renderSettings(`${g2}/settings/maintenance`, {
      fixtures: { ...fixtures(), 'GET /api/health': () => ({ status: 'ok', version: 'fixture', firmwareOtaEnabled: false }) },
    });
    await backupRow('g2-1112.yaml');
    expect(screen.queryByRole('link', { name: /Firmware/ })).toBeNull();
  });
});
