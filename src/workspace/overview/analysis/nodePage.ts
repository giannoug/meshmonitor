import type { SelectedTarget } from '../../../components/MapAnalysis/MapAnalysisContext';

/**
 * The inspector's "Open node page" target: the selected node's (or trail's)
 * Workspace node page on its device for Meshtastic, the device for a MeshCore
 * `mc:` key (as 4.1's popup row). Null when the selection is not one node on
 * one device.
 */
export function nodePageOf(selected: SelectedTarget | null): string | null {
  if (!selected || (selected.type !== 'node' && selected.type !== 'trail') || !selected.sourceId) return null;
  const base = `/source/${encodeURIComponent(selected.sourceId)}`;
  if (selected.nodeKey?.startsWith('mc:')) return base;
  if (selected.nodeNum === undefined) return null;
  return `${base}/node/${encodeURIComponent(`!${(selected.nodeNum >>> 0).toString(16).padStart(8, '0')}`)}`;
}
