/**
 * What a message offers (spec s10n0, boards 10-01, 10-08), shared by the
 * desktop hover bar and the phone's long-press sheet. Gates are today's
 * (ChannelsTab / MessagesTab): reply, react and resend on a device channel
 * or a DM, not on an MQTT mirror; reply on theirs, resend on ours; translate
 * when the viewer may translate and there is text. An item the viewer may
 * not use is listed, off, with the reason.
 */
import { DEFAULT_TAPBACK_EMOJIS, type TapbackEmoji } from '../../components/EmojiPickerModal';
import type { UiIconName } from '../../components/icons';
import type { MeshMessage } from '../../types/message';

export type MessageActionKind = 'reply' | 'react' | 'translate' | 'resend' | 'details' | 'copy' | 'delete';

/** Per conversation; the screen memoizes it so the rows keep their memo. */
export interface MessageActionContext {
  /** Reply, react and resend apply (a device channel or a DM, not an MQTT mirror). */
  canSend: boolean;
  /** Missing write grant for the channel or DM ("Needs channel_0:write"). */
  writeReason?: string;
  /** Why a send is off: the write grant, TX disabled, or the device disconnected. */
  sendReason?: string;
  deleteReason?: string;
  canTranslate: boolean;
  /** "Into English · shown under the message". */
  translateHint: string;
  /** The Sends lines: 1 tapback, 1 new copy. */
  sendsTapback: string;
  sendsResend: string;
}

export interface MessageActionItem {
  kind: MessageActionKind;
  reason?: string;
  sends?: string;
}

export const ACTION_ICON: Record<MessageActionKind, UiIconName> = {
  reply: 'reply',
  react: 'reaction',
  translate: 'translate',
  resend: 'resend',
  details: 'info',
  copy: 'copy',
  delete: 'delete',
};

/** Visible labels (board wording; no control has them today). */
export const ACTION_LABEL: Record<MessageActionKind, string> = {
  reply: 'workspace.chat.reply',
  react: 'workspace.chat.react',
  translate: 'messages.translate_btn',
  resend: 'workspace.chat.resend',
  details: 'common.details',
  copy: 'workspace.chat.copy_text',
  delete: 'workspace.chat.delete',
};

/** The sheet's second lines (board 10-08); translate's names the language (`translateHint`). */
export const ACTION_HINT: Partial<Record<MessageActionKind, string>> = {
  details: 'workspace.chat.details_hint',
  delete: 'workspace.chat.delete_hint',
};

/** Today's tooltips for the same buttons (ChannelMessageRow / DmMessageRow). */
export const ACTION_TITLE: Partial<Record<MessageActionKind, string>> = {
  reply: 'channels.reply_button_title',
  react: 'channels.emoji_button_title',
  translate: 'messages.translate',
  resend: 'channels.resend_button_title',
  delete: 'channels.delete_button_title',
};

export function messageActionItems(ctx: MessageActionContext, msg: MeshMessage, mine: boolean): MessageActionItem[] {
  const items: MessageActionItem[] = [];
  if (ctx.canSend && !mine) items.push({ kind: 'reply', reason: ctx.writeReason });
  if (ctx.canSend) items.push({ kind: 'react', reason: ctx.sendReason, sends: ctx.sendsTapback });
  if (ctx.canTranslate && msg.text) items.push({ kind: 'translate' });
  if (ctx.canSend && mine) items.push({ kind: 'resend', reason: ctx.sendReason, sends: ctx.sendsResend });
  items.push({ kind: 'details' });
  if (msg.text) items.push({ kind: 'copy' });
  items.push({ kind: 'delete', reason: ctx.deleteReason });
  return items;
}

/** EmojiPickerModal's set: the one saved in Appearance replaces the defaults. */
export function tapbackSet(saved: TapbackEmoji[] | undefined): TapbackEmoji[] {
  return saved && saved.length > 0 ? saved : DEFAULT_TAPBACK_EMOJIS;
}

/** EmojiPickerModal's custom input limit (characters). */
export const CUSTOM_EMOJI_MAX_LENGTH = 10;
