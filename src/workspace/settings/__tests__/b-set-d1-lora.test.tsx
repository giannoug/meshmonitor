/**
 * @vitest-environment jsdom
 *
 * Board b-set-d1-lora (desktop): LoRa on the row kit, an edit showing what the
 * node holds ("was 3"), and the radio save bar with today's restart words for
 * Station G2's firmware 2.7.15. The edits queue across categories, whose pages
 * remount, and Discard puts them back. The search field is Task 5.4's.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, goTo, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const pins = { 'GET /api/user/preferences': () => ({ success: true, data: { preferences: { 'settings.pins': ['modules/mqtt', 'modules/storeforward'] } } }) };
const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });
const hops = async () => {
  const input = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(input).toHaveValue(3));
  return input;
};

describe('b-set-d1-lora', () => {
  it('b-set-d1-lora shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/lora`, { fixtures: pins });
    fireEvent.change(await hops(), { target: { value: '4' } });
    goTo(`${g2}/settings/device/device`);
    fireEvent.change(await screen.findByLabelText(/Rebroadcast Mode/, {}, { timeout: 5000 }), { target: { value: '2' } });
    goTo(`${g2}/settings/lora`);
    await within(await bar()).findByText('Save & restart');
    expect(screen.getByText('· firmware 2.7.15: saving restarts the node')).toBeInTheDocument();
    expect(screen.getByText('was 3')).toBeInTheDocument();
    expect(await bar()).toHaveTextContent('2 changes in LoRa and Device · Node restarts');
    expect(await bar()).toHaveTextContent('Station G2 restarts about 7 s after saving');
    expectBoard('b-set-d1-lora', container, { staged: ['⌘,', 'Search settings'] });
  });

  it('shows no save bar until something changes, and Discard puts every category back', async () => {
    renderSettings(`${g2}/settings/lora`);
    const input = await hops();
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull());
    expect(screen.getByLabelText('Hop Limit')).toHaveValue(3);
  });

  it('an edit survives moving to another category and back', async () => {
    renderSettings(`${g2}/settings/lora`);
    fireEvent.change(await hops(), { target: { value: '6' } });
    goTo(`${g2}/settings/identity`);
    await screen.findByRole('heading', { level: 1, name: 'Node Identity' });
    expect(await bar()).toHaveTextContent('1 change in LoRa');
    goTo(`${g2}/settings/lora`);
    await waitFor(() => expect(screen.getByLabelText('Hop Limit')).toHaveValue(6));
    expect(screen.getByText('was 3')).toBeInTheDocument();
  });

  it('a Classic section of a queued category shows no save bar of its own', async () => {
    renderSettings(`${g2}/settings/device/device`);
    fireEvent.change(await screen.findByLabelText(/Rebroadcast Mode/, {}, { timeout: 5000 }), { target: { value: '2' } });
    await within(await bar()).findByText('Save (may restart)');
    expect(screen.queryByText(/Save changes to/)).toBeNull();
  });

  it('turning transmit off asks first with today\'s words; Cancel keeps it on', async () => {
    renderSettings(`${g2}/settings/lora`);
    await hops();
    fireEvent.click(screen.getByRole('switch', { name: 'TX Enabled' }));
    const sheet = await screen.findByRole('dialog', { name: 'Disable transmit on this node?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('switch', { name: 'TX Enabled' })).toBeChecked();
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
  });

  it('a read-only viewer gets disabled rows and no save bar', async () => {
    renderSettings(`${g2}/settings/lora`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    expect(await hops()).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
  });
});
