/**
 * @vitest-environment jsdom
 *
 * Board b-set-p1-list (phone): a device's settings list is a page, with Back
 * to Home, PINNED, ON THE RADIO (Identity, LoRa, Channels, Security, Device ›,
 * Modules ›, Maintenance ›) and IN MESHMONITOR. The search field is Task 5.4's,
 * the save bar's Review Task 5.3's.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, mqtt, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pins = { 'GET /api/user/preferences': () => ({ success: true, data: { preferences: { 'settings.pins': ['modules/mqtt', 'modules/storeforward'] } } }) };
const list = () => screen.findByRole('navigation', { name: 'Settings' }, { timeout: 5000 });

describe('b-set-p1-list', () => {
  it('b-set-p1-list shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings`, { phone: true, fixtures: pins });
    await within(await list()).findByText('Store & Forward');
    expectBoard('b-set-p1-list', container, { staged: ['Search settings', 'Review'] });
    const pinned = within(await list()).getByRole('list', { name: 'Pinned' });
    expect(within(pinned).getByRole('link', { name: 'MQTT' })).toHaveAttribute('href', `${g2}/settings/modules/mqtt`);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('lists the radio first, in the Android order, then MeshMonitor', async () => {
    renderSettings(`${g2}/settings`, { phone: true });
    const nav = await list();
    await within(nav).findByRole('link', { name: /Node Identity/ });
    const radio = within(nav).getByRole('list', { name: 'On the radio' });
    expect(within(radio).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Node Identity', `${g2}/settings/identity`],
      ['LoRa', `${g2}/settings/lora`],
      ['Channels', `${g2}/settings/channels`],
      ['Security', `${g2}/settings/security`],
      ['Device', `${g2}/settings/device`],
      ['Modules', `${g2}/settings/modules`],
      ['Maintenance', `${g2}/settings/maintenance`],
    ]);
    const mm = within(nav).getByRole('list', { name: 'In MeshMonitor' });
    expect(within(mm).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Node Display', 'Telemetry', 'Notifications', 'Packet Monitor', 'PKI Direct Message Decryption', 'Reliable PKI', 'Data',
    ]);
  });

  it('Back leads to the device Home', async () => {
    renderSettings(`${g2}/settings`, { phone: true });
    await list();
    expect(screen.getByTestId('settings-back')).toHaveAttribute('href', g2);
  });

  it('PINNED shows only with pins', async () => {
    renderSettings(`${g2}/settings`, { phone: true });
    const nav = await list();
    await within(nav).findByRole('link', { name: /Node Identity/ });
    expect(within(nav).queryByRole('list', { name: 'Pinned' })).toBeNull();
  });

  it('a viewer without write access sees View only', async () => {
    renderSettings(`${g2}/settings`, {
      phone: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    const nav = await list();
    await within(nav).findByRole('link', { name: /Node Identity/ });
    expect(within(nav).getAllByText('View only')).toHaveLength(2);
  });

  it('a device with no radio lists only In MeshMonitor', async () => {
    renderSettings(`${mqtt}/settings`, { phone: true });
    const nav = await list();
    await within(nav).findByRole('link', { name: 'Node Display' });
    expect(within(nav).queryByRole('list', { name: 'On the radio' })).toBeNull();
    expect(within(nav).getByRole('link', { name: 'Coverage recording' })).toBeInTheDocument();
  });
});
