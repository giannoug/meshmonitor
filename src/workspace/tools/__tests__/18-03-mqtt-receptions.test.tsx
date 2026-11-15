/**
 * @vitest-environment jsdom
 *
 * Board 18-03-mqtt-receptions (desktop, s18n2): an MQTT device's packet
 * monitor lists one row per packet with its gateway count; the count opens
 * Packet Detail with one row per gateway that heard it (Gateway, Rx time,
 * Hops, SNR, RSSI, Outcome, ok_to_mqtt). Filters, Capture settings, Clear
 * (asks first) and the off banner are today's.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { mqttPackets } from '../../__fixtures__/packets';
import { renderReceptions } from './renderReceptions';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const fetched = () => vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => `${init?.method ?? 'GET'} ${String(u)}`);
const bodyOf = (method: string, path: string) =>
  vi.mocked(globalThis.fetch).mock.calls
    .filter(([u, init]) => (init?.method ?? 'GET') === method && String(u).includes(path))
    .map(([, init]) => JSON.parse(String(init?.body ?? '{}')));

async function row(text: string): Promise<HTMLElement> {
  const [cell] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return cell.closest<HTMLElement>('tr')!;
}

async function openDetail() {
  fireEvent.click(within(await row('Marousi Mobile')).getByRole('button', { name: /4 Receptions/ }));
  return screen.findByRole('complementary', { name: 'Packet Detail' });
}

describe('18-03-mqtt-receptions', () => {
  it('18-03-mqtt-receptions shows the board', async () => {
    renderReceptions();
    await row('Marousi Mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const gateways = await screen.findByRole('group', { name: 'Gateways' });
    fireEvent.click(within(gateways).getByRole('button', { name: 'Select all' }));
    fireEvent.click(within(gateways).getByRole('checkbox', { name: /Glyfada Beach/ }));
    expect(gateways).toHaveTextContent('5 of 6');
    const panel = await openDetail();
    await within(panel).findByText('Kifisia Rooftop');
    expectBoard('18-03-mqtt-receptions', document.body);
  });

  it('Packet Detail lists each gateway that heard the packet', async () => {
    renderReceptions();
    const panel = await openDetail();
    await within(panel).findByText('Kifisia Rooftop');
    const rows = within(within(panel).getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent(/^!0badc0de[\d:.]+2-3 dB-95ingestedviolation$/);
    expect(rows[2]).toHaveTextContent(/^Kifisia Rooftop.*opted out$/);
    expect(rows[3]).toHaveTextContent(/^Piraeus Base[\d:.]+3——ingestedunknown$/);
    expect(panel).toHaveTextContent('Per-gateway receptions · 4');
    expect(panel).toHaveTextContent('At least one gateway relayed this packet to MQTT');
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary', { name: 'Packet Detail' })).toBeNull();
  });

  it('Stop capturing turns MQTT capture off; it sends nothing on the mesh', async () => {
    renderReceptions({ fixtures: { 'POST /api/settings': () => ({ success: true }) } });
    await row('Marousi Mobile');
    expect(screen.getByText(/Sends nothing on the mesh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop capturing' }));
    expect(await screen.findByRole('button', { name: 'Start capturing' })).toBeInTheDocument();
    expect(bodyOf('POST', '/api/settings')).toEqual([{ mqtt_packet_log_enabled: '0' }]);
  });

  it('Clear asks with today\'s words, then clears the log', async () => {
    renderReceptions({ fixtures: { [`DELETE /api/sources/:id/mqtt/packets`]: () => ({ success: true, data: { deleted: 6 } }) } });
    await row('Marousi Mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const sheet = await screen.findByRole('dialog', { name: 'Clear' });
    expect(sheet).toHaveTextContent('Clear the captured MQTT packet log for this source?');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(fetched().some((u) => u.startsWith(`DELETE /api/sources/${S.mqtt}/mqtt/packets`))).toBe(true));
  });

  it('a gateway chip asks for that gateway\'s receptions only', async () => {
    renderReceptions();
    await row('Marousi Mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const gateways = await screen.findByRole('group', { name: 'Gateways' });
    fireEvent.click(await within(gateways).findByRole('checkbox', { name: /Kifisia Rooftop/ }));
    await waitFor(() => expect(fetched().some((u) => u.includes('/mqtt/packets?gateways=%21a1b2c301'))).toBe(true));
    expect(screen.getByText('Gateway counts reflect the selected gateways only.')).toBeInTheDocument();
  });

  it('Filters hold today\'s capture settings for settings:write', async () => {
    renderReceptions();
    await row('Marousi Mobile');
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('checkbox', { name: 'Capture enabled' })).toBeChecked();
    expect(screen.getByLabelText('Max count')).toHaveValue(5000);
    expect(screen.getByLabelText('Max age (h)')).toHaveValue(24);
  });

  it('with capture off shows today\'s banner and Enable capture', async () => {
    renderReceptions({
      fixtures: {
        'GET /api/sources/:id/mqtt/packets': () => ({ success: true, data: { packets: mqttPackets, total: 6, enabled: false, maxCount: 5000, maxAgeHours: 24 } }),
      },
    });
    expect(await screen.findByText(/MQTT packet capture is off/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable capture' })).toBeInTheDocument();
  });

  it('without packetmonitor:read on the device shows no packets and asks for none', async () => {
    renderReceptions({ permissions: { global: {}, bySource: { [S.mqtt]: { messages: { read: true, write: false } } } } });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    expect(fetched().some((u) => u.includes('/mqtt/packets'))).toBe(false);
  });
});
