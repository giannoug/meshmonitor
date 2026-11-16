/**
 * ChannelsConfigSection — Meshtastic channel slots (#5829).
 *
 * Lists the configured channels (role != DISABLED) as cards that open in
 * place, the same model the MeshCore channel list and the automation lists
 * use. Each card has its own "Save to device": one set_channel admin write,
 * with no SaveBar and no batching across channels. "Add channel" opens a new
 * card on the next free slot (0-7).
 *
 * Kept from before: drag-to-reorder followed by "Apply Order" (the device
 * reboots), JSON export / import per slot, the Channel Database key-collision
 * warning (#3644), the AEAD badge and the position-precision readout.
 *
 * AEAD (#5248 Phase 2b): an Experimental checkbox, offered when the node runs
 * firmware 2.8.1+ and the channel has a key. Turning it on asks first, because
 * nodes without AEAD can no longer read the channel.
 */
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { UiIcon } from '../icons';
import AeadBadge from '../channels/AeadBadge';
import { DRAG_HANDLE_TOUCH_STYLE } from '../dragHandleStyle';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Channel } from '../../types/device';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useResolvedSourceId } from '../../hooks/useResolvedSourceId';
import { formatPrecisionAccuracy } from '../../utils/distance';
import { NumberInput } from '../common/NumberInput';
import Modal from '../common/Modal';
import { ConfigSection } from '../shared/config/ConfigSection';
import { ConfigItemCard, ConfigItemCardButton, type ConfigItemChip } from '../shared/config/ConfigItemCard';
import { ChannelKeyField } from '../shared/config/ChannelKeyField';
import { ChannelEncryptionLabel } from '../shared/config/ChannelEncryptionLabel';
import { DiscardChangesDialog } from '../shared/config/DiscardChangesDialog';
import { ConfirmDialog } from '../shared/automation/ConfirmDialog';
import { useDiscardGuard } from '../shared/config/useDiscardGuard';
import { isValidChannelKey } from '../shared/config/channelKey';
import {
  MAX_NAME_LENGTH,
  PSK_ALLOWED_BYTES,
  PSK_GENERATE_BYTES,
  ROLE_LABEL_KEYS,
  autoPositionChannelId as findAutoPositionChannel,
  channelEncryptionStatus,
  draftsEqual,
  isConfigured,
  nextFreeSlot as findNextFreeSlot,
  openDraft,
  roleOptions as allowedRoles,
  useChannelActions,
  useChannelBySlot,
  useChannelCollisions,
  useChannelReorder,
  type ChannelDraft,
  type EditingState,
} from './channelSlots';
import styles from './ChannelsConfigSection.module.css';

interface ChannelsConfigSectionProps {
  baseUrl?: string;
  channels: Channel[];
  onChannelsUpdated?: () => void;
  /** The node's firmware supports AEAD channels (2.8.1+, #5248). */
  aeadSupported?: boolean;
}

/** Wrapper that makes a channel card draggable. */
const SortableChannelCard: React.FC<{
  // Must match the SortableContext `items` entries exactly — dnd-kit looks
  // items up with `indexOf`, so a string id against numeric items leaves every
  // card at index -1 and nothing shifts while dragging (#5324).
  id: number;
  disabled: boolean;
  dragLabel: string;
  children: React.ReactNode;
}> = ({ id, disabled, dragLabel, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.sortable} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        data-testid="channel-drag-handle"
        className={`${styles.handle} ${disabled ? styles.handleDisabled : ''}`}
        // #5233 — see DRAG_HANDLE_TOUCH_STYLE for why each property matters on a phone.
        style={DRAG_HANDLE_TOUCH_STYLE}
        title={dragLabel}
      >
        <UiIcon name="dragHandle" size={20} />
      </div>
      <div className={styles.sortableBody}>{children}</div>
    </div>
  );
};

const ChannelsConfigSection: React.FC<ChannelsConfigSectionProps> = ({
  channels,
  onChannelsUpdated,
  aeadSupported = false,
}) => {
  const { t } = useTranslation();
  const { distanceUnit } = useSettings();
  const { hasPermission } = useAuth();
  // Channel writes require a concrete sourceId; resolve context source or primary.
  const sourceId = useResolvedSourceId();
  // The server also checks channel_N:write on each channel write.
  const canWrite = hasPermission('configuration', 'write', { sourceId });

  const collisionDbNamesByChannelId = useChannelCollisions(sourceId, channels);
  const channelBySlot = useChannelBySlot(channels);
  const actions = useChannelActions(sourceId);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmAead, setConfirmAead] = useState(false);
  const dirty = !!editing && (editing.isNew || !draftsEqual(editing.draft, editing.original));
  const discard = useDiscardGuard(dirty);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importSlotId, setImportSlotId] = useState<number>(0);
  const [importFileContent, setImportFileContent] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const reorder = useChannelReorder(channels, sourceId, onChannelsUpdated);
  const { slotOrder, hasReorderChanges, isReordering } = reorder;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Drag only reorders the local list; nothing is written until Apply Order.
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(Number(event.active.id));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) reorder.move(Number(active.id), Number(over.id));
  };

  const handleApplyReorder = reorder.apply;
  const handleCancelReorder = reorder.cancel;

  // Auto-position channel: lowest-index channel with positionPrecision > 0
  const autoPositionChannelId = useMemo(() => findAutoPositionChannel(channels), [channels]);

  // Configured slots, in the current drag order.
  const visibleSlots = slotOrder.filter(slot => isConfigured(channelBySlot.get(slot)));

  // The lowest slot without a channel; null when all eight are in use.
  const nextFreeSlot = useMemo(() => findNextFreeSlot(channelBySlot), [channelBySlot]);

  const openEditor = (slotId: number, isNew: boolean) => {
    setEditing(openDraft(slotId, isNew, channelBySlot.get(slotId)));
  };

  const updateDraft = (patch: Partial<ChannelDraft>) => {
    setEditing(prev => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev));
  };

  const keyValid = !!editing && isValidChannelKey(editing.draft.psk, 'base64', PSK_ALLOWED_BYTES);

  // One set_channel write for this card, and only on an explicit click.
  const handleSaveChannel = async () => {
    if (!editing || !keyValid) return;
    if (editing.draft.name.length <= MAX_NAME_LENGTH) setIsSaving(true);
    try {
      if (await actions.save(editing)) {
        setEditing(null);
        onChannelsUpdated?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChannel = async (slotId: number) => {
    if (slotId !== 0 && editing?.slotId === slotId) setEditing(null);
    if (await actions.remove(slotId)) onChannelsUpdated?.();
  };

  const handleExportChannel = actions.exportJson;

  const handleImportClick = (slotId: number) => {
    setImportSlotId(slotId);
    setImportFileContent('');
    setShowImportModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportFileContent(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImportChannel = async () => {
    if (!importFileContent) {
      await actions.importJson(importSlotId, importFileContent);
      return;
    }
    setIsImporting(true);
    try {
      if (await actions.importJson(importSlotId, importFileContent)) {
        setShowImportModal(false);
        setImportFileContent('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        onChannelsUpdated?.();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const reorderBlockReason = hasReorderChanges
    ? t('channels_config.reorder_blocks_edit', 'Apply or cancel the new channel order first.')
    : undefined;

  /**
   * Roles the select offers. A new card is Primary on slot 0 and Secondary
   * elsewhere; Delete stands in for Disabled. An existing card offers Primary
   * only on slot 0, when it already is primary, or when no other channel is,
   * so the UI never sets up two primaries (the server does not check).
   */
  const roleOptions = (edit: EditingState): number[] => allowedRoles(channels, edit);

  const renderEditor = (edit: EditingState) => (
    <>
      <div className="setting-item">
        <label htmlFor="edit-channel-name">
          {t('channels_config.channel_name')}
          <span className="setting-description">{t('channels_config.channel_name_description')}</span>
        </label>
        <input
          id="edit-channel-name"
          type="text"
          maxLength={MAX_NAME_LENGTH}
          value={edit.draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          className="setting-input"
          placeholder={t('channels_config.channel_name_placeholder')}
        />
      </div>

      <ChannelKeyField
        id="edit-channel-psk"
        label={t('channels_config.psk')}
        description={t('channels_config.psk_description')}
        value={edit.draft.psk}
        onChange={(psk) => updateDraft({ psk })}
        format="base64"
        generateBytes={PSK_GENERATE_BYTES}
        allowedBytes={PSK_ALLOWED_BYTES}
        invalidMessage={t('channels_config.psk_invalid', 'Enter a base64 key of 1, 16 or 32 bytes, or leave it empty for no encryption.')}
        placeholder={t('channels_config.psk_placeholder')}
      />

      <div className="setting-item">
        <label htmlFor="edit-channel-role">
          {t('channels_config.channel_role')}
          <span className="setting-description">{t('channels_config.channel_role_description')}</span>
        </label>
        <select
          id="edit-channel-role"
          value={edit.draft.role}
          onChange={(e) => updateDraft({ role: parseInt(e.target.value, 10) })}
          className="setting-input"
        >
          {roleOptions(edit).map(role => (
            <option key={role} value={role}>{t(ROLE_LABEL_KEYS[role])}</option>
          ))}
        </select>
      </div>

      <div className="setting-item">
        <label htmlFor="edit-channel-precision">
          {t('channels_config.position_precision')}
          <span className="setting-description">{t('channels_config.position_precision_description')}</span>
        </label>
        <NumberInput
          id="edit-channel-precision"
          min={0}
          max={32}
          integer
          value={edit.draft.positionPrecision}
          onChange={(value) => updateDraft({ positionPrecision: value })}
          className="setting-input"
          placeholder="32"
        />
        <span className={`setting-description ${styles.accuracy}`}>
          {t('channels_config.estimated_accuracy', { accuracy: formatPrecisionAccuracy(edit.draft.positionPrecision, distanceUnit) })}
        </span>
      </div>

      <div className="setting-item">
        <label className={styles.checkLabel}>
          <span className={styles.checkRow}>
            <input
              type="checkbox"
              checked={edit.draft.uplinkEnabled}
              onChange={(e) => updateDraft({ uplinkEnabled: e.target.checked })}
            />
            <span>{t('channels_config.uplink_enabled')}</span>
          </span>
          <span className={`setting-description ${styles.checkDescription}`}>{t('channels_config.uplink_description')}</span>
        </label>
      </div>

      <div className="setting-item">
        <label className={styles.checkLabel}>
          <span className={styles.checkRow}>
            <input
              type="checkbox"
              checked={edit.draft.downlinkEnabled}
              onChange={(e) => updateDraft({ downlinkEnabled: e.target.checked })}
            />
            <span>{t('channels_config.downlink_enabled')}</span>
          </span>
          <span className={`setting-description ${styles.checkDescription}`}>{t('channels_config.downlink_description')}</span>
        </label>
      </div>

      {renderAeadField(edit)}
    </>
  );

  /**
   * AEAD checkbox (#5248). Turning it on needs firmware 2.8.1+ and a key, and
   * asks first; turning it off is always allowed, so a channel set elsewhere
   * can be switched back.
   */
  const renderAeadField = (edit: EditingState) => {
    const hasKey = edit.draft.psk !== '';
    const canEnable = aeadSupported && hasKey;
    const disabled = !edit.draft.useAead && !canEnable;
    const reason = !aeadSupported
      ? t('channels_config.aead_needs_firmware')
      : !hasKey
        ? t('channels_config.aead_needs_key')
        : undefined;
    return (
      <div className="setting-item">
        <label className={styles.checkLabel} title={disabled ? reason : undefined}>
          <span className={styles.checkRow}>
            <input
              type="checkbox"
              data-testid="channel-use-aead"
              checked={edit.draft.useAead}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) setConfirmAead(true);
                else updateDraft({ useAead: false });
              }}
            />
            <span>{t('channels_config.aead_label')}</span>
          </span>
          <span className={`setting-description ${styles.checkDescription}`}>
            <strong>{t('channels_config.aead_warning_title')}</strong> {t('channels_config.aead_warning_body')}
          </span>
          {disabled && reason && (
            <span className={`setting-description ${styles.checkDescription}`}>{reason}</span>
          )}
        </label>
      </div>
    );
  };

  const renderFooter = (edit: EditingState) => ({ numberInvalid }: { numberInvalid: boolean }) => (
    <>
      <ConfigItemCardButton onClick={() => setEditing(null)} disabled={isSaving}>
        {t('common.cancel', 'Cancel')}
      </ConfigItemCardButton>
      <ConfigItemCardButton
        variant="primary"
        onClick={() => { void handleSaveChannel(); }}
        disabled={isSaving || numberInvalid || !keyValid || (!edit.isNew && !dirty)}
      >
        <UiIcon name="save" size={14} />
        {isSaving ? t('common.saving', 'Saving...') : t('channels_config.save_to_device', 'Save to device')}
      </ConfigItemCardButton>
    </>
  );

  const chipsFor = (channel: Channel, slotId: number, displaySlot: number): ConfigItemChip[] => {
    const chips: ConfigItemChip[] = [
      { label: <ChannelEncryptionLabel status={channelEncryptionStatus(channel)} /> },
    ];
    const isPrimary = hasReorderChanges ? displaySlot === 0 : channel.role === 1;
    chips.push(isPrimary
      ? { label: <><UiIcon name="favorite" size={12} /> {t('channels_config.primary')}</>, tone: 'accent' }
      : { label: t('channels_config.role_secondary') });
    if (channel.uplinkEnabled) {
      chips.push({ label: <><UiIcon name="sortAscending" size={12} /> {t('channels_config.uplink')}</>, tone: 'info' });
    }
    if (channel.downlinkEnabled) {
      chips.push({ label: <><UiIcon name="sortDescending" size={12} /> {t('channels_config.downlink')}</>, tone: 'info' });
    }
    if ((channel.positionPrecision ?? 0) > 0) {
      const auto = slotId === autoPositionChannelId;
      chips.push({
        label: (
          <>
            <UiIcon name={auto ? 'location' : 'pin'} size={12} />{' '}
            {auto ? t('channels_config.location_auto_broadcast') : t('channels_config.location_enabled')}
            {` (${formatPrecisionAccuracy(channel.positionPrecision ?? 0, distanceUnit)})`}
          </>
        ),
      });
    }
    return chips;
  };

  return (
    <>
      <ConfigSection
        title={t('channels_config.title')}
        docsUrl="https://meshtastic.org/docs/configuration/radio/channels/"
        description={t('channels_config.description')}
        canWrite={canWrite}
      >
        {/* Reorder action bar */}
        {hasReorderChanges && (
          <div className={styles.reorderBar}>
            <span className={styles.reorderText}>
              {t('channels_config.reorder_pending', 'Channel order changed. Apply to device?')}
            </span>
            <ConfigItemCardButton variant="primary" onClick={() => { void handleApplyReorder(); }} disabled={isReordering}>
              {isReordering ? t('common.saving', 'Saving...') : t('channels_config.apply_order', 'Apply Order')}
            </ConfigItemCardButton>
            <ConfigItemCardButton onClick={handleCancelReorder} disabled={isReordering}>
              {t('common.cancel', 'Cancel')}
            </ConfigItemCardButton>
          </div>
        )}

        {visibleSlots.length === 0 && !editing?.isNew && (
          <p className={styles.empty}>{t('channels_config.no_channels', 'No channels are configured.')}</p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleSlots} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {visibleSlots.map(slotId => {
                const channel = channelBySlot.get(slotId)!;
                const displaySlot = slotOrder.indexOf(slotId);
                const isEditing = editing !== null && !editing.isNew && editing.slotId === slotId;
                const collisions = collisionDbNamesByChannelId.get(channel.id);
                return (
                  <SortableChannelCard
                    key={slotId}
                    id={slotId}
                    disabled={!canWrite || editing !== null}
                    dragLabel={t('channels_config.drag_to_reorder', 'Drag to reorder')}
                  >
                    <ConfigItemCard
                      testId="channel-card"
                      leading={t('channels_config.slot', { slot: hasReorderChanges ? displaySlot : slotId })}
                      title={
                        <>
                          {channel.name || <span className={styles.unnamed}>{t('channels_config.unnamed')}</span>}
                          <AeadBadge useAead={channel.useAead} />
                        </>
                      }
                      chips={chipsFor(channel, slotId, displaySlot)}
                      highlighted={hasReorderChanges ? displaySlot === 0 : channel.role === 1}
                      notice={collisions && (
                        <span title={t('channels_config.collision_tooltip', 'This channel shares its encryption key with a Channel Database (server-side decryption) entry under a different name, so its messages are filed under that entry instead.')}>
                          <UiIcon name="alert" size={12} /> {t('channels_config.collision_warning', {
                            defaultValue: 'Key shared with Channel Database entry "{{names}}" — messages may appear under that name instead of here.',
                            names: collisions.join('", "'),
                          })}
                        </span>
                      )}
                      expanded={isEditing}
                      disabled={!canWrite}
                      editDisabled={hasReorderChanges}
                      editTitle={reorderBlockReason}
                      onEdit={() => discard.guard(() => openEditor(slotId, false))}
                      onDelete={slotId > 0 && !hasReorderChanges ? () => { void handleDeleteChannel(slotId); } : undefined}
                      deleteTitle={t('channels_config.delete_title', 'Delete channel {{slot}}?', { slot: slotId })}
                      deleteMessage={t(
                        'channels_config.delete_message',
                        'This disables the channel on the device and permanently deletes its message history in MeshMonitor. The messages cannot be recovered.',
                      )}
                      deletePreview={channel.name || t('channels_config.unnamed')}
                      deleteConfirmLabel={t('channels_config.delete_confirm', 'Delete channel and messages')}
                      actions={
                        <>
                          <ConfigItemCardButton onClick={() => { void handleExportChannel(slotId); }} disabled={!canWrite}>
                            <UiIcon name="download" size={14} /> {t('common.export')}
                          </ConfigItemCardButton>
                          <ConfigItemCardButton
                            onClick={() => discard.guard(() => { setEditing(null); handleImportClick(slotId); })}
                            disabled={!canWrite || hasReorderChanges}
                            title={reorderBlockReason}
                          >
                            <UiIcon name="upload" size={14} /> {t('common.import')}
                          </ConfigItemCardButton>
                        </>
                      }
                      footer={isEditing && editing ? renderFooter(editing) : undefined}
                    >
                      {isEditing && editing && renderEditor(editing)}
                    </ConfigItemCard>
                  </SortableChannelCard>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragId !== null && (() => {
              const ch = channelBySlot.get(activeDragId);
              return (
                <div className={styles.dragPreview}>
                  {ch?.name || t('channels_config.unnamed')}
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>

        {editing?.isNew && (
          <ConfigItemCard
            testId="channel-card-new"
            leading={t('channels_config.slot', { slot: editing.slotId })}
            title={t('channels_config.new_channel', 'New channel')}
            expanded
            footer={renderFooter(editing)}
          >
            {renderEditor(editing)}
          </ConfigItemCard>
        )}

        <div className={styles.addBar}>
          <ConfigItemCardButton
            onClick={() => {
              if (nextFreeSlot !== null) discard.guard(() => openEditor(nextFreeSlot, true));
            }}
            disabled={!canWrite || nextFreeSlot === null || hasReorderChanges || !!editing?.isNew}
            title={nextFreeSlot === null
              ? t('channels_config.add_channel_full', 'All 8 channel slots are in use. Delete a channel to free a slot.')
              : reorderBlockReason}
            data-testid="channel-add"
          >
            <UiIcon name="plus" size={14} />
            {nextFreeSlot === null
              ? t('channels_config.add_channel', 'Add channel')
              : t('channels_config.add_channel_slot', 'Add channel (slot {{slot}})', { slot: nextFreeSlot })}
          </ConfigItemCardButton>
          {nextFreeSlot !== null && (
            <ConfigItemCardButton
              onClick={() => discard.guard(() => { setEditing(null); handleImportClick(nextFreeSlot); })}
              disabled={!canWrite || hasReorderChanges}
              title={reorderBlockReason}
            >
              <UiIcon name="upload" size={14} />
              {t('channels_config.import_to_slot', 'Import to slot {{slot}}', { slot: nextFreeSlot })}
            </ConfigItemCardButton>
          )}
          {nextFreeSlot === null && (
            <span className={styles.addReason}>
              {t('channels_config.add_channel_full', 'All 8 channel slots are in use. Delete a channel to free a slot.')}
            </span>
          )}
        </div>
      </ConfigSection>

      <DiscardChangesDialog guard={discard} />

      {confirmAead && (
        <ConfirmDialog
          title={t('channels_config.aead_confirm_title')}
          message={<><strong>{t('channels_config.aead_warning_title')}</strong> {t('channels_config.aead_warning_body')}</>}
          confirmLabel={t('channels_config.aead_confirm')}
          cancelLabel={t('common.cancel', 'Cancel')}
          onConfirm={() => { updateDraft({ useAead: true }); setConfirmAead(false); }}
          onCancel={() => setConfirmAead(false)}
        />
      )}

      <Modal
        isOpen={showImportModal}
        onClose={() => { if (!isImporting) setShowImportModal(false); }}
        title={t('channels_config.import_channel', { slot: importSlotId })}
      >
        <div className="setting-item">
          <label htmlFor="import-file">
            {t('channels_config.select_file')}
            <span className="setting-description">{t('channels_config.select_file_description')}</span>
          </label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />
        </div>

        {importFileContent && (
          <div className={styles.previewBlock}>
            <label>{t('channels_config.preview')}:</label>
            <pre className={styles.preview}>{importFileContent}</pre>
          </div>
        )}

        <div className={styles.modalActions}>
          <ConfigItemCardButton
            variant="primary"
            onClick={() => { void handleImportChannel(); }}
            disabled={isImporting || !importFileContent}
          >
            {isImporting ? t('channels_config.importing') : t('channels_config.import_channel_button')}
          </ConfigItemCardButton>
          <ConfigItemCardButton onClick={() => setShowImportModal(false)} disabled={isImporting}>
            {t('common.cancel')}
          </ConfigItemCardButton>
        </div>
      </Modal>
    </>
  );
};

export default ChannelsConfigSection;
