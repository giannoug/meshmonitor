/**
 * @vitest-environment jsdom
 *
 * Boards o2-info (desktop) and 16-01-info (phone; s16n0, s16n3): Station G2's
 * Info in groups, each opening its page with today's fields. Reads are
 * today's InfoTab's (useInfoTabData); the private key stays masked until
 * Show; Clear record asks first with today's words. Opening it sends nothing.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { fetched, G2, nonGets, renderTools } from './renderTools';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
// Today's charts draw with recharts (no layout in jsdom): their presence is enough here.
vi.mock('../../../components/TelemetryGraphs', () => ({ default: () => <div data-testid="telemetry-graphs" /> }));
vi.mock('../../../components/PacketRateGraphs', () => ({ default: () => <div data-testid="packet-rate-graphs" /> }));
vi.mock('../../../components/TransportSeriesGraphs', () => ({ default: () => <div data-testid="transport-series" /> }));

describe('o2-info', () => {
  it('o2-info shows the board', async () => {
    const { container } = renderTools(`${G2}/info`);
    await screen.findByText('EU_868 · LongFast');
    await screen.findByText('24.2 km · Keratea Hill');
    expectBoard('o2-info', container);
    // Today's values: the source's address, firmware, the virtual node's clients, the local node's stats.
    expect(screen.getByText('192.168.1.40:4403')).toBeInTheDocument();
    expect(screen.getByText('Enabled · 2 clients')).toBeInTheDocument();
    expect(screen.getByText('27%')).toBeInTheDocument();
    expect(screen.getByText('3.1%')).toBeInTheDocument();
    expect(screen.getByText('Mains · 5.10 V')).toBeInTheDocument();
  });

  it('16-01-info shows the board', async () => {
    const { container } = renderTools(`${G2}/info`, { phone: true });
    await screen.findByText('EU_868 · LongFast');
    expectBoard('16-01-info', container);
    expect(screen.getByRole('link', { name: /^Mesh/ })).toHaveAttribute('href', `${G2}/info/mesh`);
  });

  it('opening Info reads today\'s calls once each and sends nothing', async () => {
    renderTools(`${G2}/info`);
    await screen.findByText('24.2 km · Keratea Hill');
    await waitFor(() => expect(fetched().some((r) => r.startsWith('GET /api/server-info'))).toBe(true));
    for (const path of ['/api/virtual-node/status', '/api/server-info', '/api/route-segments/longest-active', '/api/route-segments/record-holder', '/api/device/security-keys', '/api/messages/counts']) {
      expect(fetched().filter((r) => r.startsWith(`GET ${path}`)), path).toHaveLength(1);
    }
    expect(nonGets()).toEqual([]);
  });

  it('a group opens its page with today\'s fields; This node keeps the private key masked until Show', async () => {
    renderTools(`${G2}/info`);
    fireEvent.click(await screen.findByRole('link', { name: 'This node: all of it' }));
    const priv = await screen.findByLabelText('Private Key');
    expect(priv).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Public Key')).toHaveValue('Pub0Key1Station2G3Fixture4Value5abcdefghij=');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(priv).toHaveAttribute('type', 'text');
    expect(screen.getByTestId('telemetry-graphs')).toBeInTheDocument();
  });

  it('Radio, MQTT, Connection and Server show today\'s rows', async () => {
    renderTools(`${G2}/info/radio`);
    // A cold deep link: the group page must wait for the first poll, not bounce to Info (Ruling JB).
    await screen.findByText('Device Role', {}, { timeout: 5000 });
    for (const label of ['Device Role', 'Modem Preset', 'Channel Number', 'Frequency', 'TX Power', 'TX Enabled', 'Boosted RX Gain']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('link', { name: 'All of Info' }));
    fireEvent.click(await screen.findByRole('link', { name: 'MQTT: all of it' }));
    for (const label of ['Username', 'Encryption Enabled', 'JSON Format', 'TLS Enabled', 'Root Topic']) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('meshdev')).toBeInTheDocument();
  });

  it('Clear Record asks first with today\'s words, then sends one DELETE, even when pressed twice', async () => {
    renderTools(`${G2}/info/records`, { fixtures: { 'DELETE /api/route-segments/record-holder': () => ({ success: true }) } });
    fireEvent.click(await screen.findByRole('button', { name: /Clear Record/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Clear Record Holder?' });
    expect(sheet).toHaveTextContent('Are you sure you want to clear the RF record holder? This action cannot be undone.');
    expect(nonGets()).toEqual([]);
    const confirm = within(sheet).getByRole('button', { name: 'Clear Record' });
    await waitFor(() => expect(confirm).toBeEnabled());
    // A double press still clears once.
    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(nonGets().filter((r) => r.startsWith('DELETE /api/route-segments/record-holder'))).toHaveLength(1));
    expect(nonGets()).toEqual(['DELETE /api/route-segments/record-holder?sourceId=src-g2&transport=rf']);
  });

  it('a group deep link on a disconnected device still goes back to Info', async () => {
    renderTools('/source/src-rak/info/radio');
    expect(await screen.findByRole('link', { name: 'Connection: all of it' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('Device Role')).not.toBeInTheDocument();
  });

  it('an unknown group goes back to Info', async () => {
    renderTools(`${G2}/info/nope`);
    expect(await screen.findByRole('link', { name: 'Radio: all of it' })).toBeInTheDocument();
  });
});
