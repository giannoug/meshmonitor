/**
 * @vitest-environment jsdom
 *
 * Board f3-nodes (desktop): the Nodes table with today's search, quick
 * chips, More filters, sort, Export and the Columns picker. The screen owns
 * its node state (Ruling AD): App is not mounted. Columns are the user
 * preference `workspace.nodes.columns`.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const route = `${g2}/nodes`;
const table = () => screen.findByRole('table', {}, { timeout: 5000 });
const headers = async () => within(await table()).getAllByRole('columnheader').map((th) => th.textContent);

describe('f3-nodes', () => {
  it('f3-nodes shows the board', async () => {
    const { container } = renderChat(route);
    await within(await table()).findByText('Kifisia Rooftop');
    fireEvent.click(screen.getByRole('button', { name: /Columns/ }));
    expectBoard('f3-nodes', container);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('shows the board default columns after Node and Role, each row opening its node page', async () => {
    renderChat(route);
    await within(await table()).findByText('Kifisia Rooftop');
    expect((await headers()).slice(1)).toEqual(['Node', 'Role', 'Hops', 'SNR', 'RSSI', 'Battery', 'Last Heard', 'Distance', 'Hardware']);
    expect(within(await table()).getByRole('link', { name: 'Kifisia Rooftop' })).toHaveAttribute('href', `${g2}/node/!a1b2c301`);
    expect(screen.getByRole('link', { name: /Show on Map/ })).toHaveAttribute('href', `${g2}/map`);
  });

  it('marks a contact-link import as Imported', async () => {
    renderChat(route);
    const row = (await within(await table()).findByText('Penteli Hiker')).closest('tr')!;
    expect(within(row).getByText('Imported')).toBeInTheDocument();
  });

  it('a column picked in Columns is shown and saved to the preference', async () => {
    const prefs = prefsFixture();
    renderChat(route, { fixtures: prefs.fixtures });
    await within(await table()).findByText('Kifisia Rooftop');
    fireEvent.click(screen.getByRole('button', { name: /Columns/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Firmware' }));
    await waitFor(() => expect(prefs.puts).toEqual([
      ['workspace.nodes.columns', ['hops', 'snr', 'rssi', 'battery', 'lastHeard', 'distance', 'hardware', 'firmware']],
    ]));
    expect(await headers()).toContain('Firmware');
  });

  it('draws the saved columns in their saved order, and a drag moves one', async () => {
    const prefs = prefsFixture({ 'workspace.nodes.columns': ['hardware', 'hops', 'nope'] });
    renderChat(route, { fixtures: prefs.fixtures });
    await waitFor(async () => expect((await headers()).slice(3)).toEqual(['Hardware', 'Hops']));
    fireEvent.click(screen.getByRole('button', { name: /Columns/ }));
    const item = (name: string) => screen.getByRole('checkbox', { name }).closest('li')!;
    fireEvent.dragStart(item('Hops'));
    fireEvent.drop(item('Hardware'));
    await waitFor(() => expect(prefs.puts.at(-1)).toEqual(['workspace.nodes.columns', ['hops', 'hardware']]));
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Hops' }), { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(prefs.puts.at(-1)).toEqual(['workspace.nodes.columns', ['hardware', 'hops']]));
  });

  it('a sortable header sorts by today\'s sort field', async () => {
    renderChat(route);
    await within(await table()).findByText('Kifisia Rooftop');
    fireEvent.click(within(screen.getByRole('columnheader', { name: 'Hops' })).getByRole('button'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Sort nodes by' })).toHaveValue('hops'));
    expect(screen.getByRole('columnheader', { name: /Hops/ })).toHaveAttribute('aria-sort');
    expect(screen.getByRole('columnheader', { name: 'Node' })).not.toHaveAttribute('aria-sort');
  });

  it('Online keeps the nodes heard in the "N online" window', async () => {
    renderChat(route);
    await within(await table()).findByText('Penteli Hiker');
    fireEvent.click(screen.getByRole('button', { name: /^Online/ }));
    await waitFor(async () => expect(within(await table()).queryByText('Penteli Hiker')).toBeNull());
    expect(within(await table()).getByText('Kifisia Rooftop')).toBeInTheDocument();
  });

  it('Add node from URL needs nodes:write, with today\'s reason', async () => {
    renderChat(route, { permissions: { bySource: { [SOURCE_IDS.g2]: { nodes: { read: true, write: false } } } } });
    await within(await table()).findByText('Kifisia Rooftop');
    const add = screen.getByRole('button', { name: 'Add node from URL' });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute('title', 'Needs nodes:write');
  });
});
