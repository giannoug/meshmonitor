/**
 * @vitest-environment jsdom
 *
 * Board 8-02 (desktop): Route details on Glyfada Beach's message open the
 * Message Route panel beside #athens: From, Time, Hops, Scope, Hash width,
 * the route resolved from the path hashes, and the packet flow.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

describe('8-02-route-details', () => {
  it('8-02-route-details shows the board', async () => {
    const { container } = renderMeshCore(`${HELTEC}/channel/1`);
    const row = (await screen.findByText('Morning, anyone on the coast road? Testing a new antenna.')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Route details' }));
    const panel = await screen.findByRole('complementary', { name: 'Message Route' });
    expect(panel).toHaveTextContent('Glyfada Beach');
    expect(panel).toHaveTextContent('2 B');
    expect(within(panel).getByText('Lycabettus Repeater')).toBeInTheDocument();
    expectBoard('8-02-route-details', container);
  });

  it('opening the route sends nothing on the mesh', async () => {
    const { log } = renderMeshCore(`${HELTEC}/channel/1`);
    const row = (await screen.findByText('Morning, anyone on the coast road? Testing a new antenna.')).closest('[data-message-id]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Route details' }));
    await screen.findByRole('complementary', { name: 'Message Route' });
    expect(log.writes).toHaveLength(0);
    expect(requests('POST', /\/meshcore\//)).toBe(0);
  });
});
