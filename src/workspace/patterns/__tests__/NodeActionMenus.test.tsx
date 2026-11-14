/**
 * @vitest-environment jsdom
 *
 * NodeActionMenus (spec s10n0): Ask the node / Organise / Data with today's
 * gates, today's requests and a Sends line on everything that transmits.
 * Meshtastic items are driven through the DM screen, which mounts the
 * providers the node hook needs; the other protocols render on their own.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import NodeActionMenus from '../NodeActionMenus';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const KIF = 0xa1b2c301;
const route = `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`;
const kifisia = athensFixture.nodes.find((n) => n.nodeNum === KIF)!;

async function openMenu(name: 'Ask the node' | 'Organise' | 'Data', opts = {}) {
  renderChat(route, opts);
  const head = await screen.findByTestId('dm-header');
  await within(head).findByText('Kifisia Rooftop');
  fireEvent.click(within(head).getByRole('button', { name }));
  return within(screen.getByRole('group', { name }));
}

const posted = (path: string) =>
  vi.mocked(fetch).mock.calls.filter(([u, i]) => String(u).includes(path) && (i?.method ?? 'GET') !== 'GET');

describe('Ask the node (Meshtastic)', () => {
  it('lists the six asks, each with its Sends line', async () => {
    const menu = await openMenu('Ask the node');
    for (const label of ['Traceroute', 'Exchange Node Info', 'Exchange Position', 'Request Telemetry', 'Request Neighbors', 'Scan for Admin']) {
      expect(menu.getByRole('button', { name: new RegExp(`^${label}`) })).toBeEnabled();
    }
    expect(menu.getByText('Sends 1 traceroute request; each relay adds itself on the way')).toBeInTheDocument();
    expect(menu.getByText('Sends your NodeInfo on # LongFast and asks for theirs')).toBeInTheDocument();
    expect(menu.getByText('Sends your position on # LongFast and asks for theirs')).toBeInTheDocument();
    expect(menu.getByText('Sends 1 telemetry request for the type you pick')).toBeInTheDocument();
    expect(menu.getByText('Sends 1 neighbour-info request')).toBeInTheDocument();
    expect(menu.getByText('Sends 1 admin request to the node and waits for its reply')).toBeInTheDocument();
  });

  it("Exchange Node Info posts to /api/nodeinfo/request on the node's channel, not as a DM", async () => {
    const menu = await openMenu('Ask the node');
    fireEvent.click(menu.getByRole('button', { name: /^Exchange Node Info/ }));
    await waitFor(() => expect(posted('/api/nodeinfo/request')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/nodeinfo/request')[0][1]!.body))).toEqual({
      destination: KIF,
      sourceId: SOURCE_IDS.g2,
      channel: 0,
    });
    expect(posted('/api/messages/send')).toHaveLength(0);
  });

  it('the channel picker changes the channel Exchange Position is sent on', async () => {
    const menu = await openMenu('Ask the node');
    fireEvent.change(menu.getByRole('combobox', { name: 'Choose channel for position exchange' }), { target: { value: '2' } });
    expect(menu.getByText('Sends your position on # Athens Ops and asks for theirs')).toBeInTheDocument();
    fireEvent.click(menu.getByRole('button', { name: /^Exchange Position/ }));
    await waitFor(() => expect(posted('/api/position/request')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/position/request')[0][1]!.body))).toEqual({ destination: KIF, sourceId: SOURCE_IDS.g2, channel: 2 });
  });

  it("Traceroute sends today's body: no channel unless one is picked", async () => {
    const menu = await openMenu('Ask the node');
    fireEvent.click(menu.getByRole('button', { name: /^Traceroute/ }));
    await waitFor(() => expect(posted('/api/traceroute')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/traceroute')[0][1]!.body))).toEqual({ destination: KIF, sourceId: SOURCE_IDS.g2 });
  });

  it("Request Telemetry asks for the type in a sheet with today's types", async () => {
    const menu = await openMenu('Ask the node');
    fireEvent.click(menu.getByRole('button', { name: /^Request Telemetry/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Request Telemetry' }));
    expect(sheet.getByText('Sends 1 telemetry request for the type you pick')).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: /^Environment Metrics/ }));
    await waitFor(() => expect(posted('/api/telemetry/request')).toHaveLength(1));
    expect(JSON.parse(String(posted('/api/telemetry/request')[0][1]!.body))).toMatchObject({ destination: KIF, telemetryType: 'environment' });
  });

  it('with TX disabled every ask is off, with today\'s tooltip', async () => {
    const menu = await openMenu('Ask the node', {
      fixtures: { 'GET /api/device/tx-status': () => ({ ...athensFixture.txStatus, txEnabled: false, canTransmit: false }) },
    });
    const tip = "Transmit is disabled on this node's radio. Re-enable TX in the LoRa configuration to use this.";
    const traceroute = menu.getByRole('button', { name: /^Traceroute/ });
    await waitFor(() => expect(traceroute).toBeDisabled());
    expect(traceroute).toHaveAttribute('title', tip);
  });
});

describe('gates: an item without permission stays listed, disabled, with its reason', () => {
  // Can read the DM, nothing else.
  const readOnly = { permissions: { bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false } } } } };

  it.each([
    ['Ask the node', 'Traceroute', 'Needs traceroute:write'],
    ['Ask the node', 'Request Neighbors', 'Needs traceroute:write'],
    ['Ask the node', 'Exchange Node Info', 'Needs messages:write'],
    ['Ask the node', 'Scan for Admin', 'Needs settings:write'],
    ['Organise', 'Add to favorites', 'Needs nodes:write'],
    ['Organise', 'Ignore Node', 'Needs nodes:write'],
    ['Organise', 'Hide from Map', 'Needs nodes:write'],
    ['Data', 'Override Position', 'Needs nodes:write'],
    ['Data', 'Copy NodeInfo', 'Needs nodes:write'],
    ['Data', 'Merge history…', 'Admins only, with nodes:write'],
    ['Data', 'Purge Data', 'Needs messages:write'],
  ] as const)('%s › %s: %s', async (menuName, label, reason) => {
    const menu = await openMenu(menuName, readOnly);
    const button = menu.getByRole('button', { name: new RegExp(`^${label}`) });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', reason);
    expect(within(button.closest('[data-item]') as HTMLElement).getByText(reason)).toBeInTheDocument();
  });

  it('Copy NodeInfo also needs nodes:read', async () => {
    const menu = await openMenu('Data', {
      permissions: { bySource: { [SOURCE_IDS.g2]: { messages: { read: true, write: false }, nodes: { read: false, write: true } } } },
    });
    expect(menu.getByRole('button', { name: /^Copy NodeInfo/ })).toHaveAttribute('title', 'Needs nodes:read');
  });

  it('Merge history is off with no detected renumbering, even for an admin', async () => {
    const menu = await openMenu('Data');
    expect(menu.getByRole('button', { name: /^Merge history…/ })).toHaveAttribute('title', 'No renumbered pair detected for this node');
  });
});

describe('Purge data', () => {
  const ok = () => ({ success: true, deletedCount: 3, messagesDeleted: 3, traceroutesDeleted: 2, telemetryDeleted: 1 });
  const fixtures = {
    'DELETE /api/messages/direct-messages/:nodeNum': ok,
    'DELETE /api/messages/nodes/:nodeNum/traceroutes': ok,
    'POST /api/messages/nodes/:nodeNum/purge-from-device': ok,
  };

  it("offers today's four data types and the two delete choices, with the tracked-asset warning, and asks plainly", async () => {
    const menu = await openMenu('Data', { fixtures });
    fireEvent.click(menu.getByRole('button', { name: /^Purge Data/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' });
    const sheet = within(dialog);
    for (const label of ['Purge All Messages', 'Purge Traceroutes', 'Purge Telemetry', 'Purge Position History']) {
      expect(sheet.getByRole('checkbox', { name: label })).not.toBeChecked();
    }
    expect(sheet.getByRole('radio', { name: 'Keep the node' })).toBeChecked();
    expect(sheet.getByRole('radio', { name: 'Delete Node (Local Database Only)' })).toBeInTheDocument();
    expect(sheet.getByRole('radio', { name: 'Purge from Device AND Database' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('This node is a tracked asset. Deleting it also removes its retained history.');
    expect(dialog).toHaveTextContent('These actions cannot be undone.');
    // No typed word, as today; nothing picked, nothing to confirm.
    expect(sheet.queryByRole('textbox')).toBeNull();
    const purge = sheet.getByRole('button', { name: 'Purge' });
    expect(purge).toBeDisabled();

    fireEvent.click(sheet.getByRole('checkbox', { name: 'Purge All Messages' }));
    fireEvent.click(sheet.getByRole('checkbox', { name: 'Purge Traceroutes' }));
    fireEvent.click(purge);
    await waitFor(() => expect(posted(`/api/messages/nodes/${KIF}/traceroutes`)).toHaveLength(1));
    const dm = posted(`/api/messages/direct-messages/${KIF}`);
    expect(dm).toHaveLength(1);
    expect(dm[0][1]!.method).toBe('DELETE');
    expect(JSON.parse(String(dm[0][1]!.body))).toEqual({ sourceId: SOURCE_IDS.g2 });
    expect(posted(`/api/messages/nodes/${KIF}/purge-from-device`)).toHaveLength(0);
  });

  it('Purge from Device AND Database posts today\'s request and says it sends nothing on the mesh', async () => {
    const menu = await openMenu('Data', { fixtures });
    fireEvent.click(menu.getByRole('button', { name: /^Purge Data/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Purge Data for Kifisia Rooftop' }));
    fireEvent.click(sheet.getByRole('radio', { name: 'Purge from Device AND Database' }));
    expect(sheet.getByText('Sends nothing on the mesh; Station G2 forgets the node')).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: 'Purge' }));
    await waitFor(() => expect(posted(`/api/messages/nodes/${KIF}/purge-from-device`)).toHaveLength(1));
  });
});

describe('other protocols', () => {
  it('an MQTT mirror has no Ask the node; Organise and Data stay', async () => {
    renderChat(`/source/${SOURCE_IDS.mqtt}/dm/!a1b2c301`);
    const head = await screen.findByTestId('dm-header');
  await within(head).findByText('Kifisia Rooftop');
    expect(within(head).queryByRole('button', { name: 'Ask the node' })).toBeNull();
    expect(within(head).getByRole('button', { name: 'Organise' })).toBeInTheDocument();
    expect(within(head).getByRole('button', { name: 'Data' })).toBeInTheDocument();
  });

  it("MeshCore lists Ping, Trace Path and Discover Path, off until MeshCore chat, and no Aircraft", async () => {
    renderWorkspace(<NodeActionMenus protocol="meshcore" sourceId={SOURCE_IDS.heltec} node={kifisia} variant="tiles" />);
    const ask = within(await screen.findByRole('group', { name: 'Ask the node' }));
    for (const label of ['Ping (0 hop)', 'Trace Path', 'Discover Path']) {
      const button = ask.getByRole('button', { name: new RegExp(`^${label.replace(/[()]/g, '\\$&')}`) });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Comes with MeshCore chat in the Workspace');
    }
    expect(screen.queryByText(/aircraft/i)).toBeNull();
  });

  it('Reticulum has no asks', async () => {
    renderWorkspace(<NodeActionMenus protocol="reticulum" sourceId={SOURCE_IDS.rns} node={kifisia} variant="tiles" />);
    await screen.findByRole('group', { name: 'Organise' });
    expect(screen.queryByRole('group', { name: 'Ask the node' })).toBeNull();
  });
});
