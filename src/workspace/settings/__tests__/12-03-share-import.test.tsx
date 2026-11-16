/**
 * @vitest-environment jsdom
 *
 * Boards 12-03-share-import (desktop) and 12-16-share-qr (phone): Channels ›
 * Share and import. Export builds today's channel URL (the same request as
 * today's Export dialog) for the ticked slots, with its QR code and Copy URL.
 * Import decodes a pasted URL, previews it, and applies it with today's
 * request and steps (Sending, Rebooting, Syncing, Verifying, Complete).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';
import { boardChannels, pollWith } from './categoryFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
// jsdom has no canvas: the QR code draws nothing here.
vi.mock('qrcode', () => ({ default: { toCanvas: () => Promise.resolve() } }));

afterEach(() => vi.restoreAllMocks());

const URL_OUT = 'https://meshtastic.org/e/#CgcSAQE6AggNEg8IATgDQANIAVAeaAHABgE';
const encodes: unknown[] = [];
const imports: unknown[] = [];
const fixtures = {
  ...pollWith(boardChannels),
  'POST /api/channels/encode-url': (_url: URL, init?: RequestInit) => {
    encodes.push(JSON.parse(String(init?.body)));
    return { url: URL_OUT };
  },
  'POST /api/channels/decode-url': () => ({
    channels: [
      { name: 'LongFast', psk: 'AQ==', positionPrecision: 13, uplinkEnabled: true, downlinkEnabled: false },
      { name: 'Coast', psk: 'b3JkZXJzLXN0cmluZy05UT0=', positionPrecision: 15, uplinkEnabled: false, downlinkEnabled: true },
    ],
    loraConfig: { region: 3, modemPreset: 0, hopLimit: 3 },
  }),
  // The import never answers in these tests, so the page stays on its first step.
  'POST /api/channels/import-config': (_url: URL, init?: RequestInit) => {
    imports.push(JSON.parse(String(init?.body)));
    return new Promise(() => {});
  },
};

async function decode() {
  fireEvent.change(await screen.findByLabelText('Meshtastic Configuration URL', {}, { timeout: 5000 }), { target: { value: URL_OUT } });
  fireEvent.click(screen.getByRole('button', { name: 'Decode URL' }));
  await screen.findByText('Coast');
}

describe('12-03-share-import', () => {
  it('12-03-share-import shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/channels/share`, { fixtures });
    await screen.findByText(URL_OUT, {}, { timeout: 5000 });
    await decode();
    fireEvent.click(screen.getByRole('button', { name: 'Import Selected' }));
    await screen.findByText('Sending configuration to device...');
    expectBoard('12-03-share-import', container);
  });

  it('12-16-share-qr shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/channels/share`, { fixtures, phone: true });
    await screen.findByText(URL_OUT, {}, { timeout: 5000 });
    expectBoard('12-16-share-qr', container);
  });

  it('Export asks for the ticked slots with LoRa, as today\'s Export dialog does', async () => {
    encodes.length = 0;
    renderSettings(`${g2}/settings/channels/share`, { fixtures });
    await screen.findByText(URL_OUT, {}, { timeout: 5000 });
    expect(encodes.at(-1)).toEqual({ channelIds: [0, 1, 2], includeLoraConfig: true, sourceId: 'src-g2' });
    fireEvent.click(screen.getByRole('checkbox', { name: /gauntlet/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /LoRa Configuration/ }));
    await waitFor(() => expect(encodes.at(-1)).toEqual({ channelIds: [0, 2], includeLoraConfig: false, sourceId: 'src-g2' }));
  });

  it('Import sends today\'s one import request for the pasted URL', async () => {
    imports.length = 0;
    renderSettings(`${g2}/settings/channels/share`, { fixtures });
    await decode();
    const preview = screen.getByRole('table');
    expect(within(preview).getByText('Coast')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import Selected' }));
    await waitFor(() => expect(imports).toEqual([{ url: URL_OUT, sourceId: 'src-g2' }]));
    expect(screen.getByRole('button', { name: 'Importing...' })).toBeDisabled();
  });
});
