/**
 * @vitest-environment jsdom
 *
 * Boards 12-09-firmware-update (desktop) and 12-19-firmware (phone), Task 5.7:
 * Maintenance › Firmware draws today's OTA update (useFirmwareUpdate, Rule X)
 * as the board, for an admin on a server with OTA on: This radio (installed,
 * the channel as a segmented control, Check Now), release cards, and the
 * wizard in the docked Sheet. The boards draw the flash step (Cancel; s12n4),
 * the stopped flash and another device's unsupported-board card at once; each
 * state is rendered and the texts joined (Ruling 2.3's way). Every safety rail
 * of today's section is tested here on the Workspace page.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import { firmwareFixtures, firmwareStatus, flashAwaiting, flashFailed, rakGateway } from './maintenanceFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const path = `${g2}/settings/maintenance/firmware`;

/** The page's text in each state: releases, the flash step, the stopped flash, and a RAK4631 gateway. */
async function joinedStates(phone: boolean): Promise<HTMLElement> {
  const texts: string[] = [];
  renderSettings(path, { phone, fixtures: firmwareFixtures });
  await screen.findAllByRole('button', { name: 'Install' }, { timeout: 10_000 });
  texts.push(document.body.textContent ?? '');
  cleanup();
  renderSettings(path, { phone, fixtures: { ...firmwareFixtures, ...flashAwaiting } });
  await screen.findByRole('button', { name: /Cancel Update/ }, { timeout: 10_000 });
  texts.push(document.body.textContent ?? '');
  cleanup();
  renderSettings(path, { phone, fixtures: { ...firmwareFixtures, ...flashFailed } });
  await screen.findByRole('button', { name: /Retry Flash/ }, { timeout: 10_000 });
  texts.push(document.body.textContent ?? '');
  cleanup();
  renderSettings(path, { phone, fixtures: { ...firmwareFixtures, ...rakGateway } });
  await screen.findByText(/cannot be updated over Wi-Fi/, {}, { timeout: 10_000 });
  texts.push(document.body.textContent ?? '');
  const joined = document.createElement('div');
  joined.textContent = texts.join(' ');
  return joined;
}

describe('12-09-firmware-update', () => {
  it('12-09-firmware-update shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expectBoard('12-09-firmware-update', await joinedStates(false));
  });

  it('12-19-firmware shows the board', async () => {
    expectBoard('12-19-firmware', await joinedStates(true));
  });

  it('the header names Maintenance, who it is for and that it sends nothing on the mesh', async () => {
    renderSettings(path, { fixtures: firmwareFixtures });
    expect(await screen.findByText('Admins only · OTA updates are on for this server', { exact: false }, { timeout: 10_000 })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Maintenance' })).toHaveAttribute('href', `${g2}/settings/maintenance`);
    expect(await screen.findByText('Over Wi-Fi to Station G2 · Sends nothing on the mesh')).toBeInTheDocument();
  });
});

const sent = () =>
  vi.mocked(fetch).mock.calls.map(([u, init]) => ({
    what: `${(init?.method ?? 'GET').toUpperCase()} ${new URL(String(u), 'http://x').pathname}`,
    body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
  }));
const posted = (path: string) => sent().find((r) => r.what === `POST ${path}`)?.body;
/** The channel control, once today's saved channel has loaded (it syncs from the status reply). */
async function channels() {
  const group = await screen.findByRole('radiogroup', { name: 'Release Channel' }, { timeout: 10_000 });
  await waitFor(() => expect(screen.getByText(/Last Checked:/).textContent).not.toMatch(/Never/));
  return group;
}
const gateway = { gatewayIp: '192.168.1.40', hwModel: 43, currentVersion: '2.7.15.567b8ea', sourceId: SOURCE_IDS.g2 };

describe('Maintenance › Firmware: today\'s requests and safety rails', () => {
  it('Install on a release starts today\'s update for that version', async () => {
    renderSettings(path, { fixtures: { ...firmwareFixtures, 'POST /api/firmware/update': () => ({ success: true }) } });
    const cards = await screen.findByRole('list', { name: 'Releases' }, { timeout: 10_000 });
    const latest = within(cards).getAllByRole('listitem')[0];
    expect(within(latest).getByText('Latest')).toBeInTheDocument();
    expect(within(latest).getByRole('link', { name: 'Release Notes' })).toHaveAttribute('href', 'https://github.com/meshtastic/firmware/releases/tag/v2.8.2');
    fireEvent.click(within(latest).getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(posted('/api/firmware/update')).toEqual({ targetVersion: '2.8.2', ...gateway }));
  });

  it('the channel is a segmented control; a change saves with Save (today\'s), Custom URL warns and waits for its saved URL', async () => {
    renderSettings(path, { fixtures: { ...firmwareFixtures, 'POST /api/firmware/channel': () => ({ success: true }) } });
    const group = await channels();
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Stable', 'Alpha (Pre-release)', 'Nightly (Develop)', 'Custom URL', 'Local File (Upload)']);
    expect(within(group).getByRole('radio', { name: 'Stable' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(within(group).getByRole('radio', { name: 'Custom URL' }));
    expect(screen.getByText(/does not check that the downloaded file is firmware for this board/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install from URL' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: /Custom URL/ }), { target: { value: 'https://example.com/fw.bin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted('/api/firmware/channel')).toEqual({ channel: 'custom', customUrl: 'https://example.com/fw.bin' }));
  });

  it('Nightly shows today\'s warning', async () => {
    renderSettings(path, { fixtures: firmwareFixtures });
    fireEvent.click(within(await channels()).getByRole('radio', { name: 'Nightly (Develop)' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nightly builds are untested develop snapshots');
  });

  it('a local file installs only after the acknowledgement', async () => {
    renderSettings(path, {
      fixtures: {
        ...firmwareFixtures,
        ...firmwareStatus({ channel: 'local', stagedUpload: { originalName: 'custom.bin', size: 2_097_152 } }),
        'POST /api/firmware/update': () => ({ success: true }),
      },
    });
    expect(await screen.findByText('custom.bin (2.00 MB)', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText(/does not check that an uploaded file is firmware for this board/)).toBeInTheDocument();
    const install = screen.getByRole('button', { name: 'Install uploaded firmware' });
    expect(install).toBeDisabled();
    fireEvent.click(screen.getByTestId('firmware-ack-risk'));
    fireEvent.click(install);
    await waitFor(() => expect(posted('/api/firmware/update')).toEqual({ useStagedUpload: true, ...gateway }));
  });

  it('the sibling-build warning shows in the wizard at a confirm', async () => {
    renderSettings(path, {
      fixtures: {
        ...firmwareFixtures,
        ...firmwareStatus({
          status: {
            state: 'awaiting-confirm', step: 'extract', message: 'Ready', logs: [], targetVersion: '2.8.2', sourceId: SOURCE_IDS.g2,
            warnings: [{ code: 'OTA_SIBLING_BUILD', board: 'heltec-v3', boardLabel: 'Heltec V3', sibling: 'heltec-v3-tft', siblingLabel: 'Heltec V3 TFT', message: '' }],
          },
        }),
      },
    });
    const sheet = await screen.findByRole('dialog', { name: 'Install 2.8.2' }, { timeout: 10_000 });
    expect(within(sheet).getByTestId('ota-sibling-warning')).toHaveTextContent('This will flash Heltec V3. If your node is a Heltec V3 TFT');
    expect(within(sheet).getByText('Over Wi-Fi to Station G2 · Sends nothing on the mesh')).toBeInTheDocument();
  });

  it('a half-flashed node shows today\'s recovery panel; Clear Flag & Retry needs the node online', async () => {
    const preflight = firmwareStatus({
      status: { state: 'awaiting-confirm', step: 'preflight', message: 'Preflight passed', logs: [], targetVersion: '2.8.2', sourceId: SOURCE_IDS.g2 },
    });
    renderSettings(path, {
      fixtures: {
        ...firmwareFixtures,
        ...preflight,
        'GET /api/poll': () => ({ ...athensFixture.poll, connection: { ...athensFixture.poll.connection, nodeResponsive: false } }),
        'POST /api/firmware/update/confirm': () =>
          new Response(JSON.stringify({ error: 'Node !a1b2c300 is flagged half-flashed' }), { status: 409, headers: { 'content-type': 'application/json' } }),
      },
    });
    const sheet = await screen.findByRole('dialog', { name: 'Install 2.8.2' }, { timeout: 10_000 });
    expect(within(sheet).getByText(/one-time OTA bootloader flash via USB/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Confirm & Proceed' }));
    expect(await within(sheet).findByText('Device flagged as half-flashed')).toBeInTheDocument();
    expect(within(sheet).getByText(/Node is not online and accepting connections yet/)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Clear Flag & Retry/ })).toBeDisabled();
  });

  it('Escape closes only the wizard sheet; the update is not cancelled and can be shown again', async () => {
    renderSettings(path, { fixtures: { ...firmwareFixtures, ...flashFailed } });
    const sheet = await screen.findByRole('dialog', { name: 'Install 2.8.2' }, { timeout: 10_000 });
    expect(within(sheet).getByText('Preflight')).toBeInTheDocument();
    expect(within(sheet).getByRole('alert')).toHaveTextContent('connection lost');
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'Firmware Updates' })).toBeInTheDocument();
    expect(sent().some((r) => r.what.startsWith('POST /api/firmware/update'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Show the update' }));
    expect(await screen.findByRole('dialog', { name: 'Install 2.8.2' })).toBeInTheDocument();
  });

  it('Retry Flash sends today\'s retry', async () => {
    renderSettings(path, { fixtures: { ...firmwareFixtures, ...flashFailed, 'POST /api/firmware/update/retry': () => ({ success: true }) } });
    fireEvent.click(await screen.findByRole('button', { name: /Retry Flash/ }, { timeout: 10_000 }));
    await waitFor(() => expect(posted('/api/firmware/update/retry')).toEqual({ sourceId: SOURCE_IDS.g2 }));
  });

  it('a configuration backup restores after a plain confirm that says what it sends', async () => {
    const backup = { filename: 'g2-pre-ota.yaml', path: '/data/fw/g2-pre-ota.yaml', timestamp: Date.parse('2026-11-12T03:00:00Z'), size: 4096 };
    renderSettings(path, {
      fixtures: {
        ...firmwareFixtures,
        'GET /api/firmware/backups': () => ({ success: true, backups: [backup] }),
        'POST /api/firmware/restore': () => ({ success: true }),
      },
    });
    const list = await screen.findByRole('list', { name: 'Configuration Backups' }, { timeout: 10_000 });
    fireEvent.click(within(list).getByRole('button', { name: 'Restore' }));
    const sheet = await screen.findByRole('dialog', { name: 'Restore configuration from backup "g2-pre-ota.yaml"?' });
    expect(within(sheet).getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(posted('/api/firmware/restore')).toBeUndefined();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(posted('/api/firmware/restore')).toEqual({ gatewayIp: '192.168.1.40', backupPath: backup.path }));
  });

  it('is not offered without today\'s gate (an admin, OTA on)', async () => {
    renderSettings(path, {
      fixtures: firmwareFixtures,
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: true } } } },
    });
    await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Firmware Updates'));
    expect(screen.queryByRole('radiogroup', { name: 'Release Channel' })).toBeNull();
  });
});

