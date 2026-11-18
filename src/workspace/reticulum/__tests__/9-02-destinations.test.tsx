/**
 * @vitest-environment jsdom
 *
 * Boards 9-02 (desktop) and 9-11 (phone): Destinations, native (Task 7.6), and
 * the destination details. Favourite is today's one POST per press
 * (`nodes:write`); search, sort and Copy stay in the browser.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RNS } from '../../__fixtures__/reticulum';
import { RNS_URL, renderReticulum } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

const pause = () => act(async () => new Promise((r) => setTimeout(r, 50)));
const URL_ = `${RNS_URL}/destinations`;

describe('9-02-destinations', () => {
  it('9-02-destinations shows the board', async () => {
    const { container } = renderReticulum(URL_);
    fireEvent.click(await screen.findByText('Kifisia Sideband', { selector: 'strong' }));
    await screen.findByRole('complementary', { name: 'Kifisia Sideband' });
    expectBoard('9-02-destinations', container);
  });

  it('search filters and Clear empties it; the sort direction toggles', async () => {
    renderReticulum(URL_);
    await screen.findByText('Glyfada Propagation');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search destinations…' }), { target: { value: 'nomad' } });
    expect(screen.queryByText('Glyfada Propagation')).toBeNull();
    expect(screen.getByText('Psychiko NomadNet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Glyfada Propagation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Descending/ }));
    expect(screen.getByRole('button', { name: /Ascending/ })).toBeInTheDocument();
  });

  it('the star sets Favourite: one POST per press', async () => {
    const { log } = renderReticulum(URL_);
    await screen.findByText('Marousi Sideband');
    const row = screen.getByText('Marousi Sideband', { selector: 'strong' }).closest('tr')!;
    const star = within(row).getByRole('button', { name: 'Add to favorites' });
    await waitFor(() => expect(star).toBeEnabled());
    fireEvent.click(star);
    await waitFor(() => expect(log.writes).toHaveLength(1));
    await pause();
    expect(log.writes).toEqual([
      { method: 'POST', path: `/api/sources/src-rns/reticulum/destinations/${RNS.marousi}/favorite`, body: { favorite: true } },
    ]);
  });

  it("without nodes:write the star is off with today's reason", async () => {
    renderReticulum(URL_, { permissions: { bySource: { 'src-rns': { nodes: { read: true, write: false }, messages: { read: true, write: false } } } } });
    await screen.findByText('Marousi Sideband');
    const row = screen.getByText('Marousi Sideband', { selector: 'strong' }).closest('tr')!;
    const star = within(row).getByRole('button', { name: 'Add to favorites' });
    expect(star).toBeDisabled();
    expect(star).toHaveAttribute('title', 'Needs nodes:write');
  });

  it('9-11-destinations shows the board', async () => {
    renderReticulum(URL_, { phone: true });
    fireEvent.click(await screen.findByRole('button', { name: /Kifisia Sideband/ }));
    await screen.findByRole('dialog');
    expectBoard('9-11-destinations', document.body);
  });
});
