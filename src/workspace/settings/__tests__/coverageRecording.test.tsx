/**
 * @vitest-environment jsdom
 *
 * In MeshMonitor › Coverage recording (s12n4, Task 5.8): Athens MQTT's one
 * switch. Turning it on asks first with today's row-count warning and writes
 * nothing until confirmed; turning it off saves at once. Scoped to the source.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { mqtt, renderSettings } from './renderSettings';
import { meshmonitorFixtures } from './meshmonitorFixtures';
import { posted } from './settingsPosts';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const T = { timeout: 10_000 };

describe('Coverage recording', () => {
  it('asks first with today\'s row-count warning, then saves to the source', async () => {
    renderSettings(`${mqtt}/settings/coverage-recording`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('switch', { name: 'Record MQTT gateway receptions for the Coverage Report' }, T));
    const sheet = await screen.findByRole('dialog', { name: 'Turn on coverage recording?' });
    expect(within(sheet).getByText(/A regional feed adds about 12,000–14,000 rows a day/)).toBeInTheDocument();
    await act(async () => {});
    expect(posted()).toEqual([]);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Turn on recording' }));
    await waitFor(() => expect(posted()).toEqual([{ path: '/api/settings', sourceId: SOURCE_IDS.mqtt, body: { coverage_mqtt_enabled: '1' } }]));
  });

  it('Cancel writes nothing', async () => {
    renderSettings(`${mqtt}/settings/coverage-recording`, { fixtures: meshmonitorFixtures() });
    fireEvent.click(await screen.findByRole('switch', { name: 'Record MQTT gateway receptions for the Coverage Report' }, T));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posted()).toEqual([]);
    expect(screen.getByRole('switch', { name: 'Record MQTT gateway receptions for the Coverage Report' })).not.toBeChecked();
  });
});
