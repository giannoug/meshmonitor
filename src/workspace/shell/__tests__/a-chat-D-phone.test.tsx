/**
 * @vitest-environment jsdom
 *
 * Board a-chat-D-phone, frame only (Task 1.7): the phone header and the tab
 * bar. The device home under them (Search, Channels, Direct messages, the
 * Automations and Tools tiles) is Phase 2's (c-home-e1).
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

/** The board's frame strings; the rest of its check is Phase 2's. */
const FRAME_MUST = ['Station G2', 'Home', 'DMs'];
const ABSENT = ['Configuration', 'More tools…'];

function RealUrl() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="real-url">{pathname}</output>
      <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />
    </>
  );
}

const goTo = (path: string) => fireEvent.change(screen.getByTestId('goto'), { target: { value: path } });

function renderShell(route: string, opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <RealUrl />
      </WorkspaceShell>
    </ToastProvider>,
    { route, phone: true, ...opts },
  );
}

const tabBar = () => screen.findByRole('navigation', { name: 'Tabs' });
const tab = async (name: RegExp) => within(await tabBar()).getByRole('link', { name });

describe('a-chat-D-phone (frame)', () => {
  it('a-chat-D-phone shows the frame of the board', async () => {
    const { container } = renderShell(`/source/${SOURCE_IDS.g2}/channels`);
    await screen.findByText('Station G2');
    const text = container.textContent ?? '';
    for (const s of FRAME_MUST) expect(text).toContain(s);
    for (const s of ABSENT) expect(text).not.toContain(s);
  });

  it('has Home, DMs, Activity and You for the open device', async () => {
    renderShell(`/source/${SOURCE_IDS.g2}/channels`);
    expect(await tab(/^Home/)).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}`);
    expect(await tab(/^Home/)).toHaveAttribute('aria-current', 'page');
    // Meshtastic DMs are today's Node Details tab until Phase 2.
    expect(await tab(/^DMs/)).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/messages`);
    expect(await tab(/^Activity/)).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/activity`);
    expect(await tab(/^You/)).toHaveAttribute('href', '/you');
  });

  it('badges DMs with the open device DM unread', async () => {
    renderShell(`/source/${SOURCE_IDS.heltec}/channels`);
    await waitFor(async () => expect(await tab(/^DMs/)).toHaveAccessibleName('DMs, 2 unread'));
    expect(await tab(/^DMs/)).toHaveAttribute('href', `/source/${SOURCE_IDS.heltec}/dms`);
  });

  it('marks the active tab from the route', async () => {
    renderShell(`/source/${SOURCE_IDS.heltec}/dms`);
    expect(await tab(/^DMs/)).toHaveAttribute('aria-current', 'page');
    goTo('/preferences/map');
    await waitFor(async () => expect(await tab(/^You/)).toHaveAttribute('aria-current', 'page'));
  });

  it('Home goes to the last device opened, else the Overview; DMs and Activity need a device', async () => {
    renderShell('/overview');
    expect(await tab(/^Home/)).toHaveAttribute('href', '/overview');
    const bar = await tabBar();
    expect(within(bar).queryByRole('link', { name: /^DMs/ })).toBeNull();
    expect(within(bar).getByText('DMs').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');

    goTo(`/source/${SOURCE_IDS.rak}/nodes`);
    await waitFor(async () => expect(await tab(/^Home/)).toHaveAttribute('href', `/source/${SOURCE_IDS.rak}`));
    goTo('/you');
    await waitFor(async () => expect(await tab(/^You/)).toHaveAttribute('aria-current', 'page'));
    expect(await tab(/^Home/)).toHaveAttribute('href', `/source/${SOURCE_IDS.rak}`);
    expect(await tab(/^DMs/)).toHaveAttribute('href', `/source/${SOURCE_IDS.rak}/messages`);
  });

  it.each([768, 1280])('the tab bar is hidden at %i px', async (width) => {
    renderShell(`/source/${SOURCE_IDS.g2}/channels`, { width });
    await screen.findByRole('navigation', { name: 'Devices' });
    expect(screen.queryByRole('navigation', { name: 'Tabs' })).toBeNull();
  });
});
