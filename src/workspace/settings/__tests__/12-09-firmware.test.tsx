/**
 * @vitest-environment jsdom
 *
 * Boards 12-09-firmware-update (desktop) and 12-19-firmware (phone), Task 5.7:
 * Maintenance › Firmware is today's OTA wizard (FirmwareUpdateSection) under
 * the Workspace header, for an admin on a server with OTA on. The boards draw
 * the release list, the flash step (Cancel; s12n4: Confirm & Proceed sits on
 * it), the stopped flash and another device's unsupported-board card at once; the section shows one state at a time, so each is rendered
 * and the texts are joined (Ruling 2.3's way).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';
import { firmwareFixtures, flashAwaiting, flashFailed, rakGateway } from './maintenanceFixtures';

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
    expect(screen.getByText('Sends nothing on the mesh')).toBeInTheDocument();
  });
});
