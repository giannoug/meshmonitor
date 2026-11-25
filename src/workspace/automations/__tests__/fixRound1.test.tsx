/**
 * @vitest-environment jsdom
 *
 * Task 8.3 fix round 1 (Rulings 8.3 IA, IB): the controls the canvas notes
 * name (welcome preview, traceroute match count, airtime contributors, the
 * pattern examples, the script test's context and environment), Delete asks
 * first, Send now quotes what the server sends, the dirty count, the door's
 * save report and rule guard, the distance unit, and the smaller GR items.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture as A } from '../../__fixtures__/athens';
import { g2AutomationSettings } from '../../__fixtures__/automations';
import { AUTO, nonGet, renderAutomations, requests, settle, writes } from './renderAutomations';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const enabled = async (name: string | RegExp, within_: Pick<typeof screen, 'findByRole'> = screen) => {
  const button = await within_.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};

describe('I1: the controls the canvas notes name', () => {
  it('Auto Welcome shows today\'s message preview, filled client-side', async () => {
    renderAutomations(`${AUTO}/auto-welcome`);
    expect(await screen.findByText('Welcome Meshtastic ABC1 (ABC1) to the mesh!')).toBeInTheDocument();
  });

  it('Auto Traceroute shows how many nodes the filters match, and the count follows an edit with no request', async () => {
    renderAutomations(`${AUTO}/auto-traceroute`);
    const total = A.nodes.length;
    expect(await screen.findByText(`${total} node(s) match current filters / ${total} total`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Limit to matching nodes' }));
    fireEvent.change(screen.getByLabelText('Name pattern (regular expression)'), { target: { value: 'Kifisia' } });
    expect(await screen.findByText(`2 node(s) match current filters / ${total} total`)).toBeInTheDocument();
    expect(nonGet()).toEqual([]);
  });

  it('Airtime cutoff lists the contributors and the skipped nodes today\'s status names', async () => {
    renderAutomations(`${AUTO}/airtime-cutoff`, {
      fixtures: {
        'GET /api/automation/airtime-status': () => ({
          threshold: 30, source: 'neighbors', channelUtilization: 12.5, sampleCount: 2, targetCount: 3, gated: false, neighborAverage: 12.5, localChannelUtilization: 9,
          contributors: [{ nodeNum: 1, nodeId: '!00000001', longName: 'Hymettus Relay', shortName: 'HYMR', rssi: -88, channelUtilization: 12.5 }],
          skipped: [{ nodeNum: 2, nodeId: '!00000002', longName: 'Penteli Hiker', shortName: null, reason: 'mqtt' }],
        }),
      },
    });
    expect(await screen.findByText('Infrastructure nodes in calculation')).toBeInTheDocument();
    expect(screen.getByText('Hymettus Relay')).toBeInTheDocument();
    expect(screen.getByText('12.5% · -88 dBm')).toBeInTheDocument();
    expect(screen.getByText(/Penteli Hiker \(heard over MQTT\)/)).toBeInTheDocument();
  });

  it('the responder\'s pattern examples fill the trigger\'s pattern', async () => {
    renderAutomations(`${AUTO}/auto-responder`);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
    const sheet = await screen.findByRole('dialog', { name: 'ping' });
    fireEvent.click(within(sheet).getByRole('button', { name: /Pattern Examples & Templates/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: /^status, status \{nodeid\}/ }));
    expect(within(sheet).getByLabelText('Pattern')).toHaveValue('status, status {nodeid}');
  });

  it('the script test sends today\'s whole test context and lists its environment', async () => {
    const { log } = renderAutomations(`${AUTO}/geofence-triggers`);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
    const sheet = await screen.findByRole('dialog', { name: 'Kifisia home' });
    fireEvent.change(within(sheet).getByLabelText('Geofence Event'), { target: { value: 'exit' } });
    fireEvent.change(within(sheet).getByLabelText('From Long Name'), { target: { value: 'Athens Rover' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Environment Variables' }));
    expect(within(sheet).getByText('GEOFENCE_EVENT')).toBeInTheDocument();
    expect(within(sheet).getByText('LONG_NAME').nextElementSibling).toHaveTextContent('Athens Rover');
    fireEvent.click(await enabled(/Run Test/, within(sheet)));
    await waitFor(() => expect(writes(log, '/api/scripts/test')).toHaveLength(1));
    expect(writes(log, '/api/scripts/test')[0].body).toEqual({
      script: '/data/scripts/weather.py', triggerType: 'geofence',
      mockNode: { nodeNum: 12345, shortName: 'TEST', longName: 'Athens Rover', lat: 37.7749, lon: -122.4194 },
      geofenceName: 'Kifisia home', geofenceId: 'g2', eventType: 'exit', nodeLat: 37.7749, nodeLon: -122.4194,
    });
  });
});

describe('I2: Delete asks first', () => {
  it.each([
    ['auto-responder', 'Remove Trigger', /The trigger is removed from the list now and deleted when you save\. weather \{location\}/],
    ['timer-triggers', 'Remove timer?', /The trigger is removed from the list now and deleted when you save\. Morning net/],
    ['geofence-triggers', 'Remove Geofence Trigger', /Are you sure you want to remove "Lycabettus hill"\?/],
  ])('%s: Delete opens today\'s confirm; Cancel keeps it, Enter does nothing, Remove removes it', async (id, title, words) => {
    renderAutomations(`${AUTO}/${id}`);
    const before = (await screen.findAllByRole('button', { name: 'Delete' })).length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    let sheet = await screen.findByRole('dialog', { name: title });
    expect(within(sheet).getByText(words)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: title })).toBeNull());
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(before);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    sheet = await screen.findByRole('dialog', { name: title });
    fireEvent.keyDown(sheet, { key: 'Enter' });
    await settle();
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(before);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(before - 1));
    // Removing is a draft edit: nothing is sent until Save.
    expect(nonGet()).toEqual([]);
  });
});

describe('I3: Send now quotes what the server sends', () => {
  it('the confirm shows the saved message and channels, and says unsaved edits are not sent', async () => {
    const { log } = renderAutomations(`${AUTO}/auto-announce`);
    const message = await screen.findByLabelText('Announcement Message');
    fireEvent.change(message, { target: { value: 'An unsaved draft' } });
    fireEvent.click(await enabled('Send Now'));
    const sheet = await screen.findByRole('dialog', { name: 'Send Now' });
    expect(await within(sheet).findByText('MeshMonitor at Station G2, 12 nodes online.')).toBeInTheDocument();
    expect(within(sheet).queryByText(/An unsaved draft/)).toBeNull();
    expect(within(sheet).getByText('Send now sends 1 announcement now, on LongFast')).toBeInTheDocument();
    expect(within(sheet).getByText(/Your unsaved edits are not sent/)).toBeInTheDocument();
    fireEvent.click(await enabled('Send Now', within(sheet)));
    await waitFor(() => expect(writes(log, '/api/announce/send')).toHaveLength(1));
    expect(nonGet()).toHaveLength(1);
  });

  it('with nothing unsaved the confirm has no unsaved note', async () => {
    renderAutomations(`${AUTO}/auto-announce`);
    fireEvent.click(await enabled('Send Now'));
    const sheet = await screen.findByRole('dialog', { name: 'Send Now' });
    await within(sheet).findByText('MeshMonitor at Station G2, 12 nodes online.');
    expect(within(sheet).queryByText(/Your unsaved edits are not sent/)).toBeNull();
  });
});

describe('IB minors', () => {
  it('M1: a polled session list never reads as a change; an edit undone leaves no change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let n = 0;
      renderAutomations(`${AUTO}/auto-ping`, {
        fixtures: {
          'GET /api/settings/auto-ping': () => ({
            settings: { autoPingEnabled: true, autoPingIntervalSeconds: 30, autoPingMaxPings: 20, autoPingTimeoutSeconds: 60 },
            sessions: [{ nodeNum: 0xa1b2c302, requestedByName: 'Athens Rover', totalPings: 5, completedPings: ++n, successfulPings: n, failedPings: 0, startTime: Date.now() }],
          }),
        },
      });
      const max = await screen.findByLabelText('Max Pings Per Session');
      fireEvent.change(max, { target: { value: '10' } });
      fireEvent.blur(max);
      expect(await screen.findByText('1 change in Auto Ping')).toBeInTheDocument();
      fireEvent.change(max, { target: { value: '20' } });
      fireEvent.blur(max);
      await vi.advanceTimersByTimeAsync(11_000);
      expect(requests('GET', '/api/settings/auto-ping')).toBeGreaterThan(1);
      expect(screen.queryByText(/change in Auto Ping/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('M2: Forwarding saves today\'s two requests once (master switch PUT, rules POST)', async () => {
    renderAutomations(`${AUTO}/forwarding`);
    fireEvent.click(await screen.findByRole('switch', { name: 'Forwarding' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const sheet = await screen.findByRole('dialog', { name: 'To Heltec' });
    fireEvent.change(within(sheet).getByLabelText('Prefix (optional)'), { target: { value: '[fwd] ' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    fireEvent.click(await enabled('Save'));
    await waitFor(() => expect(nonGet()).toHaveLength(2));
    await settle();
    expect(nonGet()).toEqual([
      { method: 'PUT', path: '/api/sources/src-g2/forwarding/enabled' },
      { method: 'POST', path: '/api/sources/src-g2/forwarding' },
    ]);
  });

  it('M2: Timer Triggers saves today\'s one request once, the edited timer finalised', async () => {
    const { log } = renderAutomations(`${AUTO}/timer-triggers`);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const sheet = await screen.findByRole('dialog', { name: 'Morning net' });
    fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: '  Dawn net  ' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    fireEvent.click(await enabled('Save'));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    const saved = JSON.parse((writes(log, '/api/settings')[0].body as { timerTriggers: string }).timerTriggers);
    expect(saved.map((x: { name: string }) => x.name)).toEqual(['Dawn net', 'Evening net']);
    await settle();
    expect(nonGet()).toHaveLength(1);
  });

  it('M3: a rule switch sends one request, however fast it is pressed again', async () => {
    renderAutomations();
    const sw = await screen.findByRole('switch', { name: 'Weather bot' });
    fireEvent.click(sw);
    fireEvent.click(sw);
    await settle(200);
    expect(nonGet().filter((r) => r.path.startsWith('/api/automations/'))).toHaveLength(1);
  });

  it('M4: the door saves every changed built-in and names the ones that failed', async () => {
    renderAutomations(AUTO, {
      fixtures: { 'POST /api/settings/auto-ping': () => new Response(JSON.stringify({ error: 'Nope' }), { status: 500, headers: { 'content-type': 'application/json' } }) },
    });
    await screen.findByText('Weather bot');
    fireEvent.click(screen.getByRole('link', { name: /^12 more/ }));
    await screen.findByText('4 ignored');
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Ping' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Auto Welcome' }));
    fireEvent.click(await enabled('Save'));
    expect(await screen.findByText(/Saved: Auto Welcome\. Not saved: Auto Ping \(/)).toBeInTheDocument();
  });

  it('M5: Delete by Distance shows and takes its threshold in the viewer\'s unit, storing km', async () => {
    const { log } = renderAutomations(`${AUTO}/auto-delete-by-distance`, {
      fixtures: { 'GET /api/settings': () => ({ ...A.settings, ...g2AutomationSettings, distanceUnit: 'mi' }) },
    });
    const input = await screen.findByLabelText('Distance Threshold (mi)');
    expect(input).toHaveValue(93);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.blur(input);
    fireEvent.click(await enabled('Save'));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    expect((writes(log, '/api/settings')[0].body as Record<string, string>).autoDeleteByDistanceThresholdKm).toBe('160.9');
  });

  it('M6: Timer Triggers can be searched and filtered by type; the responder by type', async () => {
    const { unmount } = renderAutomations(`${AUTO}/timer-triggers`);
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'evening' } });
    expect(screen.queryByText('Morning net')).toBeNull();
    expect(screen.getByText('Evening net')).toBeInTheDocument();
    unmount();
    renderAutomations(`${AUTO}/auto-responder`);
    await screen.findByText('weather {location}');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by type' }), { target: { value: 'mailbox' } });
    expect(screen.queryByText('weather {location}')).toBeNull();
    expect(screen.getByText('mail')).toBeInTheDocument();
  });

  it('M6: Auto Favorite warns when the node\'s role cannot favourite, as today', async () => {
    renderAutomations(`${AUTO}/auto-favorite`, {
      fixtures: { 'GET /api/auto-favorite/status': () => ({ localNodeRole: 0, firmwareVersion: '2.7.15', supportsFavorites: true, autoFavoriteNodes: [] }) },
    });
    expect(await screen.findByText(/Auto Favorite requires Router, Router Late, or Client Base/)).toBeInTheDocument();
  });

  it('M6: the admin scanner re-reads its counts every 30 s while it is on, on its page only', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderAutomations(`${AUTO}/remote-admin-scanner`);
      await screen.findByText('Recent Scan Results');
      const first = requests('GET', '/api/nodes');
      await vi.advanceTimersByTimeAsync(31_000);
      expect(requests('GET', '/api/nodes')).toBe(first + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('M7: a channel-only responder trigger has no Verify response; a DM one does', async () => {
    renderAutomations(`${AUTO}/auto-responder`);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    let sheet = await screen.findByRole('dialog', { name: 'weather {location}' });
    expect(within(sheet).getByRole('switch', { name: 'Verify response' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Direct messages' }));
    expect(within(sheet).queryByRole('switch', { name: 'Verify response' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    sheet = await screen.findByRole('dialog', { name: 'weather {location}' });
    expect(within(sheet).getByRole('switch', { name: 'Verify response' })).toBeInTheDocument();
  });

  it('M9: Ignored Nodes is not counted as on', async () => {
    renderAutomations(`${AUTO}/builtins`);
    await screen.findByText('4 ignored');
    const data = screen.getByRole('region', { name: 'Data' });
    // Remote LocalStats, Remote Admin Scanner and Auto Delete by Distance are on; Traceroute is off; Ignored Nodes is a list.
    expect(within(data).getByText('3 on')).toBeInTheDocument();
  });

  it('M10: Auto Acknowledge\'s words edit today\'s pattern, and the response cap reads "2 other nodes, then quiet"', async () => {
    const { log } = renderAutomations(`${AUTO}/auto-acknowledge`);
    expect(await screen.findByText(/2 other nodes, then quiet/)).toBeInTheDocument();
    const words = screen.getByRole('region', { name: 'When the message says' });
    fireEvent.click(within(words).getByRole('button', { name: 'Remove test' }));
    fireEvent.change(within(words).getByLabelText('Add word'), { target: { value: 'radio check' } });
    fireEvent.keyDown(within(words).getByLabelText('Add word'), { key: 'Enter' });
    expect(screen.getByLabelText('Trigger Pattern (regular expression)')).toHaveValue('^(ping|radio check)');
    fireEvent.click(await enabled('Save'));
    await waitFor(() => expect(writes(log, '/api/settings')).toHaveLength(1));
    expect((writes(log, '/api/settings')[0].body as Record<string, string>).autoAckRegex).toBe('^(ping|radio check)');
  });
});
