/**
 * The screen side of a message's actions (ChannelThread, DmConversation):
 * `onAction` (stable, for the memoized rows) and what it opens: the emoji
 * picker, the delete confirm, and Message details (a side panel on desktop,
 * `panel`, placed beside the conversation; a sheet on the phone, in `sheets`).
 *
 * Sends go through the screen's one `useMeshtasticMessageActions` instance
 * (Ruling AD): react = 1 tapback, resend = 1 new copy, both on a click only.
 * Translate is the server's provider (POST /api/translate); details read the
 * stored timeline; copy and delete stay in MeshMonitor. Nothing retries.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/ToastContainer';
import type { DateFormat, TimeFormat } from '../../contexts/SettingsContext';
import type { MeshtasticMessageActions } from '../../hooks/useMeshtasticMessageActions';
import type { DeviceInfo } from '../../types/device';
import type { MeshMessage } from '../../types/message';
import type { MessageDirection } from '../../utils/deliveryDiagnostics/types';
import ConfirmSheet from '../patterns/ConfirmSheet';
import EmojiPickerSheet from './EmojiPickerSheet';
import MessageDetailsPanel from './MessageDetailsPanel';
import type { MessageActionKind } from './messageActions';

export interface UseMessageActionsOptions {
  actions: MeshtasticMessageActions;
  translate(id: string, text: string): void;
  onReply(msg: MeshMessage): void;
  isMine(msg: MeshMessage): boolean;
  sourceId: string;
  nodes: DeviceInfo[];
  phone: boolean;
  /** The picker's Sends line. */
  sendsTapback: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
}

export function useMessageActions(opts: UseMessageActionsOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [picker, setPicker] = useState<MeshMessage | null>(null);
  const [details, setDetails] = useState<{ message: MeshMessage; direction: MessageDirection } | null>(null);
  const [toDelete, setToDelete] = useState<MeshMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  // The latest options behind the stable `onAction`.
  const latest = useRef(opts);
  useLayoutEffect(() => {
    latest.current = opts;
  });

  const onAction = useCallback(
    (kind: MessageActionKind, msg: MeshMessage, emoji?: string) => {
      const o = latest.current;
      switch (kind) {
        case 'reply':
          o.onReply(msg);
          break;
        case 'react':
          if (emoji) void o.actions.sendTapback(msg, emoji);
          else setPicker(msg);
          break;
        case 'translate':
          o.translate(msg.id, msg.text);
          break;
        case 'resend':
          void o.actions.resend(msg);
          break;
        case 'details':
          setDetails({ message: msg, direction: o.isMine(msg) ? 'sent' : 'received' });
          break;
        case 'copy':
          void (async () => {
            try {
              await navigator.clipboard.writeText(msg.text);
              showToast(t('toast.copied_clipboard'), 'success');
            } catch {
              showToast(t('errors.generic'), 'error');
            }
          })();
          break;
        case 'delete':
          setToDelete(msg);
          break;
      }
    },
    [showToast, t],
  );

  const detailsView = details && (
    <MessageDetailsPanel
      key={details.message.id}
      message={details.message}
      direction={details.direction}
      sourceId={opts.sourceId}
      nodes={opts.nodes}
      phone={opts.phone}
      timeFormat={opts.timeFormat}
      dateFormat={opts.dateFormat}
      onNodeClick={(nodeId) => {
        setDetails(null);
        void navigate(`/source/${encodeURIComponent(opts.sourceId)}/node/${encodeURIComponent(nodeId)}`, {
          state: { focusDmNodeId: nodeId },
        });
      }}
      onClose={() => setDetails(null)}
    />
  );

  const sheets: ReactNode = (
    <>
      {picker && (
        <EmojiPickerSheet
          sends={opts.sendsTapback}
          onPick={(emoji) => void opts.actions.sendTapback(picker, emoji)}
          onClose={() => setPicker(null)}
        />
      )}
      <ConfirmSheet
        open={!!toDelete}
        title={t('channels.delete_button_title')}
        body={t('messages.confirm_delete')}
        confirmLabel={t('common.delete')}
        danger
        busy={deleting}
        onConfirm={async () => {
          if (!toDelete) return;
          setDeleting(true);
          try {
            // Today's request and toasts; the channel scopes the local removal (Ruling 2.2).
            await opts.actions.deleteMessage(toDelete.id, toDelete.channel);
            if (details?.message.id === toDelete.id) setDetails(null);
          } finally {
            setDeleting(false);
            setToDelete(null);
          }
        }}
        onCancel={() => setToDelete(null)}
      />
      {opts.phone && detailsView}
    </>
  );

  return { onAction, sheets, panel: opts.phone ? null : detailsView };
}
