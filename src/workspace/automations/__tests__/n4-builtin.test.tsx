/**
 * @vitest-environment jsdom
 *
 * Board n4 (phone): Auto Announce's page (Task 8.3): where and how often with
 * today's 3–24 h clamp and the airtime warning next to it, the message and
 * its live preview, the next and last announcement, and Send now, which asks
 * first and sends once per press. Saving sends today's one request once and
 * says what today's server does on a save.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { AUTO, renderAutomations, requests, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const PAGE = `${AUTO}/auto-announce`;
const loaded = () => screen.findAllByText('On LongFast every 6 h · hop limit 3');

describe('n4-builtin', () => {
  it('n4-builtin shows the board', async () => {
    const { container } = renderAutomations(PAGE, { phone: true });
    await loaded();
    await screen.findByText('MeshMonitor at Station G2, 12 nodes online.');
    expectBoard('n4-builtin', container);
  });

  it('Send now asks first with its Sends line; Enter sends nothing; the button sends once', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Send Now' }));
    const sheet = await screen.findByRole('dialog', { name: 'Send Now' });
    expect(within(sheet).getByText('Send now sends 1 announcement now, on LongFast')).toBeInTheDocument();
    fireEvent.keyDown(sheet, { key: 'Enter' });
    await settle();
    expect(writes(log, '/api/announce/send')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send Now' }));
    await waitFor(() => expect(writes(log, '/api/announce/send')).toHaveLength(1));
    expect(writes(log, '/api/announce/send')[0].body).toEqual({ sourceId: 'src-g2' });
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('saving says what today\'s scheduler does, and sends today\'s body once', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    const interval = screen.getByLabelText('Announcement Interval (hours)');
    fireEvent.change(interval, { target: { value: '12' } });
    fireEvent.blur(interval);
    expect(await screen.findByText('Saving sends nothing now; the schedule restarts from the save')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    expect(writes(log, '/api/settings')[0].body).toEqual({
      autoAnnounceEnabled: 'true', autoAnnounceIntervalHours: 12, autoAnnounceMessage: 'MeshMonitor at Station G2, {ONLINENODES} nodes online.',
      autoAnnounceChannelIndexes: '[0]', autoAnnounceOnStart: 'false', autoAnnounceUseSchedule: 'false', autoAnnounceSchedule: '0 */6 * * *',
      autoAnnounceHopLimit: '3', autoAnnounceSplitLongMessages: 'false', autoAnnounceNodeInfoEnabled: 'false', autoAnnounceNodeInfoChannels: '[]',
      autoAnnounceNodeInfoDelaySeconds: 30,
    });
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('with Announce on Start on, the dock says a save can send one in 30 s', async () => {
    renderAutomations(PAGE);
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Announce on Start' }));
    expect(await screen.findByText(/also sends one in 30 s, unless one went out in the last hour/)).toBeInTheDocument();
  });

  it('typing reads the preview once after today\'s debounce, never per keystroke, and sends nothing', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    await settle(700);
    const before = requests('GET', '/api/announce/preview');
    const message = screen.getByLabelText('Announcement Message');
    for (const ch of ['a', 'b', 'c']) fireEvent.change(message, { target: { value: `Hello ${ch}` } });
    await settle(700);
    expect(requests('GET', '/api/announce/preview') - before).toBe(1);
    expect(log.writes).toHaveLength(0);
  });
});
