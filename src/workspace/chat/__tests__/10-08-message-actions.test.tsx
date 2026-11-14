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
});
