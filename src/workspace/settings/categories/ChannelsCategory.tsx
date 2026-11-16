/**
 * Channels (boards 12-01 desktop, 12-14 phone): the device's eight slots, and
 * the category's deeper pages by URL: `channels/<slot>` (ChannelEditPage) and
 * `channels/share` (ShareImportPage), so Back and deep links work.
 *
 * The list keeps today's ChannelsConfigSection logic (channelSlots.ts): the
 * chips, the Channel Database collision warning (#3644), Add channel on the
 * next free slot (off with today's text when all 8 are used), Import to slot N
 * (today's channel JSON import), and reordering. Reorder mode takes the save
 * dock (the radio bar yields): drag a handle, or use the move buttons, then
 * Apply Order (one reorder write; the node reboots) or Cancel.
 */
import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UiIcon } from '../../../components/icons';
import AeadBadge from '../../../components/channels/AeadBadge';
import { ChannelEncryptionLabel } from '../../../components/shared/config/ChannelEncryptionLabel';
import {
  ALL_SLOTS,
  autoPositionChannelId,
  channelEncryptionStatus,
  isConfigured,
  nextFreeSlot,
  useChannelBySlot,
  useChannelCollisions,
  useChannelReorder,
} from '../../../components/configuration/channelSlots';
import { useSettings } from '../../../contexts/SettingsContext';
import { useSource } from '../../../contexts/SourceContext';
import { usePoll } from '../../../hooks/usePoll';
import type { Channel } from '../../../types/device';
import { formatPrecisionAccuracy } from '../../../utils/distance';
import SendsLine from '../../patterns/SendsLine';
import StateView from '../../patterns/StateView';
import { useIsPhone } from '../../shell/useIsPhone';
import { useReadOnly } from '../kit/useFieldRegistry';
import { useSharedDeviceConfig } from '../sharedDeviceConfig';
import { useClaimDock, useSettingsHeader } from '../settingsDock';
import type { CategoryProps } from '../categories';
import ChannelEditPage from './ChannelEditPage';
import ImportJsonSheet from './ImportJsonSheet';
import ShareImportPage from './ShareImportPage';
import styles from './SettingsPages.module.css';
import bar from '../RadioSaveBar.module.css';

export default function ChannelsCategory({ sourceId, sub = '' }: CategoryProps) {
  const config = useSharedDeviceConfig();
  const { data, refetch } = usePoll();
  const base = `/source/${encodeURIComponent(sourceId)}/settings/channels`;
  if (!config || config.state.loading || !data) return <StateView kind="loading" />;
  const channels = data.channels ?? [];
  const refresh = () => void refetch();
  if (sub === 'share') return <ShareImportPage base={base} sourceId={sourceId} channels={channels} onImported={refresh} />;
  if (/^[0-7]$/.test(sub)) {
    return (
      <ChannelEditPage
        key={sub}
        base={base}
        sourceId={sourceId}
        slot={Number(sub)}
        channels={channels}
        aeadSupported={config.state.supportedModules?.aeadChannels === true}
        onChannelsUpdated={refresh}
      />
    );
  }
  if (sub) return <Navigate replace to={base} />;
  return <ChannelList base={base} sourceId={sourceId} channels={channels} onChannelsUpdated={refresh} />;
}

interface ListProps {
  base: string;
  sourceId: string;
  channels: Channel[];
  onChannelsUpdated(): void;
}

function ChannelList({ base, sourceId, channels, onChannelsUpdated }: ListProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const readOnly = useReadOnly();
  const { sourceName } = useSource();
  const { distanceUnit } = useSettings();
  const bySlot = useChannelBySlot(channels);
  const collisions = useChannelCollisions(sourceId, channels);
  const reorder = useChannelReorder(channels, sourceId, onChannelsUpdated);
  const [reordering, setReordering] = useState(false);
  const [importSlot, setImportSlot] = useState<number | null>(null);
  useClaimDock(reordering);
  useSettingsHeader({ scope: t('workspace.settings.channels.scope', { device: sourceName }) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = reorder.slotOrder.filter((slot) => isConfigured(bySlot.get(slot)));
  const free = ALL_SLOTS.filter((slot) => !isConfigured(bySlot.get(slot)));
  const next = nextFreeSlot(bySlot);
  const autoPosition = autoPositionChannelId(channels);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) reorder.move(Number(active.id), Number(over.id));
  };
  const finish = () => setReordering(false);

  const chips = (ch: Channel, displaySlot: number): ReactNode[] => {
    const primary = reorder.hasReorderChanges ? displaySlot === 0 : ch.role === 1;
    const precision = ch.positionPrecision ?? 0;
    return [
      <span key="role" className={styles.chip} data-tone={primary ? 'accent' : undefined}>
        {t(primary ? 'channels_config.role_primary' : 'channels_config.role_secondary')}
      </span>,
      <span key="key" className={styles.chip}>
        <ChannelEncryptionLabel status={channelEncryptionStatus(ch)} />
      </span>,
      ch.uplinkEnabled && <span key="up" className={styles.chip} data-tone="on">{t('channels_config.uplink')}</span>,
      ch.downlinkEnabled && <span key="down" className={styles.chip} data-tone="on">{t('channels_config.downlink')}</span>,
      precision > 0 && (
        <span key="pos" className={styles.chip}>
          {`${ch.id === autoPosition ? t('channels_config.location_auto_broadcast') : t('channels_config.location_enabled')} (${formatPrecisionAccuracy(precision, distanceUnit)})`}
        </span>
      ),
    ];
  };

  return (
    <>
      <div className={styles.toolbar}>
        {next !== null && !readOnly && !reordering ? (
          <Link to={`${base}/${next}`} className={`${styles.button} ${styles.primary}`}>
            <UiIcon name="plus" size={16} /> {t('channels_config.add_channel')}
          </Link>
        ) : (
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled>
            <UiIcon name="plus" size={16} /> {t('channels_config.add_channel')}
          </button>
        )}
        {next !== null && (
          <button type="button" className={styles.button} disabled={readOnly || reordering} onClick={() => setImportSlot(next)}>
            <UiIcon name="import" size={16} /> {t('channels_config.import_to_slot', { slot: next })}
          </button>
        )}
        <button type="button" className={styles.button} aria-pressed={reordering} disabled={readOnly || visible.length < 2} onClick={() => setReordering(true)}>
          <UiIcon name="sortAscending" size={16} /> {t('workspace.settings.channels.reorder')}
        </button>
        <Link to={`${base}/share`} className={styles.button}>
          <UiIcon name="link" size={16} /> {t('workspace.settings.channels.share_title')}
        </Link>
        <span className={styles.toolbarNote}>{t('workspace.settings.channels.slots_used', { count: ALL_SLOTS.length - free.length })}</span>
      </div>
      {next === null && <p className={styles.note}>{t('channels_config.add_channel_full')}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible} strategy={rectSortingStrategy}>
          <ul className={styles.slots} data-phone={isPhone || undefined}>
            {visible.map((slot, i) => {
              const ch = bySlot.get(slot)!;
              const displaySlot = reorder.slotOrder.indexOf(slot);
              const names = collisions.get(ch.id);
              const name = ch.name || t('channels_config.unnamed');
              return (
                <SlotCard key={slot} id={slot} reordering={reordering} dragLabel={`${t('channels_config.drag_to_reorder')} ${name}`}>
                  <div className={styles.slotMain}>
                    <span className={styles.slotHead}>
                      <span className={styles.slotNum}>{t('channels_config.slot', { slot: reordering ? displaySlot : slot })}</span>
                      <span className={styles.slotName}>{name}</span>
                      <AeadBadge useAead={ch.useAead} />
                    </span>
                    <span className={styles.chips}>{chips(ch, displaySlot)}</span>
                    {names && (
                      <span className={styles.collision} title={t('channels_config.collision_tooltip')}>
                        <UiIcon name="alert" size={14} />
                        <span>{t('channels_config.collision_warning', { names: names.join('", "') })}</span>
                      </span>
                    )}
                  </div>
                  {reordering ? (
                    <span className={styles.moves}>
                      <button type="button" className={styles.iconButton} aria-label={t('workspace.settings.channels.move_up', { name })} disabled={i === 0} onClick={() => reorder.move(slot, visible[i - 1])}>
                        <UiIcon name="chevronUp" size={18} />
                      </button>
                      <button type="button" className={styles.iconButton} aria-label={t('workspace.settings.channels.move_down', { name })} disabled={i === visible.length - 1} onClick={() => reorder.move(slot, visible[i + 1])}>
                        <UiIcon name="chevronDown" size={18} />
                      </button>
                    </span>
                  ) : (
                    <Link to={`${base}/${slot}`} className={styles.slotLink} aria-label={`${t('channels_config.slot', { slot })} ${name}`}>
                      <UiIcon name="chevronRight" size={18} />
                    </Link>
                  )}
                </SlotCard>
              );
            })}
            {free.length > 0 &&
              (isPhone ? (
                <li className={styles.freeSlot}>{t('workspace.settings.channels.free_slots', { slots: free.join(', ') })}</li>
              ) : (
                free.map((slot) => (
                  <li key={`free-${slot}`} className={styles.freeSlot}>
                    <span className={styles.slotNum}>{t('channels_config.slot', { slot })}</span> {t('workspace.settings.channels.free')}
                  </li>
                ))
              ))}
          </ul>
        </SortableContext>
      </DndContext>

      {reordering && (
        <>
          {isPhone && <div className={bar.spacer} aria-hidden="true" />}
          <section className={bar.bar} data-phone={isPhone || undefined} aria-label={t('workspace.settings.channels.reorder_mode')}>
            <div className={bar.row}>
              <UiIcon name="sortAscending" size={22} className={bar.icon} />
              <div className={bar.text}>
                <span className={bar.title}>
                  {t('workspace.settings.channels.reorder_mode')}
                  {' · '}
                  {reorder.hasReorderChanges ? t('channels_config.reorder_pending') : t('workspace.settings.channels.drag_hint')}
                </span>
                <span className={bar.sub}>{t('workspace.settings.channels.reorder_note', { device: sourceName })}</span>
              </div>
            </div>
            <SendsLine>{t('workspace.settings.savebar.sends_nothing')}</SendsLine>
            <div className={bar.buttons}>
              <button type="button" className={bar.secondary} disabled={reorder.isReordering} onClick={() => { reorder.cancel(); finish(); }}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={bar.save}
                data-restart=""
                disabled={!reorder.hasReorderChanges || reorder.isReordering}
                aria-busy={reorder.isReordering || undefined}
                onClick={() => void reorder.apply().then(finish)}
              >
                <UiIcon name="refresh" size={18} /> {reorder.isReordering ? t('common.saving') : t('channels_config.apply_order')}
              </button>
            </div>
          </section>
        </>
      )}

      <ImportJsonSheet slot={importSlot} sourceId={sourceId} onClose={() => setImportSlot(null)} onImported={onChannelsUpdated} />
    </>
  );
}

/** A slot's card; in reorder mode its handle drags it (dnd-kit, as today's list). */
function SlotCard({ id, reordering, dragLabel, children }: { id: number; reordering: boolean; dragLabel: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !reordering });
  return (
    <li
      ref={setNodeRef}
      className={styles.slot}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {reordering && (
        <button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={dragLabel} {...attributes} {...listeners}>
          <UiIcon name="dragHandle" size={20} />
        </button>
      )}
      {children}
    </li>
  );
}
