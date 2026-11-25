/**
 * @vitest-environment jsdom
 *
 * Board 10-08 (phone): a long-press on a message opens its actions sheet:
 * the message, React (quick emoji + Custom) with its Sends line, then Reply,
 * Translate, Resend (ours), Details, Copy text and Delete. Gates as today;
 * an item the viewer may not use stays listed, off, with the reason.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture } from '../../__fixtures__/athens';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from './renderChat';
import type { RenderWorkspaceOptions } from '../../test/renderWorkspace';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const dm = `${g2}/dm/!a1b2c301`;
const OURS = 'Running one now, should be 2 hops via Hymettus';
const THEIRS = 'Can you run a traceroute to me?';
const rowOf = (text: string) => screen.getByText(text).closest('[data-message-id]') as HTMLElement;

async function openDm(opts: RenderWorkspaceOptions = {}) {
  const result = renderChat(dm, { phone: true, ...opts });
  fireEvent.click(await screen.findByRole('button', { name: 'Message anyway' }));
  await screen.findByText(OURS);
  return result;
}

/** A long-press (the browser's contextmenu on touch) on the message. */
async function longPress(text: string) {
  fireEvent.contextMenu(rowOf(text));
  return screen.findByRole('dialog', { name: text === OURS ? /^You · / : /^Kifisia Rooftop · / });
}

const sent = () =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes('/api/messages/send') && i?.method === 'POST');

describe('10-08-message-actions', () => {
  it('10-08-message-actions shows the board', async () => {
    // The board's message is ours (Resend); Reply is offered on theirs, as today.
    await openDm();
    const ours = (await longPress(OURS)).textContent ?? '';
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const theirs = await longPress(THEIRS);
    expectBoard('10-08-message-actions', joined(ours, theirs));
  });

  it('React says what a tap sends, and a quick emoji sends 1 tapback', async () => {
    await openDm();
    const sheet = within(await longPress(THEIRS));
    expect(sheet.getByText('Sends 1 tapback to Kifisia Rooftop')).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: '👍' }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(JSON.parse(String(sent()[0][1]!.body))).toEqual({
      text: '👍', destination: '!a1b2c301', replyId: 7, emoji: 1, sourceId: SOURCE_IDS.g2,
    });
  });

  it('Resend (ours) says it sends 1 new copy, and sends it', async () => {
    await openDm();
    const sheet = within(await longPress(OURS));
    expect(sheet.getByText('Sends 1 new copy to Kifisia Rooftop; asks for an ACK again')).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /^Reply/ })).toBeNull();
    fireEvent.click(sheet.getByRole('button', { name: /^Resend/ }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(JSON.parse(String(sent()[0][1]!.body))).toMatchObject({ text: OURS, destination: '!a1b2c301' });
  });

  it('Reply opens the reply in the composer', async () => {
    await openDm();
    const sheet = within(await longPress(THEIRS));
    fireEvent.click(sheet.getByRole('button', { name: /^Reply/ }));
    expect(await screen.findByText('Replying to Kifisia Rooftop')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Custom opens the emoji picker', async () => {
    await openDm();
    const sheet = within(await longPress(THEIRS));
    fireEvent.click(sheet.getByRole('button', { name: /Custom/ }));
    expect(await screen.findByRole('dialog', { name: 'React with an emoji' })).toBeInTheDocument();
  });

  it('Delete asks first with today\'s words, then deletes from MeshMonitor', async () => {
    await openDm({ fixtures: { 'DELETE /api/messages/:id': () => ({ message: 'Message deleted successfully' }) } });
    const sheet = within(await longPress(OURS));
    expect(sheet.getByText('From MeshMonitor only · asks first')).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: /^Delete/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this message' });
    expect(confirm).toHaveTextContent('Are you sure you want to delete this message?');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText(OURS)).toBeNull());
    const del = vi.mocked(fetch).mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(String(del![0])).toContain(`/api/messages/${SOURCE_IDS.g2}_${0xa1b2c300}_8`);
  });

  it('Copy text copies the message with today\'s toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await openDm();
    const sheet = within(await longPress(THEIRS));
    fireEvent.click(sheet.getByRole('button', { name: /^Copy text/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(THEIRS));
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
  });

  it('without messages:write, React, Resend and Delete stay listed, off, with the reason', async () => {
    await openDm({ permissions: { bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } } as never });
    const sheet = within(await longPress(OURS));
    for (const name of [/^Resend/, /^Delete/]) {
      const item = sheet.getByRole('button', { name });
      expect(item).toBeDisabled();
      expect(item).toHaveAttribute('title', 'Needs messages:write');
    }
    expect(sheet.getByRole('button', { name: '👍' })).toBeDisabled();
    // Details and Copy send nothing and need nothing more.
    expect(sheet.getByRole('button', { name: /^Details/ })).toBeEnabled();
  });

  it('a tap on a reaction chip sends the same tapback, with its Sends line', async () => {
    await openDm();
    const row = within(rowOf(OURS));
    expect(row.getByText('A tap on a reaction sends 1 tapback')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: /👍/ }));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(JSON.parse(String(sent()[0][1]!.body))).toMatchObject({ text: '👍', emoji: 1, replyId: 8 });
  });

  it('a long-press opens the sheet on release, and its click sends nothing (no tapback from the chip under the finger)', async () => {
    await openDm();
    const chip = within(rowOf(OURS)).getByRole('button', { name: /👍/ });
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(chip, { pointerType: 'touch' });
      vi.advanceTimersByTime(500);
      // Still pressed: nothing mounts under the finger.
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.pointerUp(chip, { pointerType: 'touch' });
      fireEvent.click(chip);
    } finally {
      vi.useRealTimers();
    }
    expect(await screen.findByRole('dialog', { name: /^You · / })).toBeInTheDocument();
    expect(sent()).toHaveLength(0);
  });

  it('a short tap on a chip still sends 1 tapback', async () => {
    await openDm();
    const chip = within(rowOf(OURS)).getByRole('button', { name: /👍/ });
    fireEvent.pointerDown(chip, { pointerType: 'touch' });
    fireEvent.pointerUp(chip, { pointerType: 'touch' });
    fireEvent.click(chip);
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // F.2 B-I2: Enter activates a focused button on every auto-repeat keydown; a held key sends one tapback.
  it('a held Enter on a reaction chip does not repeat the tapback', async () => {
    await openDm();
    const chip = within(rowOf(OURS)).getByRole('button', { name: /👍/ });
    expect(fireEvent.keyDown(chip, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(chip, { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(chip, { key: ' ', repeat: true })).toBe(false);
  });

  it('the row keeps a keyboard way in: Message actions opens the sheet', async () => {
    await openDm();
    fireEvent.click(within(rowOf(THEIRS)).getByRole('button', { name: 'Message actions' }));
    expect(await screen.findByRole('dialog', { name: /^Kifisia Rooftop · / })).toBeInTheDocument();
  });
});

describe('message actions on a channel (desktop hover bar)', () => {
  const channel = `${g2}/channel/0`;

  it('the hover bar offers Reply, React, Translate and ⋯ (Details, Copy text, Delete)', async () => {
    renderChat(channel);
    await screen.findByText('Glyfada Beach checking in');
    const row = within(rowOf('Glyfada Beach checking in'));
    for (const name of ['Reply', 'React', 'Translate message']) expect(row.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: 'More actions' }));
    expect(row.getByRole('button', { name: /^Details/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /^Copy text/ })).toBeInTheDocument();
    expect(row.getByRole('button', { name: /^Delete/ })).toBeInTheDocument();
  });

  it('Resend in ⋯ (ours) says what it sends on the channel', async () => {
    renderChat(channel);
    await screen.findByText('Welcome back! Hearing you direct from Kifisia');
    const row = within(rowOf('Welcome back! Hearing you direct from Kifisia'));
    fireEvent.click(row.getByRole('button', { name: 'More actions' }));
    expect(row.getByText('Sends 1 new copy on # LongFast')).toBeInTheDocument();
  });

  it('without channel_0:write, Reply and Delete are off with the reason', async () => {
    renderChat(channel, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false }, messages: { read: true, write: true } } } } as never,
    });
    await screen.findByText('Glyfada Beach checking in');
    const row = within(rowOf('Glyfada Beach checking in'));
    expect(row.getByRole('button', { name: 'Reply' })).toBeDisabled();
    expect(row.getByRole('button', { name: 'Reply' })).toHaveAttribute('title', 'Needs channel_0:write');
    fireEvent.click(row.getByRole('button', { name: 'More actions' }));
    expect(row.getByRole('button', { name: /^Delete/ })).toBeDisabled();
  });

  it('without channel_0:write, Translate is off with the reason, as Classic (its actions sit behind write)', async () => {
    renderChat(channel, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { channel_0: { read: true, write: false }, messages: { read: true, write: true } } } } as never,
    });
    await screen.findByText('Glyfada Beach checking in');
    const translate = within(rowOf('Glyfada Beach checking in')).getByRole('button', { name: 'Translate message' });
    expect(translate).toBeDisabled();
    expect(translate).toHaveAttribute('title', 'Needs channel_0:write');
  });

  it('Translate shows the translation under the message (POST /api/translate, nothing on the mesh)', async () => {
    renderChat(channel, {
      fixtures: { 'POST /api/translate': () => ({ success: true, data: { translatedText: 'Η Γλυφάδα δίνει σήμα', targetLanguage: 'el', provider: 'fixture' } }) },
    });
    await screen.findByText('Glyfada Beach checking in');
    fireEvent.click(within(rowOf('Glyfada Beach checking in')).getByRole('button', { name: 'Translate message' }));
    expect(await screen.findByText('Η Γλυφάδα δίνει σήμα')).toBeInTheDocument();
    const call = vi.mocked(fetch).mock.calls.find(([u, i]) => String(u).includes('/api/translate') && i?.method === 'POST');
    expect(JSON.parse(String(call![1]!.body))).toMatchObject({ sourceId: SOURCE_IDS.g2, messageId: `${SOURCE_IDS.g2}_${0xa1b2c303}_3` });
    expect(sent()).toHaveLength(0);
  });

  const THEIRS_CH = 'Glyfada Beach checking in';
  const OURS_CH = 'Welcome back! Hearing you direct from Kifisia';
  const TX_TOOLTIP = "Transmit is disabled on this node's radio. Re-enable TX in the LoRa configuration to use this.";
  const txOff = { 'GET /api/device/tx-status': () => ({ ...athensFixture.txStatus, txEnabled: false, canTransmit: false }) };
  const barOf = (text: string) => within(rowOf(text));
  const more = (text: string) => barOf(text).getByRole('button', { name: 'More actions' });

  it('Esc on the ⋯ menu returns focus to ⋯', async () => {
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    fireEvent.click(more(THEIRS_CH));
    barOf(THEIRS_CH).getByRole('button', { name: /^Details/ }).focus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(barOf(THEIRS_CH).queryByRole('button', { name: /^Details/ })).toBeNull();
    expect(more(THEIRS_CH)).toHaveFocus();
  });

  it('choosing a ⋯ item returns focus to ⋯ (when the row still exists)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    fireEvent.click(more(THEIRS_CH));
    const copy = barOf(THEIRS_CH).getByRole('button', { name: /^Copy text/ });
    copy.focus();
    fireEvent.click(copy);
    await waitFor(() => expect(more(THEIRS_CH)).toHaveFocus());
  });

  /** The desktop keyboard rows' message ids, in thread order. */
  const keyRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-row-target][data-message-id]'));
  const rowIds = () => keyRows().map((r) => r.dataset.messageId!);
  const deleted = { 'DELETE /api/messages/:id': () => ({ message: 'Message deleted successfully' }) };

  /** ⋯ › Delete by keyboard focus, then Confirm (or Cancel) once it is enabled. */
  async function keyboardDelete(row: HTMLElement, choice: 'Delete' | 'Cancel' = 'Delete') {
    fireEvent.click(within(row).getByRole('button', { name: 'More actions' }));
    const item = within(row).getByRole('button', { name: /^Delete/ });
    item.focus();
    fireEvent.click(item);
    const confirm = await screen.findByRole('dialog', { name: 'Delete this message' });
    const button = within(confirm).getByRole('button', { name: choice });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this message' })).toBeNull());
  }

  it('after a keyboard delete, focus moves to the next message', async () => {
    renderChat(channel, { fixtures: deleted });
    await screen.findByText(THEIRS_CH);
    const ids = rowIds();
    const i = ids.indexOf(rowOf(THEIRS_CH).dataset.messageId!);
    expect(i).toBeLessThan(ids.length - 1);
    await keyboardDelete(rowOf(THEIRS_CH));
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-message-id', ids[i + 1]));
  });

  it('deleting the last message by keyboard moves focus to the one before it', async () => {
    renderChat(channel, { fixtures: deleted });
    await screen.findByText(THEIRS_CH);
    const ids = rowIds();
    await keyboardDelete(keyRows()[ids.length - 1]);
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-message-id', ids[ids.length - 2]));
  });

  it('cancelling a keyboard delete leaves focus in the row, not on the page', async () => {
    renderChat(channel, { fixtures: deleted });
    await screen.findByText(THEIRS_CH);
    await keyboardDelete(rowOf(THEIRS_CH), 'Cancel');
    expect(screen.getByText(THEIRS_CH)).toBeInTheDocument();
    await waitFor(() => expect(rowOf(THEIRS_CH).contains(document.activeElement)).toBe(true));
  });

  it('closing message details returns focus to the element that opened it', async () => {
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    fireEvent.click(more(THEIRS_CH));
    const details = barOf(THEIRS_CH).getByRole('button', { name: /^Details/ });
    details.focus();
    fireEvent.click(details);
    const panel = await screen.findByRole('complementary', { name: /Details$/ });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: /Details$/ })).toBeNull());
    expect(more(THEIRS_CH)).toHaveFocus();
  });

  it('a desktop message row is one Tab stop; ArrowRight/ArrowLeft move between reply/react/translate/⋯', async () => {
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    const row = rowOf(THEIRS_CH);
    const stops = [row, ...Array.from(row.querySelectorAll<HTMLElement>('button, a[href]'))].filter((e) => e.tabIndex === 0);
    expect(stops).toEqual([row]);
    row.focus();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    const names = ['Reply', 'React', 'Translate message', 'More actions'].map((n) => barOf(THEIRS_CH).getByRole('button', { name: n }));
    expect(names[0]).toHaveFocus();
    for (const next of names.slice(1)) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(next).toHaveFocus();
    }
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(names[2]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(row).toHaveFocus();
  });

  it('Enter on the row toggles it (not on repeat); links stay links, never inside a button', async () => {
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    const row = rowOf(THEIRS_CH);
    expect(row.querySelector('button a')).toBeNull();
    expect(row).not.toHaveAttribute('data-open');
    fireEvent.keyDown(row, { key: 'Enter', repeat: true });
    expect(row).not.toHaveAttribute('data-open');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(row).toHaveAttribute('data-open');
    // A key on a button inside the row is not the row's.
    fireEvent.keyDown(barOf(THEIRS_CH).getByRole('button', { name: 'Reply' }), { key: 'Enter' });
    expect(row).toHaveAttribute('data-open');
  });

  it('React and Resend are disabled with the TX-disabled reason', async () => {
    renderChat(channel, { fixtures: txOff });
    await screen.findByText(THEIRS_CH);
    await screen.findByText(TX_TOOLTIP);
    const react = barOf(THEIRS_CH).getByRole('button', { name: 'React' });
    expect(react).toBeDisabled();
    expect(react).toHaveAttribute('title', TX_TOOLTIP);
    fireEvent.click(more(OURS_CH));
    const resend = barOf(OURS_CH).getByRole('button', { name: /^Resend/ });
    expect(resend).toBeDisabled();
    expect(resend).toHaveAttribute('title', TX_TOOLTIP);
  });

  it('React and Resend are disabled with the disconnected reason', async () => {
    renderChat(channel, {
      fixtures: { 'GET /api/sources/:id/status': () => ({ ...athensFixture.statuses[SOURCE_IDS.g2], connected: false }) },
    });
    await screen.findByText(THEIRS_CH);
    const reason = 'Sending is paused while Station G2 is offline';
    const react = barOf(THEIRS_CH).getByRole('button', { name: 'React' });
    await waitFor(() => expect(react).toBeDisabled());
    expect(react).toHaveAttribute('title', reason);
    fireEvent.click(more(OURS_CH));
    expect(barOf(OURS_CH).getByRole('button', { name: /^Resend/ })).toHaveAttribute('title', reason);
  });

  it('the ⋯ menu on the last row opens upward', async () => {
    renderChat(channel);
    await screen.findByText(THEIRS_CH);
    const row = rowOf(OURS_CH);
    const list = row.parentElement as HTMLElement;
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect;
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(rect(0, 500));
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect(460, 490));
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
    try {
      fireEvent.click(more(OURS_CH));
      expect(barOf(OURS_CH).getByRole('group', { name: 'More actions' })).toHaveAttribute('data-placement', 'up');
    } finally {
      vi.restoreAllMocks();
    }
  });
});
