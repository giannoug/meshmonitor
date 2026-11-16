/**
 * @vitest-environment jsdom
 *
 * The leave guard (Task 5.3, 17-02's discard sheet): with radio edits queued,
 * a link out of the device's settings opens "Discard unsaved changes?" with
 * today's words. Keep editing stays with the edits; Discard changes puts them
 * back and follows the link. Links inside the settings never ask. The 17-02
 * board itself (a channel's edits) is checked in 12-02-channel-edit.test.tsx (Task 5.5).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { g2, mqtt, realUrl, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

async function editHops() {
  const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(hops).toHaveValue(3));
  fireEvent.change(hops, { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Transmit Power (dBm)'), { target: { value: '20' } });
}
const railLink = () => within(screen.getByRole('navigation', { name: 'Devices' })).getByRole('link', { name: /Athens MQTT/ });

describe('leave guard', () => {
  it('switching device asks first; Keep editing stays with the edits', async () => {
    renderSettings(`${g2}/settings/lora`);
    await editHops();
    fireEvent.click(railLink());
    const sheet = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(sheet).toHaveTextContent('You have changes that are not saved to the device. Opening another item drops them.');
    expect(sheet).toHaveTextContent('LoRa2 changes');
    expect(sheet).toHaveTextContent('Hop Limit and Transmit Power (dBm), not saved');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(realUrl()).toBe(`${g2}/settings/lora`);
    expect(screen.getByLabelText('Hop Limit')).toHaveValue(5);
  });

  it('Discard changes puts the edits back and follows the link', async () => {
    renderSettings(`${g2}/settings/lora`);
    await editHops();
    fireEvent.click(railLink());
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/node-display`));
  });

  it('moving between categories never asks', async () => {
    renderSettings(`${g2}/settings/lora`);
    await editHops();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: 'Node Identity' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/identity`));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with nothing queued, links leave at once', async () => {
    renderSettings(`${g2}/settings/lora`);
    await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
    fireEvent.click(railLink());
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/node-display`));
  });

  // The phone switcher is not reachable from settings (their pages draw their own bar, no device header);
  // the 768–1023 px drawer is the guarded link whose own onClick closes a layer.
  it('a guarded link still runs its own onClick: the drawer closes, then one sheet asks (D9c)', async () => {
    renderSettings(`${g2}/settings/lora`, { width: 900 });
    const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
    await waitFor(() => expect(hops).toHaveValue(3));
    fireEvent.change(hops, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }));
    fireEvent.click(await screen.findByTestId('settings-back'));
    await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // Discard changes follows the link though the drawer (and its link) is gone.
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(realUrl()).toBe(g2));
  });
});
