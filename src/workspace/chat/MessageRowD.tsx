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
 * Message actions arrive through `onAction`. This task wires Reply; the hover
 * bar, the phone's long-press sheet and the other kinds are Task 2.5's.
 * Reaction chips are shown, not tappable: a tap sends a tapback, which needs
 * its Sends line (2.5).
 */
import { memo, useState, type ReactNode } from 'react';
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
import styles from './MessageRowD.module.css';

export type MessageActionKind = 'reply' | 'react' | 'translate' | 'resend' | 'details' | 'copy' | 'delete';
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
  onDismissTranslation?: () => void;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  mentionOptions: MentionRenderOptions;
  canReply: boolean;
  onAction(kind: MessageActionKind, message: MeshMessage): void;
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
  const time = formatMessageTime(new Date(msg.timestamp), props.timeFormat, props.dateFormat);

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
      {props.translation && props.onDismissTranslation && (
        <TranslatedMessage state={props.translation} onDismiss={props.onDismissTranslation} />
      )}
      {signal.length > 0 && <p className={styles.signal}>{signal.join(' · ')}</p>}
      {props.reactions.length > 0 && (
        <div className={styles.reactions}>
          {props.reactions.map((r) => (
            <span key={r.id} className={styles.chip}>{r.text}</span>
          ))}
        </div>
      )}
    </>
  );
  const actions = props.canReply && !mine && (
    <div className={styles.actions}>
      <button type="button" className={styles.action} onClick={() => onAction('reply', msg)} title={t('channels.reply_button_title')}>
        <UiIcon name="reply" size={15} />
        <span className={styles.srOnly}>{t('workspace.chat.reply')}</span>
      </button>
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
        data-message-id={msg.id}
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
    </>
  );
}

const MessageRowD = memo(MessageRowDImpl);
export default MessageRowD;
