/**
 * Edit mode's parts (boards j2, k2, k3): the board as rows, top to bottom,
 * each with a drag handle (dnd-kit, as today's grid), ↑/↓ and remove; the
 * Add widget sheet (today's AddWidgetModal types for the device, its
 * `supported` set); the Health tiles sheet. Everything here changes the
 * draft only: Done in DeviceDashboard saves it.
 */
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { UiIcon } from '../../components/icons';
import { WIDGET_OPTIONS, type WidgetType } from '../../components/widgetOptions';
import Sheet from '../patterns/Sheet';
import { useIsPhone } from '../shell/useIsPhone';
import { HEALTH_TILES, tileTitle, type HealthTileId } from './healthTiles';
import type { BoardItem } from './useUserBoard';
import styles from './Dashboard.module.css';

export interface ItemLabel {
  title: string;
  sub?: string;
}

export interface EditRowsProps {
  items: BoardItem[];
  label: (item: BoardItem) => ItemLabel;
  onChange(items: BoardItem[]): void;
}

/** The board's rows with drag, ↑/↓ and remove. */
export function EditRows({ items, label, onChange }: EditRowsProps) {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(items.findIndex((i) => i.key === active.id), items.findIndex((i) => i.key === over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        <ul className={styles.rows} aria-label={t('workspace.dashboard.your_board_list')}>
          {items.map((item, i) => (
            <EditRow
              key={item.key}
              item={item}
              label={label(item)}
              first={i === 0}
              last={i === items.length - 1}
              onMove={(d) => move(i, i + d)}
              onRemove={() => onChange(items.filter((x) => x.key !== item.key))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface EditRowProps {
  item: BoardItem;
  label: ItemLabel;
  first: boolean;
  last: boolean;
  onMove(delta: -1 | 1): void;
  onRemove(): void;
}

function EditRow({ item, label, first, last, onMove, onRemove }: EditRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const name = label.title;
  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" ref={setActivatorNodeRef} className={styles.handle} aria-label={t('workspace.dashboard.drag', { name })} {...attributes} {...listeners}>
        <UiIcon name="dragHandle" size={20} />
      </button>
      <span className={styles.rowText}>
        <span className={styles.rowTitle} data-testid="row-title">{name}</span>
        {label.sub && <span className={styles.rowSub}>{label.sub}</span>}
      </span>
      <button type="button" className={styles.iconButton} aria-label={t('workspace.devices.move_up', { name })} disabled={first} onClick={() => onMove(-1)}>
        <UiIcon name="chevronUp" size={20} />
      </button>
      <button type="button" className={styles.iconButton} aria-label={t('workspace.devices.move_down', { name })} disabled={last} onClick={() => onMove(1)}>
        <UiIcon name="chevronDown" size={20} />
      </button>
      <button type="button" className={styles.iconButton} aria-label={t('workspace.dashboard.remove_named', { name })} onClick={onRemove}>
        <UiIcon name="close" size={20} />
      </button>
    </li>
  );
}

export interface AddWidgetSheetProps {
  open: boolean;
  onClose(): void;
  /** The device's widget types (its data source's `widgets.supported`). */
  supported: ReadonlySet<WidgetType>;
  onAdd(type: WidgetType): void;
}

/**
 * Add widget (k3, j2's panel): a telemetry chart is a star on a node page, so
 * its row explains how, as today's modal's help does; each widget type adds
 * one and closes the sheet, as today.
 */
export function AddWidgetSheet({ open, onClose, supported, onAdd }: AddWidgetSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const [help, setHelp] = useState(false);
  const close = () => {
    setHelp(false);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('dashboard.add_widget_title')}
      footer={!isPhone && <p className={styles.note}>{t('workspace.dashboard.offered_note')}</p>}
    >
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        {help ? (
          <>
            <ol className={styles.steps}>
              <li>{t('workspace.dashboard.chart_help.step1')}</li>
              <li>{t('workspace.dashboard.chart_help.step2')}</li>
              <li>{t('workspace.dashboard.chart_help.step3')}</li>
            </ol>
            <button type="button" className={styles.button} onClick={() => setHelp(false)}>
              {t('dashboard.telemetry_help.back')}
            </button>
          </>
        ) : (
          <ul className={styles.options}>
            <li>
              <button type="button" className={styles.option} onClick={() => setHelp(true)}>
                <span className={styles.optionIcon}><UiIcon name="telemetry" size={22} /></span>
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>{t('workspace.dashboard.chart_title')}</span>
                  <span className={styles.optionDesc}>{t('workspace.dashboard.chart_description')}</span>
                </span>
                <UiIcon name="chevronRight" size={20} />
              </button>
            </li>
            {WIDGET_OPTIONS.filter((o) => supported.has(o.type)).map((o) => {
              const title = t(o.titleKey);
              return (
                <li key={o.type}>
                  <button
                    type="button"
                    className={styles.option}
                    aria-label={t('workspace.dashboard.add_named', { name: title })}
                    onClick={() => {
                      onAdd(o.type);
                      close();
                    }}
                  >
                    <span className={styles.optionIcon}><UiIcon name={o.icon} size={22} /></span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{title}</span>
                      <span className={styles.optionDesc}>{t(o.descriptionKey)}</span>
                    </span>
                    <span className={styles.optionAdd}><UiIcon name="plus" size={22} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

export interface TilesSheetProps {
  open: boolean;
  onClose(): void;
  tiles: HealthTileId[];
  onChange(tiles: HealthTileId[]): void;
}

/** Health tiles (j2 Choose tiles, k2's row): which of the nine show, in the strip's order. */
export function TilesSheet({ open, onClose, tiles, onChange }: TilesSheetProps) {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  const toggle = (id: HealthTileId) =>
    onChange(HEALTH_TILES.filter((x) => (x === id ? !tiles.includes(id) : tiles.includes(x))));
  return (
    <Sheet open={open} onClose={onClose} title={t('workspace.dashboard.health_tiles')}>
      <div className={styles.sheetBody} data-phone={isPhone || undefined}>
        {HEALTH_TILES.map((id) => (
          <label key={id} className={styles.check}>
            <input type="checkbox" checked={tiles.includes(id)} onChange={() => toggle(id)} />
            {tileTitle(t, id)}
          </label>
        ))}
      </div>
    </Sheet>
  );
}
