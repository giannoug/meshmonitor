/**
 * @vitest-environment jsdom
 *
 * Boards 14-05 (desktop) and 14-14 (phone): all eighteen of a Meshtastic
 * device's built-ins at `/source/:id/automation/builtins`, grouped Replies,
 * Scheduled sends, Node care and Data, each with its Sends line read from its
 * settings, its switch or value, and its own page; today's token reference.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { AUTO, renderAutomations, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const LIST = `${AUTO}/builtins`;
const loaded = async () => {
  await screen.findByText('4 ignored');
  await screen.findByText('When on, 1 DM per new node, once it has a name');
};

describe('14-05-builtins-list', () => {
  it('14-05-builtins-list shows the board', async () => {
    const { container } = renderAutomations(LIST);
    await loaded();
    expectBoard('14-05-builtins-list', container);
  });

  it('14-14-builtins-list shows the board', async () => {
    const { container } = renderAutomations(LIST, { phone: true });
    await loaded();
    expectBoard('14-14-builtins-list', container);
  });

  it('groups the eighteen built-ins and counts those on', async () => {
    renderAutomations(LIST);
    await loaded();
    const replies = screen.getByRole('region', { name: 'Replies' });
    expect(within(replies).getAllByRole('listitem')).toHaveLength(6);
    expect(within(screen.getByRole('region', { name: 'Scheduled sends' })).getAllByRole('listitem')).toHaveLength(3);
    expect(within(screen.getByRole('region', { name: 'Node care' })).getAllByRole('listitem')).toHaveLength(4);
    expect(within(screen.getByRole('region', { name: 'Data' })).getAllByRole('listitem')).toHaveLength(5);
    // Airtime cutoff shows its threshold in place of a switch; Ignored Nodes its count.
    expect(within(screen.getByRole('region', { name: 'Node care' })).getByText('30 %')).toBeInTheDocument();
  });

  it('a built-in that is off reads "When on, …"; one that sends nothing says so', async () => {
    renderAutomations(LIST);
    await loaded();
    const traceroute = screen.getByRole('link', { name: 'Open Auto Traceroute' }).closest('li') as HTMLElement;
    expect(within(traceroute).getByText('When on, 1 traceroute every 15 min')).toBeInTheDocument();
    const favourite = screen.getByRole('link', { name: 'Open Auto Favorite' }).closest('li') as HTMLElement;
    expect(within(favourite).getByText('Sends nothing on the mesh')).toBeInTheDocument();
  });

  it('the phone group chips show one group', async () => {
    renderAutomations(LIST, { phone: true });
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /^Node care/ }));
    expect(screen.queryByRole('region', { name: 'Replies' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Node care' })).toBeInTheDocument();
  });

  it('Tokens opens today\'s token reference in a sheet', async () => {
    renderAutomations(LIST);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Tokens' }));
    const sheet = await screen.findByRole('dialog', { name: 'Available message tokens' });
    expect(within(sheet).getByText('{LONG_NAME}')).toBeInTheDocument();
  });

  it('a switch here saves that built-in\'s today\'s request once, and opening sends nothing', async () => {
    const { log } = renderAutomations(LIST);
    await loaded();
    await settle();
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Welcome' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    expect(writes(log, '/api/settings')[0].body).toEqual({
      autoWelcomeEnabled: 'true', autoWelcomeMessage: 'Welcome {LONG_NAME} ({SHORT_NAME}) to the mesh!', autoWelcomeTarget: 'dm',
      autoWelcomeWaitForName: 'true', autoWelcomeMaxHops: '5', autoWelcomeDelay: '30',
    });
    await settle();
    expect(log.writes).toHaveLength(1);
  });
});
