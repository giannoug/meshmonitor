/**
 * @vitest-environment jsdom
 *
 * Boards 14-07 (desktop) and 14-15 (phone): Geofence Triggers (Task 8.3):
 * each trigger in a sheet with today's map editor (circle or polygon, Clear
 * shape), the event, the response, channel and cooldown, its nodes (all or
 * picked, with search) and, for a script, the script test. Saving sends
 * today's one request, with the trigger as today's Update stores it.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { AUTO, renderAutomations, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const PAGE = `${AUTO}/geofence-triggers`;
const loaded = () => screen.findByText('Lycabettus hill');
const open = async (i: number, name: string) => {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[i]);
  return screen.findByRole('dialog', { name });
};

describe('14-07-geofence-trigger', () => {
  it('14-07-geofence-trigger shows the board', async () => {
    const { container } = renderAutomations(PAGE);
    await loaded();
    const sheet = await open(1, 'Kifisia home');
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Selected nodes' }));
    expectBoard('14-07-geofence-trigger', joined(container, sheet));
  });

  it('14-15-geofence-trigger shows the board', async () => {
    const { container } = renderAutomations(PAGE, { phone: true });
    await loaded();
    const sheet = await open(1, 'Kifisia home');
    expectBoard('14-15-geofence-trigger', joined(container, sheet));
  });

  it('the Sends line counts the cooldowns from the triggers', async () => {
    renderAutomations(PAGE);
    await loaded();
    expect(screen.getAllByText('1 message per node per trigger’s cooldown · 2 triggers on').length).toBeGreaterThan(0);
  });

  it('picking nodes and clearing the shape edit the trigger; Done keeps it unsaved until Save, which sends once', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    const sheet = await open(0, 'Lycabettus hill');
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Glyfada Beach' }));
    const cooldown = within(sheet).getByLabelText('Cooldown (minutes)');
    fireEvent.change(cooldown, { target: { value: '45' } });
    fireEvent.blur(cooldown);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(log.writes).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    const saved = JSON.parse((writes(log, '/api/settings')[0].body as { geofenceTriggers: string }).geofenceTriggers);
    expect(saved[0]).toMatchObject({ id: 'g1', cooldownMinutes: 45, nodeFilter: { type: 'selected' } });
    expect(saved[0].nodeFilter.nodeNums).toContain(0xa1b2c303);
    expect(saved[1].id).toBe('g2');
    await settle();
    expect(log.writes).toHaveLength(1);
  });

  it('Clear shape leaves a trigger Done refuses with today\'s reason', async () => {
    renderAutomations(PAGE);
    await loaded();
    const sheet = await open(0, 'Lycabettus hill');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Clear shape' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(await within(sheet).findByText('Please define a geofence shape on the map')).toBeInTheDocument();
  });
});
