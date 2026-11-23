/**
 * @vitest-environment jsdom
 *
 * Boards 14-06 (desktop) and 14-12 (phone): Auto Responder's page (Task 8.3):
 * its triggers, searchable, each edited in a sheet (pattern or regex, the
 * response type and its field, channels, cooldown, verify, multiline) with
 * the live test (local, sends nothing) and, for a script, today's script test
 * (one request per press, nothing sent). Saving sends today's one request.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { joined } from '../../chat/__tests__/renderChat';
import { AUTO, renderAutomations, settle, writes, nonGet } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const PAGE = `${AUTO}/auto-responder`;
const loaded = () => screen.findByText('weather {location}');
const openWeather = async () => {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
  return screen.findByRole('dialog', { name: 'weather {location}' });
};

describe('14-06-auto-responder', () => {
  it('14-06-auto-responder shows the board', async () => {
    const { container } = renderAutomations(PAGE);
    await loaded();
    const sheet = await openWeather();
    fireEvent.click(within(sheet).getByRole('button', { name: /Run Test/ }));
    await within(sheet).findByText('Marousi 17 °C, wind 9 km/h N, clear');
    expectBoard('14-06-auto-responder', joined(container, sheet));
  });

  it('14-12-responder-trigger shows the board', async () => {
    const { container } = renderAutomations(PAGE, { phone: true });
    await loaded();
    const sheet = await openWeather();
    fireEvent.change(within(sheet).getByLabelText('Test message'), { target: { value: 'weather marousi' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run' }));
    await within(sheet).findByText('Match · weather {location}');
    expectBoard('14-12-responder-trigger', joined(container, sheet));
  });

  it('search narrows the triggers', async () => {
    renderAutomations(PAGE);
    await loaded();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mail' } });
    expect(screen.queryByText('weather {location}')).toBeNull();
    expect(screen.getByText('mail')).toBeInTheDocument();
  });

  it('the live test matches locally and shows what a text reply would send; it sends nothing', async () => {
    renderAutomations(PAGE);
    await loaded();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
    const sheet = await screen.findByRole('dialog', { name: 'ping' });
    fireEvent.change(within(sheet).getByLabelText('Test message'), { target: { value: 'ping' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Run' }));
    const label = await within(sheet).findByText('Would send, not sent now:');
    expect(label.nextElementSibling).toHaveTextContent('pong {SHORT_NAME}');
    await settle();
    expect(nonGet()).toHaveLength(0);
  });

  it('the script test sends today\'s request once per press and nothing on the mesh', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    const sheet = await openWeather();
    fireEvent.change(within(sheet).getByLabelText('Test Message'), { target: { value: 'weather marousi' } });
    fireEvent.click(within(sheet).getByRole('button', { name: /Run Test/ }));
    await waitFor(() => expect(writes(log, '/api/scripts/test')).toHaveLength(1));
    expect(writes(log, '/api/scripts/test')[0].body).toMatchObject({
      script: '/data/scripts/weather.py', triggerType: 'auto-responder', scriptArgs: '--loc {location}', testMessage: 'weather marousi', trigger: 'weather {location}',
    });
    expect(await within(sheet).findByText('These messages would be sent if this were a real trigger (NOT sent during test)')).toBeInTheDocument();
    await settle();
    expect(nonGet()).toHaveLength(1);
  });

  it('a trigger edited in its sheet saves with today\'s body, once', async () => {
    const { log } = renderAutomations(PAGE);
    await loaded();
    const sheet = await openWeather();
    const cooldown = within(sheet).getByLabelText('Cooldown');
    fireEvent.change(cooldown, { target: { value: '120' } });
    fireEvent.blur(cooldown);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(nonGet()).toHaveLength(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    const body = writes(log, '/api/settings')[0].body as Record<string, string>;
    expect(body.autoResponderEnabled).toBe('true');
    expect(body.autoResponderSkipIncompleteNodes).toBe('false');
    const triggers = JSON.parse(body.autoResponderTriggers) as Array<{ id: string; cooldownSeconds?: number; channels?: unknown[] }>;
    expect(triggers.map((tr) => tr.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(triggers[0]).toMatchObject({ cooldownSeconds: 120, channels: ['dm', 1] });
    await settle();
    expect(nonGet()).toHaveLength(1);
  });
});
