/**
 * @vitest-environment jsdom
 *
 * Boards 12-02-channel-edit (desktop) and 12-15-channel-edit (phone): one
 * channel's page, `/settings/channels/<slot>`, with today's fields and checks.
 * A channel saves on its own, as today (one set_channel write per slot), from
 * the page's dock: "1 change in Channels", Discard, Review, Save to device;
 * the radio bar yields to it. AEAD needs firmware 2.8.1 (today's gate).
 * Delete asks with today's words. Leaving with edits asks first (17-02).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, realUrl, renderSettings } from './renderSettings';
import { boardChannels, g2With, pollWith } from './categoryFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const sent: Array<{ method: string; path: string; body: unknown }> = [];
const record = (method: string) => (url: URL, init?: RequestInit) => {
  sent.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
  return { success: true, channel: {} };
};
const fixtures = (extra = {}) => ({
  ...pollWith(boardChannels),
  'PUT /api/channels/:id': record('PUT'),
  'DELETE /api/channels/:id': record('DELETE'),
  ...extra,
});
const dock = () => screen.findByRole('region', { name: 'Unsaved channel changes' });
const nameField = async () => {
  const input = await screen.findByLabelText('Channel Name', {}, { timeout: 5000 });
  await waitFor(() => expect(input).toHaveValue('Athens Ops'));
  return input;
};

describe('12-02-channel-edit', () => {
  it('12-02-channel-edit shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    await nameField();
    fireEvent.change(screen.getByLabelText('Location Precision (bits)'), { target: { value: '13' } });
    expect(await dock()).toHaveTextContent('1 change in Channels');
    expect(screen.getByText('was 15')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Slot 2 · Athens Ops' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull();
    expectBoard('12-02-channel-edit', container);
  });

  it('12-15-channel-edit shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures(), phone: true });
    await nameField();
    fireEvent.click(screen.getByRole('switch', { name: 'Uplink Enabled' }));
    expect(await dock()).toHaveTextContent('Sends nothing on the mesh');
    expectBoard('12-15-channel-edit', container);
  });

  it('Save to device sends today\'s one set_channel write for the slot, then returns to Channels', async () => {
    sent.length = 0;
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    fireEvent.change(await nameField(), { target: { value: 'Athens' } });
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Save to device' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/channels`));
    expect(sent).toEqual([{
      method: 'PUT',
      path: '/api/channels/2',
      body: {
        name: 'Athens', psk: boardChannels[2].psk, role: 2, uplinkEnabled: true, downlinkEnabled: true, positionPrecision: 15, sourceId: 'src-g2',
      },
    }]);
  });

  it('Review lists the change old → new; Discard puts it back', async () => {
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    fireEvent.change(await nameField(), { target: { value: 'Athens' } });
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Review' }));
    const sheet = await screen.findByRole('dialog', { name: 'Review changes' });
    expect(sheet).toHaveTextContent('Channel Name');
    expect(sheet).toHaveTextContent('Athens Ops');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(within(await dock()).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved channel changes' })).toBeNull());
    expect(screen.getByLabelText('Channel Name')).toHaveValue('Athens Ops');
  });

  it('AEAD is off with today\'s reason before firmware 2.8.1', async () => {
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    await nameField();
    expect(screen.getByRole('switch', { name: 'AEAD channel (AES-CCM, Experimental)' })).toBeDisabled();
    expect(screen.getByText('Needs firmware 2.8.1 or later on this node.')).toBeInTheDocument();
  });

  it('AEAD can be turned on from firmware 2.8.1, and asks first with today\'s words', async () => {
    renderSettings(`${g2}/settings/channels/2`, {
      fixtures: fixtures(g2With({ localNodeInfo: { firmwareVersion: '2.8.1' }, supportedModules: { aeadChannels: true } })),
    });
    await nameField();
    const aead = screen.getByRole('switch', { name: 'AEAD channel (AES-CCM, Experimental)' });
    await waitFor(() => expect(aead).toBeEnabled());
    expect(screen.queryByText('Needs firmware 2.8.1 or later on this node.')).toBeNull();
    fireEvent.click(aead);
    const sheet = await screen.findByRole('dialog', { name: 'Turn on AEAD for this channel?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Turn on AEAD' }));
    await waitFor(() => expect(aead).toBeChecked());
  });

  it('Delete asks with today\'s words; Enter does not confirm; confirming disables the slot and deletes its messages', async () => {
    sent.length = 0;
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    await nameField();
    fireEvent.click(screen.getByRole('button', { name: 'Delete channel and messages' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete channel 2?' });
    expect(sheet).toHaveTextContent('This disables the channel on the device and permanently deletes its message history in MeshMonitor.');
    expect(within(sheet).getByRole('button', { name: 'Delete channel and messages' })).toHaveAttribute('type', 'button');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete channel and messages' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/channels`));
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual(['PUT /api/channels/2', 'DELETE /api/channels/2']);
  });

  it('17-02: leaving with a channel\'s edits asks first, listing the slot', async () => {
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures(), phone: true });
    fireEvent.change(await nameField(), { target: { value: 'Athens' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Uplink Enabled' }));
    fireEvent.click(screen.getByTestId('settings-back'));
    const sheet = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(sheet).toHaveTextContent('Slot 2 · Athens Ops2 changes');
    expect(sheet).toHaveTextContent('Channel Name and Uplink Enabled, not saved');
    expectBoard('17-02-confirm-sheets', document.body);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/channels`));
  });

  it('a free slot opens as a new channel', async () => {
    renderSettings(`${g2}/settings/channels/3`, { fixtures: fixtures() });
    expect(await screen.findByLabelText('Channel Name', {}, { timeout: 5000 })).toHaveValue('Channel 3');
    expect(await dock()).toHaveTextContent('New channel');
  });

  it('leaving a new channel asks first and calls it new, with no count or field list', async () => {
    renderSettings(`${g2}/settings/channels/3`, { fixtures: fixtures(), phone: true });
    await screen.findByLabelText('Channel Name', {}, { timeout: 5000 });
    fireEvent.click(screen.getByTestId('settings-back'));
    const sheet = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(sheet).toHaveTextContent('New channel');
    expect(sheet).toHaveTextContent('Not saved to the device yet');
    expect(sheet).not.toHaveTextContent(/0 changes|, not saved/);
  });

  it('Generate never makes a 1-byte key: 1 byte is not offered, and LongFast (AQ==) generates 32 bytes', async () => {
    renderSettings(`${g2}/settings/channels/0`, { fixtures: fixtures() });
    const name = await screen.findByLabelText('Channel Name', {}, { timeout: 5000 });
    await waitFor(() => expect(name).toHaveValue('LongFast'));
    const size = screen.getByLabelText('Key size');
    expect(within(size).queryByRole('option', { name: '1 byte' })).toBeNull();
    expect(size).toHaveValue('32');
    const key = screen.getByLabelText('Pre-Shared Key (PSK)');
    expect(key).toHaveValue('AQ==');
    for (const bytes of [32, 16]) {
      fireEvent.change(size, { target: { value: String(bytes) } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      const value = (key as HTMLInputElement).value;
      expect(value).not.toBe('AA==');
      expect(atob(value)).toHaveLength(bytes);
    }
  });

  it('Delete says it sends nothing on the mesh, on the row and in its confirm', async () => {
    renderSettings(`${g2}/settings/channels/2`, { fixtures: fixtures() });
    await nameField();
    const row = screen.getByRole('button', { name: 'Delete channel and messages' }).closest('section')!;
    expect(row).toHaveTextContent('Sends nothing on the mesh');
    fireEvent.click(screen.getByRole('button', { name: 'Delete channel and messages' }));
    expect(await screen.findByRole('dialog', { name: 'Delete channel 2?' })).toHaveTextContent('Sends nothing on the mesh');
  });
});
