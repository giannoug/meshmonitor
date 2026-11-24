/**
 * @vitest-environment jsdom
 *
 * Task 9.2 (s17n2): a telemetry chart's ⋯ "Clean outliers…" on the node page
 * opens the Workspace's outlier sheet (17-07) for that node and metric. The
 * charts are today's TelemetryGraphs, which take the sheet in place of today's
 * dialog; its own suite covers the menu item and its admin gate.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import OutlierCleanupPage from '../OutlierCleanupPage';
import TelemetryTab from '../../node-page/TelemetryTab';

const chartProps = vi.hoisted(() => [] as Array<{ OutlierDialog?: unknown }>);
vi.mock('../../../components/TelemetryGraphs', () => ({
  default: (props: { OutlierDialog?: unknown }) => {
    chartProps.push(props);
    return <p>charts</p>;
  },
}));
vi.mock('../../../components/SmartHopsGraphs', () => ({ default: () => null }));
vi.mock('../../../components/LinkQualityGraph', () => ({ default: () => null }));
vi.mock('../../../contexts/SettingsContext', async (orig) => ({
  ...(await orig<object>()),
  useSettings: () => ({ temperatureUnit: 'C', telemetryVisualizationHours: 24 }),
}));

describe('outlier cleanup from a telemetry chart', () => {
  it('the node page\'s Telemetry tab hands its charts the Workspace sheet', async () => {
    renderWorkspace(<TelemetryTab sourceId={SOURCE_IDS.g2} node={{ nodeNum: 1, user: { id: '!00000001' } } as never} />, {
      fixtures: { 'GET /api/packets/stats/distribution': () => ({ enabled: false }) },
    });
    await screen.findByText('charts', {}, { timeout: 10_000 });
    expect(chartProps.at(-1)?.OutlierDialog).toBe(OutlierCleanupPage);
  });
});
