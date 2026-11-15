/**
 * The Athens cast for Overview › Telemetry (boards 7-03, 7-04, 7-07): today's
 * `/api/unified/telemetry/series` (favorited series, one line per source) and
 * `/api/unified/telemetry` (the latest reading per node per source) replies.
 */
import { SOURCE_IDS as S } from './athens';
import type { CombinedSeries, CombinedSeriesLine } from '../../components/CombinedTelemetryChart/CombinedTelemetryChart';
import type { TelemetryEntry } from '../../components/unifiedTelemetry/useUnifiedTelemetryLatest';

const NOW = Date.now();
const NAME: Record<string, string> = {
  [S.g2]: 'Station G2', [S.heltec]: 'Heltec MeshCore', [S.rak]: 'Rooftop RAK', [S.mqtt]: 'Athens MQTT',
};

/** 24 hourly points along `shape` (0…1 at each hour), scaled to [lo, hi]. */
function points(lo: number, hi: number, shape: (h: number) => number) {
  return Array.from({ length: 25 }, (_, i) => ({ timestamp: NOW - (24 - i) * 3_600_000, value: lo + (hi - lo) * shape(i) }));
}
const wave = (phase: number) => (h: number) => 0.5 + 0.5 * Math.sin((h + phase) / 4);

function line(sourceId: string, pts: CombinedSeriesLine['points'], unit: string | null): CombinedSeriesLine {
  return { sourceId, sourceName: NAME[sourceId], unit, favorited: true, canEditFavorite: true, points: pts };
}

function series(
  subjectKey: string, nodeName: string, type: string, category: string, lines: CombinedSeriesLine[], observerRelative = false,
): CombinedSeries {
  return { subjectKey, nodeName, type, favoriteType: type, category, observerRelative, lines };
}

export const telemetrySeries: CombinedSeries[] = [
  // Objective with two sources: one merged line until Split by source.
  series('!a1b2c301', 'Kifisia Rooftop', 'batteryLevel', 'power', [
    line(S.g2, points(84, 97, wave(0)), '%'),
    line(S.mqtt, points(84, 97, wave(0)).filter((_, i) => i % 3 === 0), '%'),
  ]),
  series('!a1b2c304', 'Piraeus Base', 'voltage', 'power', [
    line(S.rak, points(3.86, 4.05, wave(2)), 'V'),
    line(S.g2, points(3.84, 4.04, wave(2)), 'V'),
  ]),
  series('!a1b2c301', 'Kifisia Rooftop', 'temperature', 'environment', [
    line(S.g2, points(8, 30, wave(5)), '°C'),
    line(S.mqtt, points(8, 30, wave(5)).filter((_, i) => i % 2 === 0), '°C'),
  ]),
  series('!a1b2c303', 'Glyfada Beach', 'humidity', 'environment', [line(S.mqtt, points(48, 74, wave(7)), '%')]),
];

const ago = (min: number) => NOW - min * 60_000;

function reading(
  sourceId: string, nodeNum: number, longName: string, telemetryType: string, value: number, minAgo: number, favorited = false,
): TelemetryEntry {
  return {
    nodeId: `!${nodeNum.toString(16).padStart(8, '0')}`, nodeNum, telemetryType, value, timestamp: ago(minAgo),
    sourceId, sourceName: NAME[sourceId], nodeLongName: longName, favorited, canEditFavorite: true,
  };
}

export const telemetryLatest: TelemetryEntry[] = [
  reading(S.g2, 0xa1b2c301, 'Kifisia Rooftop', 'batteryLevel', 87, 4, true),
  reading(S.g2, 0xa1b2c301, 'Kifisia Rooftop', 'voltage', 4.02, 4),
  reading(S.g2, 0xa1b2c301, 'Kifisia Rooftop', 'channelUtilization', 12, 4, true),
  reading(S.g2, 0xa1b2c301, 'Kifisia Rooftop', 'temperature', 14, 4),
  reading(S.g2, 0xa1b2c306, 'Hymettus Relay', 'batteryLevel', 100, 6),
  reading(S.g2, 0xa1b2c306, 'Hymettus Relay', 'voltage', 4.19, 6),
  reading(S.g2, 0xa1b2c306, 'Hymettus Relay', 'airUtilTx', 3.4, 6),
  reading(S.g2, 0xa1b2c302, 'Athens Rover', 'batteryLevel', 64, 2),
  reading(S.g2, 0xa1b2c302, 'Athens Rover', 'uptimeSeconds', 183_600, 2),
  reading(S.g2, 0xa1b2c308, 'Kifisia Weather', 'temperature', 21, 11, true),
  reading(S.g2, 0xa1b2c308, 'Kifisia Weather', 'humidity', 48, 11),
  reading(S.g2, 0xa1b2c308, 'Kifisia Weather', 'pressure', 1012, 11),
  reading(S.heltec, 0xa1b2c305, 'Marousi Mobile', 'voltage', 3.91, 3),
  reading(S.heltec, 0xa1b2c305, 'Marousi Mobile', 'mc_status_noise_floor', -112, 3),
  reading(S.heltec, 0xa1b2c303, 'Glyfada Beach', 'voltage', 4.08, 9, true),
  reading(S.heltec, 0xa1b2c303, 'Glyfada Beach', 'temperature', 22, 9),
  reading(S.rak, 0xa1b2c304, 'Piraeus Base', 'batteryLevel', 58, 22),
  reading(S.rak, 0xa1b2c304, 'Piraeus Base', 'voltage', 3.86, 22, true),
  reading(S.rak, 0xa1b2c307, 'Lycabettus Repeater', 'batteryLevel', 100, 5),
  reading(S.rak, 0xa1b2c307, 'Lycabettus Repeater', 'channelUtilization', 9, 5),
  reading(S.mqtt, 0xa1b2c303, 'Glyfada Beach', 'humidity', 66, 7),
  reading(S.mqtt, 0xa1b2c303, 'Glyfada Beach', 'batteryLevel', 71, 7),
];
