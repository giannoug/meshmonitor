/**
 * The signed-in user's own Dashboard board (D12, spec §7.6): which widgets,
 * their order among the starred charts, and which health tiles show, stored in
 * the user preference `dashboard.<sourceId>` (or `dashboard.overview`) as
 * `{ widgets, order, tiles? }`.
 *
 * Until the user first edits, the board is seeded from today's install-wide
 * `dashboardWidgets` / `telemetryCustomOrder` for that source, read through the
 * same query as the Dashboard's own settings read (no extra request), and
 * nothing is written. Those install-wide keys are never written here: Classic
 * keeps its board. Stars stay install-wide (`telemetryFavorites`, D19).
 */
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardQueryKeys, fetchDashboardSettings, type DashboardSettings } from '../../components/Dashboard/hooks/useDashboardData';
import type { CustomWidget, FavoriteChart } from '../../components/Dashboard/types';
import { useUserPreferences } from '../prefs/useUserPreferences';
import type { HealthTileId } from './healthTiles';

export interface UserBoardValue {
  widgets: CustomWidget[];
  /** Widget ids and chart keys (`<nodeId>-<telemetryType>`), top to bottom. */
  order: string[];
  /** The health tiles shown; absent: the default six. */
  tiles?: HealthTileId[];
}

export interface UserBoard extends UserBoardValue {
  /** The settings read the seed comes from has landed (always, for the Overview). */
  ready: boolean;
  setWidgets(widgets: CustomWidget[]): Promise<void>;
  setOrder(order: string[]): Promise<void>;
  /** The whole board in one write (edit mode's Done). */
  setBoard(board: UserBoardValue): Promise<void>;
}

export const chartKey = (f: FavoriteChart) => `${f.nodeId}-${f.telemetryType}`;

function isBoard(v: unknown): v is UserBoardValue {
  const b = v as UserBoardValue | null;
  return !!b && Array.isArray(b.widgets) && Array.isArray(b.order) && (b.tiles === undefined || Array.isArray(b.tiles));
}

/** Today's board as Classic draws it: the widgets, then the charts in their custom order. */
export function seedBoard(settings: DashboardSettings | undefined): UserBoardValue {
  const widgets = settings?.widgets ?? [];
  return { widgets, order: [...widgets.map((w) => w.id), ...(settings?.customOrder ?? [])] };
}

export function useUserBoard(id: string): UserBoard {
  const key = `dashboard.${id}`;
  const { prefs, setPref } = useUserPreferences();
  const overview = id === 'overview';
  const seed = useQuery({
    queryKey: dashboardQueryKeys.settings(id),
    queryFn: () => fetchDashboardSettings(id),
    enabled: !overview,
    staleTime: 10 * 1000,
  });
  const saved = prefs[key];
  const board = useMemo(() => (isBoard(saved) ? saved : seedBoard(seed.data)), [saved, seed.data]);

  const setBoard = useCallback((next: UserBoardValue) => setPref(key, next), [setPref, key]);
  const setWidgets = useCallback((widgets: CustomWidget[]) => setBoard({ ...board, widgets }), [setBoard, board]);
  const setOrder = useCallback((order: string[]) => setBoard({ ...board, order }), [setBoard, board]);

  return { ...board, ready: overview || seed.isSuccess || isBoard(saved), setWidgets, setOrder, setBoard };
}

export type BoardItem =
  | { key: string; kind: 'widget'; widget: CustomWidget }
  | { key: string; kind: 'chart'; favorite: FavoriteChart };

/**
 * The board's items in its order: every widget and every starred chart. One
 * not in `order` (a chart starred since) follows the rest, widgets before charts.
 */
export function boardItems(widgets: CustomWidget[], favorites: FavoriteChart[], order: string[]): BoardItem[] {
  const items: BoardItem[] = [
    ...widgets.map((widget): BoardItem => ({ key: widget.id, kind: 'widget', widget })),
    ...favorites.map((favorite): BoardItem => ({ key: chartKey(favorite), kind: 'chart', favorite })),
  ];
  const rank = new Map(order.map((k, i) => [k, i]));
  const at = (item: BoardItem, i: number) => rank.get(item.key) ?? order.length + i;
  return items
    .map((item, i) => ({ item, r: at(item, i) }))
    .sort((a, b) => a.r - b.r)
    .map(({ item }) => item);
}
