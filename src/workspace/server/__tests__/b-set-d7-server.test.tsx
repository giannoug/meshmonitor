/**
 * @vitest-environment jsdom
 *
 * Board b-set-d7-server (Task 6.4): the Server sidebar (s13n0's list) beside
 * Notification services, whose page is drawn in full on 18-11 (s13n0). The
 * list follows s13n2's gates and shows only what the user can open.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const sidebar = () => screen.getByRole('complementary', { name: 'Server' });
const entries = () => within(sidebar()).getAllByRole('link').map((a) => a.textContent);
const urls = () => vi.mocked(fetch).mock.calls.map(([u]) => String(u));

describe('b-set-d7-server', () => {
  it('b-set-d7-server shows the board', async () => {
    const { container } = renderServer('/server/notification-services');
    fireEvent.click(await screen.findByRole('button', { name: 'Test Connection' }));
    await screen.findByText('Connected successfully (42ms)');
    expectBoard('b-set-d7-server', container);
  });

  it('an admin sees the twelve categories in s13n0\'s order, each a link to its page', async () => {
    renderServer('/server/notification-services');
    await screen.findByRole('button', { name: 'Test Connection' });
    expect(entries()).toEqual([
      'Devices', 'General', 'Notification services', 'Security & privacy', 'Backup & maintenance', 'Channel database',
      'Scripts', 'Map & tiles', 'Embed', 'Background jobs', 'Integrations', 'Analytics',
    ]);
    expect(within(sidebar()).getByRole('link', { name: 'Notification services' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar()).getByRole('link', { name: 'Map & tiles' })).toHaveAttribute('href', '/server/map');
    expect(within(sidebar()).getByRole('link', { name: 'Background jobs' })).toHaveAttribute('href', '/server/background-jobs');
  });

  it('a settings viewer sees only Backup & maintenance', async () => {
    renderServer('/server/backup', { permissions: grants({ read: true }) });
    await waitFor(() => expect(entries()).toEqual(['Backup & maintenance']));
  });

  it('settings:write adds General, Security & privacy (its hosted documents), Map & tiles and Background jobs (today\'s writer rows)', async () => {
    renderServer('/server/backup', { permissions: grants({ write: true }) });
    await waitFor(() => expect(entries()).toEqual(['General', 'Security & privacy', 'Backup & maintenance', 'Map & tiles', 'Background jobs']));
  });

  it('a direct link to an admin page shows today\'s no-permission state and reads nothing', async () => {
    renderServer('/server/channel-database', { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(urls().some((u) => u.includes('/api/channel-database'))).toBe(false);
  });

  it('desktop /server opens the first category the user can open', async () => {
    renderServer('/server');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/general'));
    renderServer('/server', { permissions: grants({ read: true }) });
    await waitFor(() => expect(screen.getAllByTestId('where').at(-1)).toHaveTextContent('/server/backup'));
  });

  it.each([
    ['/server/apprise-server', '/server/notification-services'],
    ['/server/default-source', '/server/general'],
    ['/server/meshcore-messaging', '/server/general'],
    ['/server/reticulum', '/server/general'],
    ['/server/maintenance', '/server/backup'],
    ['/server/system', '/server/backup'],
    // Task 6.5: the sections of the last re-hosted categories.
    ['/server/privacy', '/server/security'],
    ['/server/remote-admin', '/server/security'],
    ['/server/position-estimation', '/server/background-jobs'],
    ['/server/auto-enrichment', '/server/background-jobs'],
    ['/server/mesh-issues', '/server/background-jobs'],
    ['/server/coverage', '/server/background-jobs'],
    ['/server/solar', '/server/background-jobs'],
    ['/server/translation', '/server/integrations'],
    ['/server/elevation', '/server/integrations'],
    ['/server/mqtt-root-directory', '/server/integrations'],
    ['/server/ducting', '/server/integrations'],
    ['/server/adsb', '/server/integrations'],
    ['/server/meshwars', '/server/integrations'],
    ['/server/atak-cot', '/server/integrations'],
    ['/server/virtual-node-replay', '/server/integrations'],
  ])('today\'s section %s lands on %s', async (from, to) => {
    renderServer(from);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(to));
  });
});
