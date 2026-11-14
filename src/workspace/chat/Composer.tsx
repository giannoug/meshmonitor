/**
 * The layout D composer (boards 10-06, 10-03): today's `MessageComposeInput`
 * (text, byte counter, emoji, send) under a row of chips (Send position,
 * Translate, Bell), with the reply preview above and the Sends line below.
 *
 * - The draft lives in the compose-draft store, as in Classic; `onSend` gets
 *   its text and the message being replied to.
 * - `disabledReason` (TX disabled): every control stays visible but off, with
 *   the reason as its tooltip and as a note under the box.
 * - Translate opens the translate sheet (today's TranslateModal content, board 10-09).
 */
import { useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import MessageComposeInput from '../../components/MessageComposeInput';
import { UiIcon } from '../../components/icons';
import { useComposeDraftStore } from '../../contexts/composeDraftStore';
import { useMessaging } from '../../contexts/MessagingContext';
import type { MeshMessage } from '../../types/message';
import type { MentionCandidate } from '../../utils/mentions';
import { scrollInputIntoView } from '../../utils/scrollInputIntoView';
import SendsLine from '../patterns/SendsLine';
import { useIsPhone } from '../shell/useIsPhone';
import TranslateComposerSheet from './TranslateComposerSheet';
import styles from './Composer.module.css';

export type ComposerTarget =
  | { kind: 'channel'; channel: number; name: string }
  | { kind: 'dm'; nodeId: string; name: string };

export interface ComposerProps {
  target: ComposerTarget;
  /** Set when sending is off (TX disabled): the controls stay, disabled, with this tooltip. */
  disabledReason?: string;
  onSend(text: string, replyTo: MeshMessage | null): void;
  /** Sends the bell (on the channel, or as a DM), with the draft after it, and clears the draft. */
  onBell?(text: string): void;
  onSendPosition?(): void;
  /** The radio's hop limit, for the Sends line. */
  hopLimit?: number;
  /** Long name of the replied-to sender. */
  replyName?: string;
  canTranslate: boolean;
  translateLanguages?: { target?: string; source?: string };
  mentionCandidates: readonly MentionCandidate[];
  homoglyphEnabled: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function Composer(props: ComposerProps) {
  const { target, disabledReason } = props;
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const draft = useComposeDraftStore();
  const { replyingTo, setReplyingTo } = useMessaging();
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = props.inputRef ?? ownRef;
  const [translateOpen, setTranslateOpen] = useState(false);
  const off = !!disabledReason;

  const name = target.kind === 'channel' ? `# ${target.name}` : target.name;
  const sends =
    target.kind === 'channel'
      ? [t('workspace.chat.sends_channel', { channel: target.name }),
          ...(props.hopLimit ? [t('workspace.chat.hop_limit', { count: props.hopLimit })] : [])].join(' · ')
      : t('workspace.chat.sends_dm', { name: target.name });
  const chipTitle = (title: string) => disabledReason ?? title;

  return (
    <div className={styles.composer} data-phone={isPhone || undefined}>
      {replyingTo && (
        <div className={styles.reply}>
          <div className={styles.replyText}>
            <span className={styles.replyLabel}>{t('channels.replying_to', { name: props.replyName ?? replyingTo.from })}</span>
            <span className={styles.replyQuote}>{replyingTo.text}</span>
          </div>
          <button type="button" className={styles.icon} onClick={() => setReplyingTo(null)} title={t('channels.cancel_reply_title')}>
            <UiIcon name="close" size={16} />
            <span className={styles.srOnly}>{t('channels.cancel_reply_title')}</span>
          </button>
        </div>
      )}
      {(target.kind === 'channel' || props.onBell || props.canTranslate) && (
        <div className={styles.chips}>
          {target.kind === 'channel' && props.onSendPosition && (
            <button
              type="button"
              className={styles.chip}
              disabled={off}
              title={chipTitle(t('workspace.chat.send_position_title', { channel: target.name }))}
              onClick={props.onSendPosition}
            >
              <UiIcon name="location" size={16} /> {t('workspace.chat.send_position')}
            </button>
          )}
          {props.canTranslate && (
            <button type="button" className={styles.chip} disabled={off} title={chipTitle(t('messages.translate'))} onClick={() => setTranslateOpen(true)}>
              <UiIcon name="translate" size={16} /> {t('messages.translate_btn')}
            </button>
          )}
          {props.onBell && (
            <button
              type="button"
              className={styles.chip}
              disabled={off}
              title={chipTitle(
                target.kind === 'channel'
                  ? t('workspace.chat.bell_title', { channel: target.name })
                  : t('workspace.chat.bell_dm_title', { name: target.name }),
              )}
              onClick={() => {
                props.onBell?.(draft.get());
                draft.set('');
              }}
            >
              <UiIcon name="notifications" size={16} /> {t('workspace.chat.bell')}
            </button>
          )}
        </div>
      )}
      <div className={`${styles.input} message-input-container`}>
        <MessageComposeInput
          listId="workspace-mention-list"
          textareaRef={textareaRef}
          mentionCandidates={props.mentionCandidates}
          homoglyphEnabled={props.homoglyphEnabled}
          placeholder={
            isPhone
              ? t('channels.send_placeholder_short', { name })
              : t('channels.send_placeholder', { name })
          }
          disabled={off}
          disabledTitle={disabledReason}
          onFocus={scrollInputIntoView}
          onSend={() => props.onSend(draft.get(), replyingTo)}
        />
      </div>
      {disabledReason && <p className={styles.reason} role="note">{disabledReason}</p>}
      <SendsLine>{sends}</SendsLine>
      {translateOpen && (
        <TranslateComposerSheet
          onClose={() => setTranslateOpen(false)}
          initialText={draft.get()}
          defaultTargetLanguage={props.translateLanguages?.target}
          defaultSourceLanguage={props.translateLanguages?.source}
          onApply={(text) => draft.set(text)}
        />
      )}
    </div>
  );
}
