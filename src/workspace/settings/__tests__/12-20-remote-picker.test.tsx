/**
 * @vitest-environment jsdom
 *
 * Board 12-20-remote-picker (phone), Task 5.9: the remote target picker over a
 * remote Position page. Today's words and node list (the local node marked
 * Local); picking a node sends nothing and puts it in the URL.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { clearRemote } from '../remote/remoteTargetStore';
import { g2, realUrl, renderSettings } from './renderSettings';
import { NODE, meshRequests, remoteFixtures } from './remoteFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => clearRemote(SOURCE_IDS.g2));
afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };

describe('12-20-remote-picker', () => {
  it('12-20-remote-picker shows the board', async () => {
    // Drawn before a passkey is held.
    const fixtures = remoteFixtures({ 'POST /api/admin/session-passkey-status': () => ({ success: true, isLocalNode: false, hasPasskey: false, remainingSeconds: null }) });
    renderSettings(`${g2}/settings/device/position?node=${NODE}`, { phone: true, fixtures });
    fireEvent.click(await screen.findByRole('button', { name: /Remote node/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Configuring' }, T);
    expect(within(sheet).getByRole('button', { name: /Hilltop Relay/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sheet).getByText('Picking a node sends nothing; each category then reads from it')).toBeInTheDocument();
    expectBoard('12-20-remote-picker', document.body);
  });

  it('picking a node sends nothing and puts it in the URL; search filters today’s list', async () => {
    renderSettings(`${g2}/settings`, { phone: true, fixtures: remoteFixtures() });
    fireEvent.click(await screen.findByRole('button', { name: /Configuring/ }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Configuring' }, T);
    fireEvent.change(within(sheet).getByPlaceholderText('Search for a node...'), { target: { value: 'psy' } });
    await waitFor(() => expect(within(sheet).queryByRole('button', { name: /Hilltop Relay/ })).toBeNull());
    fireEvent.click(within(sheet).getByRole('button', { name: /Psychiko Base/ }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings?node=!5d21aa07`), T);
    await screen.findByText('Remote only', {}, T);
    expect(meshRequests()).toEqual([]);
  });

  it('an unknown node in the URL falls back to this radio', async () => {
    renderSettings(`${g2}/settings/device/position?node=!00000bad`, { fixtures: remoteFixtures() });
    expect(await screen.findByLabelText('Position Broadcast Interval (seconds)', {}, T)).toHaveValue(900);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/device/position`), T);
  });

  it('Classic’s Admin Commands URL opens these settings, on this radio', async () => {
    renderSettings(`${g2}/admin`, { fixtures: remoteFixtures() });
    await waitFor(() => expect(realUrl()).toMatch(new RegExp(`^${g2}/settings/[a-z]+(\\?node=)?$`)), T);
    expect(await screen.findByRole('button', { name: /Configuring This radio/ }, T)).toBeInTheDocument();
  });
});
