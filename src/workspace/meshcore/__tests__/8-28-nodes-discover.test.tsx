/**
 * @vitest-environment jsdom
 *
 * Board 8-28 (phone): Nodes on Heltec MeshCore after Discover Repeaters. Back
 * to Home, the map, search, Import contact, Group by Role, Favourites,
 * Filters, Discover with its line and the answer; the rows grouped by role
 * with the Neighbour and NEW tags. Sort and Export sit in the list header,
 * under Discover (s8n6), Export as today's CSV / HTML menu.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nodeExport from '../../../utils/nodeExport';
import { MESHCORE_NODE_EXPORT_COLUMNS } from '../../../utils/meshcoreNodeRows';
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

  it('Export is in the phone list header, at 44 px, and exports through today\'s exporter', async () => {
    const spy = vi.spyOn(nodeExport, 'exportNodeList').mockImplementation(() => {});
    renderMeshCore(`${HELTEC}/nodes`, { phone: true });
    await screen.findByText('Lycabettus Repeater');
    const trigger = screen.getByRole('button', { name: /Export/ });
    expect(trigger.closest('[data-phone]')).not.toBeNull();
    fireEvent.click(trigger);
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'CSV' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const [format, columns, rows, opts] = spy.mock.calls[0];
    expect(format).toBe('csv');
    expect(columns).toBe(MESHCORE_NODE_EXPORT_COLUMNS);
    expect((rows as unknown[]).length).toBeGreaterThan(0);
    expect(opts).toMatchObject({ filenamePrefix: 'meshcore-nodes' });
    spy.mockRestore();
    const css = readFileSync(join(__dirname, '../MeshCoreNodesTable.module.css'), 'utf8');
    expect(css).toMatch(/\.headTools\[data-phone\] button \{\s*min-height: 44px;/);
    expect(css).toMatch(/\.age\[data-phone\] select \{\s*min-height: 44px;/);
  });

  it('Filters open the Workspace sheet with MeshCore\'s sections; Escape closes only the sheet', async () => {
    renderMeshCore(`${HELTEC}/nodes`, { phone: true });
    await screen.findByText('Lycabettus Repeater');
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    const sheet = await screen.findByRole('dialog', { name: /Filters/ });
    expect(within(sheet).getByText('Favorites')).toBeInTheDocument();
    expect(within(sheet).queryByText('MQTT nodes')).toBeNull();
    expect(within(sheet).queryByText('Channel')).toBeNull();
    expect(within(sheet).getByText('Device Role')).toBeInTheDocument();
    expect(sheet.querySelector('[data-phone]')).not.toBeNull();
    fireEvent.keyDown(document.activeElement ?? sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Filters/ })).toBeNull());
    expect(screen.getByText('Lycabettus Repeater')).toBeInTheDocument();
  });
});
