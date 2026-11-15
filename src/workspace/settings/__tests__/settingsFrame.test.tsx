/**
 * @vitest-environment jsdom
 *
 * The settings frame (Task 5.2): its routes, switching devices, the one shared
 * device-config instance (Ruling DG), today's section inside each category
 * until Tasks 5.3–5.8, and the redirects from Classic URLs.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { fetched, g2, goTo, mqtt, realUrl, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const configLoads = () => fetched().filter((u) => u.includes('/api/config/current')).length;

describe('settings routes', () => {
  it('desktop /settings opens the first category', async () => {
    renderSettings(`${g2}/settings`);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/identity`), { timeout: 5000 });
    expect(await screen.findByRole('heading', { level: 1, name: 'Node Identity' })).toBeInTheDocument();
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('an unknown category opens the first one', async () => {
    renderSettings(`${g2}/settings/nope`);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/identity`), { timeout: 5000 });
  });

  it.each([
    [`${g2}/configuration#config-mqtt`, `${g2}/settings/modules/mqtt`],
    [`${g2}/configuration#config-node-identity`, `${g2}/settings/identity`],
    [`${g2}/settings#settings-reset-ui`, `${g2}/settings/data`],
    [`${g2}/notifications`, `${g2}/settings/notifications`],
  ])('the Classic URL %s lands on %s with App never mounted', async (from, to) => {
    renderSettings(from);
    await waitFor(() => expect(realUrl()).toBe(to), { timeout: 5000 });
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('?node= (the remote target) keeps today\'s Admin Commands until Task 5.9', async () => {
    renderSettings(`${g2}/settings?node=`);
    expect(await screen.findByTestId('page-app', {}, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('switching devices', () => {
  it('keeps the category when the new device has it', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    goTo(`${mqtt}/settings/node-display`);
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/node-display`));
    expect(await screen.findByRole('heading', { level: 1, name: 'Node Display' })).toBeInTheDocument();
  });

  it('opens the new device\'s first category when it lacks this one', async () => {
    renderSettings(`${g2}/settings/lora`);
    await screen.findByRole('heading', { level: 1, name: 'LoRa' }, { timeout: 5000 });
    goTo(`${mqtt}/settings/lora`);
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/node-display`));
  });

  it('the rail keeps the category while in settings', async () => {
    renderSettings(`${g2}/settings/telemetry`);
    await screen.findByRole('heading', { level: 1, name: 'Telemetry' }, { timeout: 5000 });
    const rail = screen.getByRole('navigation', { name: 'Devices' });
    const square = within(rail).getByRole('link', { name: /Athens MQTT/ });
    expect(square).toHaveAttribute('href', `${mqtt}/settings/telemetry`);
    fireEvent.click(square);
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/telemetry`));
  });
});

describe('the shared device configuration (Ruling DG)', () => {
  it('loads once per device, however many categories are opened', async () => {
    renderSettings(`${g2}/settings/identity`);
    await screen.findByRole('heading', { level: 1, name: 'Node Identity' }, { timeout: 5000 });
    for (const path of ['lora', 'modules', 'modules/mqtt', 'device', 'node-display']) goTo(`${g2}/settings/${path}`);
    goTo(`${g2}/settings/device/position`);
    await screen.findByRole('heading', { level: 1, name: 'Position' });
    expect(configLoads()).toBe(1);
  });

  it('following an old Classic link from inside settings keeps the same instance', async () => {
    renderSettings(`${g2}/settings/identity`);
    await screen.findByRole('heading', { level: 1, name: 'Node Identity' }, { timeout: 5000 });
    goTo(`${g2}/configuration#config-mqtt`);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/modules/mqtt`));
    goTo(`${g2}/settings#settings-node-display`);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/node-display`));
    expect(configLoads()).toBe(1);
  });

  it('a device without a radio never loads a radio config', async () => {
    renderSettings(`${mqtt}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    expect(configLoads()).toBe(0);
  });
});

describe('categories until Tasks 5.3–5.8: today\'s section', () => {
  it('LoRa shows today\'s LoRa section with the device\'s values', async () => {
    renderSettings(`${g2}/settings/lora`);
    const hops = await screen.findByLabelText(/Hop Limit/, {}, { timeout: 5000 });
    await waitFor(() => expect(hops).toHaveValue(3));
    expect(hops).toBeEnabled();
    expect(within(screen.getByRole('main')).getByText('On the radio')).toBeInTheDocument();
  });

  it('a viewer without configuration:write sees View only, with the controls off', async () => {
    renderSettings(`${g2}/settings/lora`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    const hops = await screen.findByLabelText(/Hop Limit/, {}, { timeout: 5000 });
    await waitFor(() => expect(hops).toHaveValue(3));
    expect(hops).toBeDisabled();
    expect(within(screen.getByRole('main')).getByText('View only')).toBeInTheDocument();
  });
});

describe('today\'s gates inside the placeholders', () => {
  it('Notifications shows today\'s tab to a viewer without Settings, but not the Settings page', async () => {
    const { container } = renderSettings(`${g2}/settings/notifications`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: true } } } },
    });
    await waitFor(() => expect(container.querySelector('#notif-services')).not.toBeNull(), { timeout: 10_000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(container.querySelector('#settings-notifications')).toBeNull();
    expect(within(screen.getByRole('main')).queryByText('View only')).toBeNull();
  });

  it('a viewer with Settings sees the Settings page under it', async () => {
    const { container } = renderSettings(`${g2}/settings/notifications`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: false } } } },
    });
    await waitFor(() => expect(container.querySelector('#settings-notifications')).not.toBeNull(), { timeout: 10_000 });
    expect(container.querySelector('#notif-services')).not.toBeNull();
  });

  it('PKI DMs are View only without configuration:write, even with settings:write', async () => {
    renderSettings(`${g2}/settings/pki-dm`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: true } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'PKI Direct Message Decryption' }, { timeout: 5000 });
    expect(within(screen.getByRole('main')).getByText('View only')).toBeInTheDocument();
  });

  it('the danger zone is today\'s: off for a read-only viewer (DangerZone canWrite, buttons)', async () => {
    const { container } = renderSettings(`${g2}/settings/maintenance/danger`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false } } } },
    });
    const reboot = await screen.findByTestId('config-reboot-button', {}, { timeout: 10_000 });
    expect(reboot).toBeDisabled();
    expect(screen.getByTestId('config-purge-button')).toBeDisabled();
    // DangerZone's canWrite={false} wraps its body in a disabled fieldset, as on Device Configuration.
    expect(container.querySelector('[data-testid="danger-zone"]')!.closest('fieldset')).toBeDisabled();
  });
});
