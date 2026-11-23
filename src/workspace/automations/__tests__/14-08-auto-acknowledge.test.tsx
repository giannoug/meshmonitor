/**
 * @vitest-environment jsdom
 *
 * Boards m3, 14-08 (desktop) and 14-16 (phone): Auto Acknowledge's page on
 * the kit (Task 8.3): its pattern and pattern testing, the response matrix,
 * today's limits and templates, its Sends line read from them, and Convert to
 * rule (today's conversion). Saving sends today's one request once.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { AUTO, renderAutomations, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const PAGE = `${AUTO}/auto-acknowledge`;
const SENDS = '60 s cooldown per sender · stays quiet once 2 other nodes replied · DM replies are sent up to 3 times';
const loaded = () => screen.findAllByText(SENDS);

describe('14-08-auto-acknowledge', () => {
  it('14-08-auto-acknowledge shows the board', async () => {
    const { container } = renderAutomations(PAGE);
    await loaded();
    expectBoard('14-08-auto-acknowledge', container);
  });

  it('14-16-auto-acknowledge shows the board', async () => {
    const { container } = renderAutomations(PAGE, { phone: true });
    await loaded();
    expectBoard('14-16-auto-acknowledge', container);
  });

  it('m3-builtin shows the board', async () => {
    const { container } = renderAutomations(PAGE);
    await loaded();
    expectBoard('m3-builtin', container);
  });

  it('pattern testing marks each test line against the pattern as it is typed', async () => {
    renderAutomations(PAGE);
    await loaded();
    const tests = screen.getByRole('region', { name: 'Pattern Testing' });
    expect(within(tests).getByText('hello all').closest('li')).toHaveClass(/miss/);
    expect(within(tests).getByText('ping 3').closest('li')).toHaveClass(/hit/);
    fireEvent.change(screen.getByLabelText('Trigger Pattern (regular expression)'), { target: { value: 'hello' } });
    await waitFor(() => expect(within(tests).getByText('hello all').closest('li')).toHaveClass(/hit/));
  });

  it('a matrix cell and a limit queue in the dock; Save sends today\'s body once, and nothing before', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    await settle();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Channel · IP: Tapback' }));
    const cooldown = screen.getByLabelText('Per-Sender Cooldown');
    fireEvent.change(cooldown, { target: { value: '120' } });
    fireEvent.blur(cooldown);
    expect(await screen.findByText('1 change in Auto Acknowledge')).toBeInTheDocument();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    expect(writes(log, '/api/settings')[0].body).toMatchObject({
      autoAckEnabled: 'true', autoAckCooldownSeconds: '120', autoAckChannelIpTapbackEnabled: 'true', autoAckMaxResponses: '2', autoAckMaxAttempts: '3', autoAckHopLimit: '',
    });
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('an unsafe pattern blocks the save with today\'s reason', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    fireEvent.change(screen.getByLabelText('Trigger Pattern (regular expression)'), { target: { value: '(?=x)test' } });
    expect((await screen.findAllByText(/are not supported/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(log.writes).toHaveLength(0);
  });

  it('Convert to rule previews on open and creates once per press', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Convert to rule' }));
    const sheet = await screen.findByRole('dialog', { name: 'Convert Auto Acknowledge to a rule' });
    await within(sheet).findByText('Trigger pattern');
    expect(writes(log, '/convert/preview')).toHaveLength(1);
    expect(writes(log, '/convert/create')).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Convert to rule' }));
    await waitFor(() => expect(writes(log, '/convert/create')).toHaveLength(1));
    expect(writes(log, '/convert/create')[0].body).toEqual({ sourceId: 'src-g2', enable: true, disableAutoAck: true, replaceExisting: false });
  });

  it('Convert waits for unsaved changes', async () => {
    renderAutomations(PAGE);
    await loaded();
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Acknowledge' }));
    expect(screen.getByRole('button', { name: 'Convert to rule' })).toBeDisabled();
  });
});
