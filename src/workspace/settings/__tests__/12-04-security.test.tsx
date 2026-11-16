/**
 * @vitest-environment jsdom
 *
 * Boards 12-04-security / 12-17-security (desktop / phone), 12-26-security-strict
 * (phone) and 18-07 / 18-08-security-balanced: Security on the row kit, saved
 * through the radio save queue (Ruling DN moved: it now enqueues like every
 * radio category). Today's checks still run before its write, wherever Save
 * was pressed: Strict types the short name, Balanced asks plainly with today's
 * body, a new private key asks with today's words. A declined confirm leaves
 * Security queued and unsent.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, goTo, renderSettings } from './renderSettings';
import { g2On282 } from './categoryFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const NEW_KEY = 'S2V5S2V5S2V5S2V5S2V5S2V5S2V5S2V5S2V5S2V5S2U=';
const writes: Array<Record<string, unknown>> = [];
const fixtures = {
  ...g2On282,
  'GET /api/device/security-keys': () => ({ publicKey: 'Kq7xF2bW9mQpublicpublicpublicpublicpublic0=', privateKey: 'cHJpdmF0ZXByaXZhdGVwcml2YXRlcHJpdmF0ZTAxMjM=' }),
  'POST /api/admin/commands': (_url: URL, init?: RequestInit) => {
    writes.push(JSON.parse(String(init?.body)).config);
    return { success: true };
  },
  'POST /api/config/lora': () => ({ success: true }),
};
const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });
const policy = async () => {
  const select = await screen.findByLabelText('Protection Level (packet authenticity)', {}, { timeout: 5000 });
  await waitFor(() => expect(select).toBeEnabled());
  return select;
};
/** Desktop picks with the native select; the phone row opens the options sheet. */
async function pick(level: 'Balanced: prefer authenticated' | 'Strict: require authentication', phone = false) {
  if (!phone) {
    fireEvent.change(await policy(), { target: { value: level.startsWith('Strict') ? '2' : '1' } });
    return;
  }
  fireEvent.click(await policy());
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Protection Level (packet authenticity)' })).getByRole('radio', { name: level }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}
const save = async (label = 'Save & restart') => fireEvent.click(within(await bar()).getByRole('button', { name: label }));

describe('12-04-security', () => {
  it('12-04-security shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Strict: require authentication');
    expect(await bar()).toHaveTextContent('1 change in Security · Node restarts');
    expect(screen.getByText('was Compatible: accept unsigned (firmware default)')).toBeInTheDocument();
    await save();
    const sheet = await screen.findByRole('dialog', { name: 'Set Protection Level to Strict?' });
    fireEvent.change(within(sheet).getByLabelText('Type G2 to confirm'), { target: { value: 'G2' } });
    expectBoard('12-04-security', container.ownerDocument.body);
  });

  it('12-17-security shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/security`, { fixtures, phone: true });
    fireEvent.click(await screen.findByRole('switch', { name: 'Debug Log API Enabled' }, { timeout: 5000 }));
    await within(await bar()).findByText('Save & restart');
    expectBoard('12-17-security', container);
  });

  it('12-26-security-strict shows the board', async () => {
    renderSettings(`${g2}/settings/security`, { fixtures, phone: true });
    await pick('Strict: require authentication', true);
    await save();
    const sheet = await screen.findByRole('dialog', { name: 'Set Protection Level to Strict?' });
    fireEvent.change(within(sheet).getByLabelText('Type G2 to confirm'), { target: { value: 'G2' } });
    expectBoard('12-26-security-strict', document.body);
  });

  it('18-07-security-balanced shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Balanced: prefer authenticated');
    await save();
    await screen.findByRole('dialog', { name: 'Set Protection Level to Balanced?' });
    expectBoard('18-07-security-balanced', document.body);
  });

  it('18-08-security-balanced shows the board', async () => {
    renderSettings(`${g2}/settings/security`, { fixtures, phone: true });
    await pick('Balanced: prefer authenticated', true);
    await save();
    await screen.findByRole('dialog', { name: 'Set Protection Level to Balanced?' });
    expectBoard('18-08-security-balanced', document.body);
  });
});

describe('Security on the radio save queue', () => {
  it('Strict sends only once the short name is typed; Enter in the field does not confirm', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Strict: require authentication');
    await save();
    const sheet = await screen.findByRole('dialog', { name: 'Set Protection Level to Strict?' });
    const confirm = within(sheet).getByRole('button', { name: 'Set Strict' });
    expect(confirm).toBeDisabled();
    const word = within(sheet).getByLabelText('Type G2 to confirm');
    fireEvent.change(word, { target: { value: 'G2' } });
    fireEvent.submit(word);
    expect(writes).toEqual([]);
    fireEvent.click(confirm);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ packetSignaturePolicy: 2, serialEnabled: true });
  });

  it('a cancelled Strict confirm sends nothing and leaves Security queued', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Strict: require authentication');
    await save();
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Set Protection Level to Strict?' })).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual([]);
    expect(await bar()).toHaveTextContent('1 change in Security');
    expect(await bar()).not.toHaveTextContent('Not saved');
  });

  it('Balanced asks plainly with today\'s body, then sends', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Balanced: prefer authenticated');
    await save();
    const sheet = await screen.findByRole('dialog', { name: 'Set Protection Level to Balanced?' });
    expect(sheet).toHaveTextContent('This sets Station G2 to Balanced.');
    expect(within(sheet).queryByLabelText(/to confirm/)).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Set Balanced' }));
    await waitFor(() => expect(writes).toEqual([expect.objectContaining({ packetSignaturePolicy: 1 })]));
  });

  it('a new private key asks with today\'s words before the write; Cancel keeps it queued', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/security`, { fixtures });
    await policy();
    fireEvent.click(screen.getByRole('button', { name: 'Set private key' }));
    fireEvent.change(screen.getByPlaceholderText('Paste a base64 private key (32 bytes)'), { target: { value: NEW_KEY } });
    await save();
    let sheet = await screen.findByRole('dialog', { name: "Replace this node's private key?" });
    expect(sheet).toHaveTextContent('This changes its identity on the mesh.');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(writes).toEqual([]);
    expect(await bar()).toHaveTextContent('1 change in Security');
    await save();
    sheet = await screen.findByRole('dialog', { name: "Replace this node's private key?" });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Set private key' }));
    await waitFor(() => expect(writes).toEqual([expect.objectContaining({ privateKey: NEW_KEY })]));
  });

  it('the confirm runs when Save is pressed on another category, before any write', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/security`, { fixtures });
    await pick('Strict: require authentication');
    goTo(`${g2}/settings/lora`);
    const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
    fireEvent.change(hops, { target: { value: '4' } });
    expect(await bar()).toHaveTextContent('2 changes in LoRa and Security');
    await save();
    const sheet = await screen.findByRole('dialog', { name: 'Set Protection Level to Strict?' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    // LoRa still saves; Security stays queued.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Protection Level to Strict?' })).toBeNull());
    expect(writes).toEqual([]);
  });

  it('Review never shows the private key', async () => {
    renderSettings(`${g2}/settings/security`, { fixtures });
    await policy();
    fireEvent.click(screen.getByRole('button', { name: 'Set private key' }));
    fireEvent.change(screen.getByPlaceholderText('Paste a base64 private key (32 bytes)'), { target: { value: NEW_KEY } });
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Review' }));
    const sheet = await screen.findByRole('dialog', { name: 'Review changes' });
    expect(sheet).toHaveTextContent('Local Private Key');
    expect(sheet).not.toHaveTextContent(NEW_KEY);
  });

  it('on firmware 2.7.15 Protection Level is off with today\'s reason', async () => {
    renderSettings(`${g2}/settings/security`);
    const select = await screen.findByLabelText('Protection Level (packet authenticity)', {}, { timeout: 5000 });
    expect(select).toBeDisabled();
    expect(screen.getByText('Requires firmware 2.8.0 or later. This node runs 2.7.15.')).toBeInTheDocument();
  });
});
