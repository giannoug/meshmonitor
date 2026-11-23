/**
 * @vitest-environment jsdom
 *
 * Board 14-04 (desktop), s14n2: a rule's Live trace over today's transport
 * (LiveTracePanel's socket subscription, its 5-minute session) with Run now's
 * confirm docked beside it. The trace starts once on open and stops on leave.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { fakeSocket, nonGet, renderRules } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const TRACE = '/automations/e7/trace';
const started = () => fakeSocket.fire('automation-trace:started', { automationId: 'e7', expiresAt: Date.now() + 227_000 });

describe('14-04-live-trace', () => {
  it('14-04-live-trace shows the board', async () => {
    renderRules(TRACE);
    await screen.findByText(/Stops by itself after 5 min/);
    started();
    fakeSocket.fire('automation:trace', {
      ts: Date.now(), automationId: 'e7', triggerType: 'trigger.schedule', sourceId: null, event: {}, outcome: 'fired', status: 'completed',
      steps: [{ nodeId: 'a0', type: 'action.sendMessage', outcome: 'action:ok' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));
    await screen.findByRole('dialog', { name: 'Run this automation now?' });
    expectBoard('14-04-live-trace', document.body);
  });

  it('uses today\'s transport: one start on open, a stop on leave, and nothing sent over HTTP', async () => {
    renderRules(TRACE);
    await screen.findByText(/Stops by itself after 5 min/);
    expect(fakeSocket.emits).toEqual([{ event: 'automation-trace:start', data: { automationId: 'e7', durationMs: 300_000 } }]);
    started();
    expect(await screen.findByText(/^live · 3:4\d left$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(fakeSocket.emits.map((e) => e.event)).toEqual(['automation-trace:start', 'automation-trace:stop']));
    expect(nonGet()).toEqual([]);
  });

  it('a disabled rule says the engine never evaluates it', async () => {
    renderRules('/automations/e6/trace');
    expect(await screen.findByText(/This rule is disabled — the engine never evaluates it/)).toBeInTheDocument();
  });
});
