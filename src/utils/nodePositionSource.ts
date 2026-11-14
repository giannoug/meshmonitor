/**
 * Where a node's displayed lat/lon came from (#4432), and its error bar:
 * override, then a real GPS fix, then a trilaterated estimate, matching
 * enhanceNodeForClient. Moved unchanged out of NodeDetailsBlock (#6365) so the
 * Workspace node page's Position tab says the same.
 */
import type { TFunction } from 'i18next';
import type { DeviceInfo } from '../types/device.js';
import { formatLocationSource } from './nodeHelpers.js';
import { formatUncertaintyRadius, precisionBitsToAccuracyMeters } from './distance.js';
import { hasAccuracyCell } from './precisionOffset.js';

export interface NodePositionSource {
  kind: 'override' | 'estimated' | 'gps';
  label: string;
  tooltip: string;
  accuracy: string | null;
  /**
   * True only when the position is known to carry no error bar — NOT merely
   * when `accuracy` is null (#4498).
   *
   * `hasAccuracyCell` is false for three different reasons: full precision
   * (bits >= 32), an override, and unset/zero precision bits. The first two
   * are genuinely exact; the third means the device never told us how precise
   * the fix was. Labelling all three "Exact" would assert something we don't
   * know, so the unknown case still renders nothing.
   */
  exact: boolean;
}

export function nodePositionSource(node: DeviceInfo, t: TFunction, distanceUnit: 'km' | 'mi'): NodePositionSource {
  return node.positionIsOverride
    ? {
        kind: 'override',
        label: t('node_details.position_source_override', 'Override'),
        tooltip: t(
          'node_details.position_source_override_tooltip',
          'Manually set position. Not reported by the device.',
        ),
        // A user placed this pin exactly where they meant it — no error bar.
        accuracy: null,
        exact: true,
      }
    : node.positionIsEstimated
      ? {
          kind: 'estimated',
          label: t('node_details.position_source_estimated', 'Estimated'),
          tooltip: t(
            'node_details.position_source_estimated_tooltip',
            'Estimated from traceroute and neighbor observations. This node has never reported a GPS position.',
          ),
          accuracy: formatUncertaintyRadius(
            node.positionEstimateUncertaintyKm != null
              ? node.positionEstimateUncertaintyKm * 1000
              : null,
            distanceUnit,
          ),
          exact: false,
        }
      : {
          kind: 'gps',
          // Name the actual source when the device reported one (#4498). The
          // protobuf's LocSource has been decoded and stored since #4176, but
          // PR #4188 wired it only into the map popups — this card kept showing
          // a generic "GPS" for a manually-entered fix as readily as an
          // internal one. formatLocationSource returns null for LOC_UNSET or an
          // absent value, so nodes that never reported a source keep the exact
          // pre-#4498 wording.
          label:
            formatLocationSource(node.positionLocationSource) ??
            t('node_details.position_source_gps', 'GPS'),
          tooltip:
            formatLocationSource(node.positionLocationSource) !== null
              ? t(
                  'node_details.position_source_gps_tooltip_sourced',
                  'Position reported by the device ({{source}}).',
                  { source: formatLocationSource(node.positionLocationSource) },
                )
              : t(
                  'node_details.position_source_gps_tooltip',
                  'Position reported by the device.',
                ),
          // Only imprecise fixes (1..31 bits) have a meaningful error bar; full
          // precision and unset both fall through to no radius. hasAccuracyCell
          // is the same gate the map uses to draw its accuracy square.
          accuracy:
            node.positionPrecisionBits != null &&
            hasAccuracyCell(node.positionPrecisionBits, node.positionIsOverride)
              ? formatUncertaintyRadius(
                  precisionBitsToAccuracyMeters(node.positionPrecisionBits),
                  distanceUnit,
                )
              : null,
          // >= 32 bits is a full-precision fix. null/0 means the device didn't
          // report precision at all — unknown, not exact.
          exact: node.positionPrecisionBits != null && node.positionPrecisionBits >= 32,
        };
}
