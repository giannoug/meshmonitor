/**
 * @vitest-environment jsdom
 *
 * Board 8-28 (phone): Nodes on Heltec MeshCore after Discover Repeaters. Back
 * to Home, the map, search, Import contact, Group by Role, Favourites,
 * Filters, Discover with its line and the answer; the rows grouped by role
 * with the Neighbour and NEW tags. Sort and Export are further down (s8n6).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-28-nodes-discover', () => {
  it('8-28-nodes-discover shows the board', async () => {
    localStorage.setItem('groupNodesByRole', 'true');
    const { container, log } = renderMeshCore(`${HELTEC}/nodes`, { phone: true });
    await screen.findByText('Lycabettus Repeater');
    fireEvent.click(screen.getByRole('button', { name: /Discover Repeaters/ }));
    await screen.findByText(/4 contacts returned \(1 new\)/);
    expectBoard('8-28-nodes-discover', container);
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/meshcore/discover'))).toHaveLength(1));
  });

  it('a row opens the node page; the header leads Home and to the map', async () => {
    renderMeshCore(`${HELTEC}/nodes`, { phone: true });
    const row = (await screen.findByText('Glyfada Beach')).closest('a')!;
    expect(row.getAttribute('href')).toMatch(/\/node\/6a1b0188/);
    expect(screen.getByRole('link', { name: 'Show on Map' })).toHaveAttribute('href', `${HELTEC}/map`);
    expect(screen.getByRole('button', { name: /Discover Repeaters/ }).closest('[data-phone]')).not.toBeNull();
  });
});
