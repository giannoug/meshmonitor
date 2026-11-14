/**
 * One message in a layout D conversation (boards a-chat-D-desktop, 10-06).
 *
 * - `style` is the viewer's `workspace.messageStyle`: `rows` (avatar, name,
 *   time, text; Slack-style) or `bubbles` (ours on the right).
 * - The signal line (hops, SNR, where it was heard) follows
 *   `workspace.signalDetail`: on hover, focus or a tap, or always.
 * - Ours carry the ack state in words (Pending / Delivered / Confirmed /
 *   Failed / Timed out), with today's status text as the tooltip.
 *
 * Message actions (Task 2.5) go out through `onAction`: on desktop the hover
 * bar (shown on hover and on keyboard focus), on the phone a long-press (or
 * the row's "Message actions" button, for keyboards) opens the actions sheet.
 * A reaction chip sends the same tapback when React is on, with its Sends line.
 *
 * Memoized by value (`messageRowPropsEqual`): the screen keeps `onAction`,
 * `actionContext` and `translationActions` stable, and the per-render
 * reaction arrays compare by content.
 */
import { memo, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MeshMessage } from '../../types/message';
import type { DateFormat, TimeFormat } from '../../contexts/SettingsContext';
import { UiIcon } from '../../components/icons';
import LinkPreview from '../../components/LinkPreview';
import UnreadDivider from '../../components/messages/UnreadDivider';
import { TranslatedMessage, type TranslatedMessageState } from '../../components/translation/TranslatedMessage';
import { formatMessageTime } from '../../utils/datetime';
import { getMeshtasticDeliveryState } from '../../utils/deliveryDiagnostics/status';
import { renderMessageWithLinks, type MentionRenderOptions } from '../../utils/linkRenderer';
import { messageRowPropsEqual } from '../../components/messages/messageRowSupport';
import SendsLine from '../patterns/SendsLine';
import MessageActionsSheet from './MessageActionsSheet';
import MessageHoverBar from './MessageHoverBar';
import { messageActionItems, type MessageActionContext, type MessageActionKind } from './messageActions';
import styles from './MessageRowD.module.css';

export type { MessageActionKind } from './messageActions';

/** How long a press opens the actions sheet on the phone. */
const LONG_PRESS_MS = 500;

/** Inline translation controls (stable object from the screen). */
export interface RowTranslationActions {
  dismiss(id: string): void;
  /** Retry or change language; absent when the viewer may not translate. */
  translate?(id: string, text: string, lang?: string): void;
}
export type MessageStyle = 'rows' | 'bubbles';
export type SignalDetail = 'hover' | 'always';

export interface MessageRowDProps {
  message: MeshMessage;
  style: MessageStyle;
  signalDetail: SignalDetail;
  mine: boolean;
  senderName: string;
  senderShort: string;
  /** The device the message was heard on ("heard via …"). */
  heardVia?: string;
  reactions: MeshMessage[];
  replied: MeshMessage | null;
  repliedName?: string;
  showUnreadDivider: boolean;
  dateSeparator: string | null;
  translation?: TranslatedMessageState;
  translationActions?: RowTranslationActions;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  mentionOptions: MentionRenderOptions;
  actionContext: MessageActionContext;
  /** Phone: long-press sheet; else the hover bar. */
  phone: boolean;
  /** `emoji` with `react` sends that tapback; without it, the picker opens. */
  onAction(kind: MessageActionKind, message: MeshMessage, emoji?: string): void;
}

/** A stable avatar colour per node, from the categorical device tokens. */
function avatarToken(nodeId: string): string {
  const num = parseInt(nodeId.replace('!', ''), 16) || 0;
  return `var(--device-${(num % 8) + 1})`;
}

function MessageRowDImpl(props: MessageRowDProps) {
  const { message: msg, style, signalDetail, mine, senderName, senderShort, onAction } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Long-press (phone): the sheet opens on release, never under the finger, and the release's
  // click is swallowed for the whole row (a chip under the finger must not send).
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean; menu: boolean; touch: boolean }>({
    timer: null,
    held: false,
    menu: false,
    touch: false,
  });
  const swallowClick = useRef(false);
  const time = formatMessageTime(new Date(msg.timestamp), props.timeFormat, props.dateFormat);
  const items = messageActionItems(props.actionContext, msg, mine);
  const react = items.find((i) => i.kind === 'react');
  const chipsSend = !!react && !react.reason;

  const resetPress = () => {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current = { ...press.current, timer: null, held: false, menu: false };
  };
  useEffect(() => () => {
    if (press.current.timer) clearTimeout(press.current.timer);
  }, []);
  const pressProps = props.phone
    ? {
        onPointerDown: (e: PointerEvent) => {
          resetPress();
          swallowClick.current = false;
          press.current.touch = e.pointerType !== 'mouse';
          if (!press.current.touch) return;
          press.current.timer = setTimeout(() => {
            press.current.held = true;
          }, LONG_PRESS_MS);
        },
        onPointerUp: () => {
          const open = press.current.held;
          resetPress();
          if (open) {
            swallowClick.current = true;
            setSheet(true);
          }
        },
        onPointerLeave: resetPress,
        // The browser took the gesture (scroll, or its own long-press): no click follows.
        onPointerCancel: () => {
          const open = press.current.menu;
          resetPress();
          if (open) setSheet(true);
        },
        // The browser's long-press (Android) waits for the release; a right-click opens at once.
        onContextMenu: (e: MouseEvent) => {
          e.preventDefault();
          if (press.current.touch) {
            press.current.held = true;
            press.current.menu = true;
          } else {
            setSheet(true);
          }
        },
        onClickCapture: (e: MouseEvent) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        },
      }
    : {};

  const ack = mine ? getMeshtasticDeliveryState(msg) : null;
  const ackLabel = ack && (
    <span className={styles.ack} data-ack={ack} title={t(`message_status.${ack}`)}>
      {ack === 'delivered' || ack === 'confirmed' ? <UiIcon name="check" size={13} /> : null}
      {t(`workspace.chat.ack.${ack}`)}
    </span>
  );

  const signal: string[] = [];
  if (!mine) {
    if (msg.viaMqtt) signal.push(t('workspace.chat.via_mqtt'));
    else if (typeof msg.hopStart === 'number' && typeof msg.hopLimit === 'number') {
      const hops = msg.hopStart - msg.hopLimit;
      signal.push(hops <= 0 ? t('workspace.chat.direct') : t('workspace.chat.hops', { count: hops }));
    }
    if (typeof msg.rxSnr === 'number') signal.push(t('workspace.chat.snr', { snr: msg.rxSnr }));
    if (props.heardVia) signal.push(t('workspace.chat.heard_via', { name: props.heardVia }));
  }

  const text = (
    <div className={styles.text} onClick={() => setOpen((o) => !o)}>
      {renderMessageWithLinks(msg.text, props.mentionOptions)}
    </div>
  );
  const quote: ReactNode = msg.replyId ? (
    <div className={styles.quote}>
      <UiIcon name="reply" size={13} />
      {props.replied ? (
        <span>
          <strong>{props.repliedName}</strong> {props.replied.text || t('channels.empty_message')}
        </span>
      ) : (
        <em>{t('channels.message_unavailable')}</em>
      )}
    </div>
  ) : null;
  const extras = (
    <>
      <LinkPreview text={msg.text} />
      {props.translation && props.translationActions && (
        <TranslatedMessage
          state={props.translation}
          onDismiss={() => props.translationActions!.dismiss(msg.id)}
          onRetry={props.translationActions.translate && (() => props.translationActions!.translate!(msg.id, msg.text))}
          onChangeTargetLang={
            props.translationActions.translate && ((lang) => props.translationActions!.translate!(msg.id, msg.text, lang))
          }
        />
      )}
      {signal.length > 0 && <p className={styles.signal}>{signal.join(' · ')}</p>}
      {props.reactions.length > 0 && (
        <>
          <div className={styles.reactions}>
            {props.reactions.map((r) =>
              chipsSend ? (
                <button key={r.id} type="button" className={styles.chip} title={react?.sends} onClick={() => onAction('react', msg, r.text)}>
                  {r.text}
                </button>
              ) : (
                <span key={r.id} className={styles.chip}>{r.text}</span>
              ),
            )}
          </div>
          {chipsSend && <SendsLine>{t('workspace.chat.sends_chip')}</SendsLine>}
        </>
      )}
    </>
  );
  const actions = props.phone ? (
    <button type="button" className={styles.sheetButton} onClick={() => setSheet(true)}>
      <UiIcon name="more" size={18} />
      {t('workspace.chat.message_actions')}
    </button>
  ) : (
    <div className={styles.actions}>
      <MessageHoverBar message={msg} items={items} onAction={onAction} />
    </div>
  );
  const avatar = (
    <span className={styles.avatar} style={{ background: avatarToken(msg.from) }} aria-hidden="true">
      {senderShort}
    </span>
  );

  return (
    <>
      {props.dateSeparator && <p className={styles.date}>{props.dateSeparator}</p>}
      {props.showUnreadDivider && <UnreadDivider />}
      <div
        className={styles.row}
        data-style={style}
        data-mine={mine || undefined}
        data-detail={signalDetail}
        data-open={open || undefined}
        data-phone={props.phone || undefined}
        data-message-id={msg.id}
        {...pressProps}
      >
        {style === 'rows' ? (
          <>
            {avatar}
            <div className={styles.body}>
              <p className={styles.head}>
                <span className={styles.name}>{mine ? t('workspace.chat.you') : senderName}</span>
                <span className={styles.time}>{time}</span>
                {ackLabel}
              </p>
              {quote}
              {text}
              {extras}
            </div>
            {actions}
          </>
        ) : (
          <>
            {!mine && avatar}
            <div className={styles.bubble}>
              {!mine && <p className={styles.bubbleName}>{senderName}</p>}
              {quote}
              <div className={styles.bubbleText}>
                {text}
                <span className={styles.time}>{time}</span>
                {ackLabel}
              </div>
              {extras}
            </div>
            {actions}
          </>
        )}
      </div>
      {sheet && (
        <MessageActionsSheet
          message={msg}
          title={`${mine ? t('workspace.chat.you') : senderName} · ${time}`}
          items={items}
          translateHint={props.actionContext.translateHint}
          onAction={onAction}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}

const MessageRowD = memo(MessageRowDImpl, messageRowPropsEqual);
export default MessageRowD;
