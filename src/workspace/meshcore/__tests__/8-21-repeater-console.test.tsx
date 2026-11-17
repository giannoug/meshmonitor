/**
 * @vitest-environment jsdom
 *
 * Board 8-21 (phone): the same Console as 8-06 at phone size (note s8n6):
 * Back to Settings, the target line, the login status with Log out, the quick
 * actions, the transcript, the command input and its Sends line, then Remote
 * node status and the command history. A destructive command asks in the
 * 8-06 confirm, as a bottom sheet.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/console?node=${MC.lycabettus}`;

describe('8-21-repeater-console', () => {
  it('8-21-repeater-console shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true, meshcore: { adminSession: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    await screen.findAllByText('Logged in');
    expectBoard('8-21-repeater-console', container);
  });

  it('Back leads to the remote target\'s settings list, which keeps the target', async () => {
    renderMeshCore(route, { phone: true, meshcore: { adminSession: true } });
    await screen.findByRole('button', { name: 'Resume session' });
    fireEvent.click(screen.getByTestId('settings-back'));
    const list = await screen.findByRole('navigation', { name: 'Settings' });
    expect(await within(list).findByText('On Lycabettus Repeater')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Console' })).toBeInTheDocument();
  });

  it('a destructive quick action asks in a bottom sheet on the phone, and nothing is sent', async () => {
    const { log } = renderMeshCore(route, { phone: true, meshcore: { adminSession: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    await screen.findAllByText('Logged in');
    fireEvent.click(screen.getByRole('button', { name: 'reboot' }));
    await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    await waitFor(() => expect(log.writes).toHaveLength(0));
  });
});
