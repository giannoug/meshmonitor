/**
 * @vitest-environment jsdom
 *
 * Board 15-25 (phone): Request Telemetry is its own sheet (s15n5), opened from
 * Ask the node. Today's four types; a tap on one sends today's request, once,
 * as TelemetryRequestModal does (D9d), and the sheet carries the board's
 * Sends line.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from '../../chat/__tests__/renderChat';
import { kifisia } from './nodePageFixtures';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const posted = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes(path) && (i?.method ?? 'GET') !== 'GET');

async function openSheet() {
  renderChat(kifisia, { phone: true, fixtures: { 'POST /api/telemetry/request': () => ({ success: true }) } });
  await screen.findByRole('heading', { level: 1, name: 'Kifisia Rooftop' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: 'Ask the node' }));
  const actions = await screen.findByRole('dialog', { name: /Node actions/ });
  fireEvent.click(within(actions).getByRole('button', { name: /^Request Telemetry/ }));
  return screen.findByRole('dialog', { name: 'Request Telemetry' });
}

describe('15-25-request-telemetry', () => {
  it('15-25-request-telemetry shows the board', async () => {
    const sheet = await openSheet();
    expectBoard('15-25-request-telemetry', sheet);
  });

  it('replaces the Node actions sheet: one sheet at a time', async () => {
    await openSheet();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it("carries the board's Sends line and today's prompt", async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText('Sends 1 telemetry request')).toBeInTheDocument();
    expect(within(sheet).getByText('Select telemetry type to request from Kifisia Rooftop')).toBeInTheDocument();
  });

  it("a type sends today's one request and closes the sheet", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole('button', { name: /^Power Metrics/ }));
    await waitFor(() => expect(posted('/api/telemetry/request')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/telemetry/request')[0][1]!.body))).toMatchObject({ destination: 0xa1b2c301, telemetryType: 'power' });
    expect(screen.queryByRole('dialog', { name: 'Request Telemetry' })).toBeNull();
  });
});
