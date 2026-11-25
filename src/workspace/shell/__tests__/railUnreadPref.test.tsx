/**
 * @vitest-environment jsdom
 *
 * S5 (#6365): the rail's unread badges follow the viewer's `unreadIndicatorEnabled` preference.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

const renderRail = (preferences: unknown, extra: { route?: string; fixtures?: Record<string, never> } = {}) =>
  renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <span />
      </WorkspaceShell>
    </ToastProvider>,
    {
      route: extra.route ?? '/overview',
      fixtures: { 'GET /api/user/map-preferences': () => ({ preferences }), ...(extra.fixtures as object) },
    },
  );

describe('rail unread badges', () => {
  it('unread badges follow unreadIndicatorEnabled', async () => {
    renderRail({ unreadIndicatorEnabled: false });
    const rail = await screen.findByRole('navigation', { name: 'Devices' });
    await within(rail).findByRole('link', { name: 'Station G2' });
    // Give the preference and the unread poll time to land: with the preference off the poll never runs.
    await new Promise((r) => setTimeout(r, 100));
    expect(within(rail).queryByText('2')).toBeNull();
    expect(within(rail).queryByRole('link', { name: /unread/ })).toBeNull();
  });

  it('shows them when the preference is on or unset', async () => {
    renderRail(null);
    const rail = await screen.findByRole('navigation', { name: 'Devices' });
    await waitFor(() => expect(within(rail).getByRole('link', { name: /Heltec MeshCore, 2 unread/ })).toBeInTheDocument());
    expect(SOURCE_IDS.heltec).toBeTruthy();
  });

  it('with Show MQTT off, a source whose only unread is MQTT shows no rail or sidebar badge', async () => {
    renderRail(null, {
      route: `/source/${SOURCE_IDS.g2}/channels`,
      fixtures: {
        'GET /api/messages/unread-by-source': () => ({ sources: {} }),
        // Show MQTT is off by default: the server drops MQTT from the counts only when asked.
        'GET /api/messages/unread-counts': (url: URL) =>
          url.searchParams.get('excludeMqtt') === 'true'
            ? { channels: {}, directMessages: {} }
            : { channels: { 0: 2 }, directMessages: {} },
      } as never,
    });
    const rail = await screen.findByRole('navigation', { name: 'Devices' });
    await within(rail).findByRole('link', { name: /Station G2/ });
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole('link', { name: /Station G2, \d+ unread/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Station G2, \d+ unread/ })).toBeNull();
  });
});
