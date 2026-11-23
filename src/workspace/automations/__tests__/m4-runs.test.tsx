/**
 * @vitest-environment jsdom
 *
 * Boards m4 (desktop) and 14-13 (phone), s14n4: a rule's Runs. Today's run
 * log: when, who, the result read from the stored status and steps (Sent,
 * Skipped · IF not met, Failed · the error), each run's steps and trigger
 * payload. Read once; nothing is sent.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { gets, nonGet, renderRules, settle } from './renderRules';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));

const RUNS = '/automations/e3/runs';

describe('m4-runs', () => {
  it('m4-runs shows the board', async () => {
    renderRules(RUNS);
    fireEvent.click(await screen.findByRole('button', { name: 'Nikos T-Echo: “!wx marousi”' }));
    await screen.findByText('Trigger payload');
    expectBoard('m4-runs', document.body);
  });

  it('14-13-runs-trace shows the board', async () => {
    renderRules(RUNS, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: /Nikos T-Echo: “!wx marousi”/ }));
    fireEvent.click(await screen.findByText('Trigger payload'));
    expectBoard('14-13-runs-trace', document.body);
  });

  it('counts and filters runs by result', async () => {
    renderRules(RUNS);
    await screen.findByRole('button', { name: 'Nikos T-Echo: “!wx marousi”' });
    expect(screen.getByRole('link', { name: 'Runs · 6' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Failed/ }));
    expect(screen.getByText('Glyfada Beach: “!wx glyfada”')).toBeInTheDocument();
    expect(screen.queryByText('Nikos T-Echo: “!wx marousi”')).toBeNull();
    expect(screen.getByRole('button', { name: /^Sent/ })).toHaveTextContent('Sent 4');
    expect(screen.getByRole('button', { name: /^Skipped/ })).toHaveTextContent('Skipped 1');
  });

  it('reads the runs once and sends nothing, across tabs and re-renders', async () => {
    renderRules(RUNS);
    await screen.findByRole('button', { name: 'Nikos T-Echo: “!wx marousi”' });
    fireEvent.click(screen.getByRole('link', { name: 'Rule' }));
    await screen.findByRole('button', { name: /^WHEN:/ });
    fireEvent.click(screen.getByRole('link', { name: 'Runs · 6' }));
    await screen.findByRole('button', { name: 'Nikos T-Echo: “!wx marousi”' });
    await settle(200);
    expect(gets('/api/automations/e3/runs')).toBe(1);
    expect(nonGet()).toEqual([]);
  });

  it('a run opens to its steps', async () => {
    renderRules(RUNS);
    fireEvent.click(await screen.findByRole('button', { name: 'Glyfada Beach: “!wx glyfada”' }));
    const detail = screen.getByText('Trigger payload').closest('div') as HTMLElement;
    expect(within(detail).getByText(/Run a script → error/)).toBeInTheDocument();
  });
});
