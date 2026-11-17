/**
 * @vitest-environment jsdom
 *
 * Board 8-25 (phone): the remote repeater's Settings at phone size (note s8n6):
 * Read again, Import, Export and the read line at the top, the groups, and an
 * Access list row that opens the key form with Apply (1 setperm) in a sheet.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { MC } from '../../__fixtures__/meshcore';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const route = `${HELTEC}/settings/node-settings?node=${MC.lycabettus}`;

describe('8-25-repeater-settings', () => {
  it('8-25-repeater-settings shows the board', async () => {
    const { container } = renderMeshCore(route, { phone: true, meshcore: { adminSession: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    for (const g of ['identity', 'adverts']) {
      fireEvent.click(await screen.findByTestId(`repeater-read-${g}`));
      await waitFor(() => expect(screen.getByTestId(`repeater-read-${g}`)).toHaveTextContent('Read again'));
    }
    expectBoard('8-25-repeater-settings', container);
  });

  it('Access list opens the key form in a sheet with Apply and its Sends line; opening sends nothing', async () => {
    const { log } = renderMeshCore(route, { phone: true, meshcore: { adminSession: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Resume session' }));
    expect(screen.queryByRole('region', { name: 'Manage access list' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Access list/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Access list' });
    expect(within(sheet).getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(within(sheet).getByText('Apply: sends 1 setperm command to Lycabettus Repeater')).toBeInTheDocument();
    expect(sheet.closest('[data-phone]') ?? sheet.querySelector('[data-phone]')).not.toBeNull();
    expect(log.writes).toHaveLength(0);
  });
});
