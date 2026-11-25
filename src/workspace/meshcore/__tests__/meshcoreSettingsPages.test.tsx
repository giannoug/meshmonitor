/**
 * @vitest-environment jsdom
 *
 * Task 7.4 fix round 1 (Ruling HK): the pages s8n4 lists, on the row kit, each
 * saving from its own bar with today's request(s), once per press; no Classic
 * section or SaveBar inside the Workspace frame; a local repeater's settings
 * read once while its settings stay open; role facts outlive the frame; the
 * channel key masked until Show.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { HELTEC, renderMeshCore, requests } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const posted: unknown[] = [];
const fixtures = {
  'POST /api/settings': (u: URL, init?: RequestInit) => {
    if (u.searchParams.get('sourceId') !== SOURCE_IDS.heltec && !u.pathname.endsWith('/api/settings')) return undefined;
    posted.push({ path: `${u.pathname}${u.search}`, body: JSON.parse(String(init?.body)) });
    return { success: true };
  },
  'PUT /api/sources/:id': (u: URL, init?: RequestInit) => {
    if (!u.pathname.endsWith(SOURCE_IDS.heltec)) return undefined;
    posted.push({ path: u.pathname, body: JSON.parse(String(init?.body)) });
    return { success: true };
  },
};
const pause = () => act(async () => new Promise((r) => setTimeout(r, 60)));
const classic = () => document.querySelector('.form-section, .danger-zone, .save-bar, [class*="SaveBar"]');

describe('the s8n4 pages save from their own bar (Ruling HK)', () => {
  it('Filters: a new rule is one create request per press; the editor is guarded until saved', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/filters`, { fixtures });
    fireEvent.click(await screen.findByRole('button', { name: /Add filter/ }));
    fireEvent.change(await screen.findByLabelText('Pattern'), { target: { value: 'spam*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.endsWith('/message-filters'))).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ method: 'POST', body: { pattern: 'spam*', mode: 'ignore', matchType: 'wildcard' } });
    await pause();
    expect(log.writes).toHaveLength(1);
    expect(classic()).toBeNull();
  });

  it('Filters: an edited rule is one update; opening and the list send nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/filters`, { fixtures });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit rule buy *' }));
    expect(log.writes).toHaveLength(0);
    fireEvent.click(screen.getByRole('switch', { name: 'Case sensitive' }));
    expect(await screen.findByText('1 change in Filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ method: 'PUT', path: `/api/sources/${SOURCE_IDS.heltec}/meshcore/message-filters/f1` });
  });

  it('Display: one settings request per changed group, once per press', async () => {
    posted.length = 0;
    renderMeshCore(`${HELTEC}/settings/display`, { fixtures });
    const field = await screen.findByLabelText('Node list & map window (hours)');
    fireEvent.change(field, { target: { value: '48' } });
    fireEvent.blur(field);
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ path: `/api/settings?sourceId=${SOURCE_IDS.heltec}`, body: { maxNodeAgeHours: '48' } });
    await pause();
    expect(posted).toHaveLength(1);
    expect(classic()).toBeNull();
  });

  it('Display: Purge all messages asks with today\'s words; Enter does not confirm; the button sends once', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/display`, { fixtures });
    fireEvent.click(await screen.findByRole('button', { name: 'Purge all messages' }));
    const sheet = await screen.findByRole('dialog', { name: 'Purge all messages' });
    expect(within(sheet).getByText('Delete ALL MeshCore messages (every channel and DM) for this source? This cannot be undone.')).toBeInTheDocument();
    const confirm = within(sheet).getByRole('button', { name: 'Purge all messages' });
    // submitOnEnter={false}: the confirm is a plain button, not the form's submit.
    expect(confirm).toHaveAttribute('type', 'button');
    fireEvent.submit(sheet.querySelector('form')!);
    await pause();
    expect(requests('DELETE', /\/meshcore\/messages$/)).toBe(0);
    fireEvent.click(confirm);
    // Exactly today's one request.
    await waitFor(() => expect(requests('DELETE', /\/meshcore\/messages$/)).toBe(1));
    await pause();
    expect(requests('DELETE', /\/meshcore\/messages$/)).toBe(1);
    expect(log.writes.filter((w) => w.method === 'DELETE')).toHaveLength(1);
  });

  it('Observer: the Publish switch saves from the bar with today\'s one source update', async () => {
    posted.length = 0;
    renderMeshCore(`${HELTEC}/settings/observer`, { fixtures });
    fireEvent.click(await screen.findByRole('switch', { name: 'Publish heard packets to a MeshCore Analyzer broker' }));
    expect(await screen.findByText('1 change in Analyzer Observer')).toBeInTheDocument();
    // A complete config: a broker from today's presets and the region code.
    fireEvent.change(screen.getByLabelText('Add a broker'), { target: { value: 'meshmapper' } });
    fireEvent.change(screen.getByLabelText(/IATA|Region/), { target: { value: 'ATH' } });
    expect(posted).toHaveLength(0);
    expect(screen.getByText('Publishes over the internet; the brokers reconnect once. Sends nothing on the mesh.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ path: `/api/sources/${SOURCE_IDS.heltec}` });
    await pause();
    expect(posted).toHaveLength(1);
    expect(classic()).toBeNull();
  });

  it('Path hash & scope: only the changed setting is written, once', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/path-scope`, { fixtures });
    fireEvent.change(await screen.findByLabelText('Default path hash size'), { target: { value: '2' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ method: 'POST', path: `/api/sources/${SOURCE_IDS.heltec}/meshcore/config/default-path-hash-size` });
  });

  it('Reactions: one request per changed setting; Auto-Acknowledge\'s is global', async () => {
    posted.length = 0;
    renderMeshCore(`${HELTEC}/settings/reactions`, { fixtures });
    fireEvent.click(await screen.findByRole('switch', { name: 'Auto-Acknowledge may answer reactions (all MeshCore sources)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toEqual({ path: '/api/settings', body: { meshcoreReactionsAckOnReceive: true } });
  });
});

describe('a local repeater', () => {
  const repeater = { meshcore: { deviceType: 2 }, fixtures };

  it('Adverts & forwarding saves the changed field in one request', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/adverts`, repeater);
    await screen.findByText('Flood hop limit');
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save repeater settings' }));
    await waitFor(() => expect(log.writes).toHaveLength(1));
    expect(log.writes[0]).toMatchObject({ method: 'PATCH', path: `/api/sources/${SOURCE_IDS.heltec}/meshcore/config/repeater-settings`, body: { floodMax: 9 } });
  });

  it('Access is its own page', async () => {
    renderMeshCore(`${HELTEC}/settings/access`, repeater);
    expect(await screen.findByText('Guest password')).toBeInTheDocument();
    expect(screen.getByText('Allow read-only login')).toBeInTheDocument();
  });

  it('reads its settings once while its settings stay open (Adverts → Access → Maintenance)', async () => {
    renderMeshCore(`${HELTEC}/settings/adverts`, repeater);
    await screen.findByText('Flood hop limit');
    fireEvent.click(screen.getByRole('link', { name: 'Access' }));
    await screen.findByText('Guest password');
    fireEvent.click(screen.getByRole('link', { name: 'Maintenance' }));
    await screen.findByRole('button', { name: 'Reboot Device' });
    expect(requests('GET', /\/config\/repeater-settings$/)).toBe(1);
  });
});

describe('role facts outlive the frame (Ruling HL)', () => {
  it('after a repeater\'s settings close, search offers none of the Companion pages', async () => {
    renderMeshCore(`${HELTEC}/settings/adverts`, { meshcore: { deviceType: 2 } });
    await screen.findByText('Flood hop limit');
    fireEvent.click(screen.getByTestId('settings-back'));
    await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull());
    fireEvent.keyDown(document, { key: ',', ctrlKey: true, metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'path hash' } });
    expect(d.queryAllByRole('option').filter((o) => o.getAttribute('href')?.includes('/settings/path-scope'))).toHaveLength(0);
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'flood hop' } });
    expect(d.getAllByRole('option').some((o) => o.getAttribute('href')?.includes('/settings/adverts'))).toBe(true);
  });
});

describe('the channel key (Ruling HL)', () => {
  it('is hidden until Show, as today', async () => {
    renderMeshCore(`${HELTEC}/settings/channels`);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit ops' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Secret' }));
    const key = screen.getByLabelText('Secret (hex, 32 chars)');
    expect(key).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(key).toHaveAttribute('type', 'text');
  });
});

describe('this radio\'s Console, as 8-06 (Ruling HN)', () => {
  const route = `${HELTEC}/settings/console`;
  const cli = (log: { writes: Array<{ path: string; body: unknown }> }) => log.writes.filter((w) => w.path.endsWith('/meshcore/cli'));

  it('one command sends once, over the serial CLI', async () => {
    const { log } = renderMeshCore(route);
    const input = await screen.findByPlaceholderText(/Type a CLI command/);
    expect(screen.getByText(/advert, advert.zerohop and discover.neighbors transmit on the mesh/)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ver' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(cli(log)).toHaveLength(1));
    expect(cli(log)[0].body).toMatchObject({ command: 'ver' });
    expect(await screen.findByText('MeshCore v1.8.2')).toBeInTheDocument();
    await pause();
    expect(cli(log)).toHaveLength(1);
    expect(document.querySelector('.meshcore-remote-console, .mrc-modal')).toBeNull();
  });

  it('a danger command waits for the typed name; Enter and Cancel send nothing; the button sends once with confirm', async () => {
    const { log } = renderMeshCore(route);
    fireEvent.click(await screen.findByRole('button', { name: 'Reboot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    let sheet = await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    expect(cli(log)).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await pause();
    expect(cli(log)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reboot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    sheet = await screen.findByRole('dialog', { name: 'Confirm destructive command' });
    const word = within(sheet).getByRole('textbox');
    const confirm = within(sheet).getByRole('button', { name: 'Send reboot' });
    expect(confirm).toBeDisabled();
    fireEvent.change(word, { target: { value: 'Heltec MeshCore' } });
    fireEvent.submit(word.closest('form')!);
    fireEvent.keyDown(word, { key: 'Enter' });
    await pause();
    expect(cli(log)).toHaveLength(0);
    fireEvent.click(confirm);
    await waitFor(() => expect(cli(log)).toHaveLength(1));
    expect(cli(log)[0].body).toMatchObject({ command: 'reboot', confirm: true });
    await pause();
    expect(cli(log)).toHaveLength(1);
  });
});

describe('review round 2', () => {
  it('Observer: Cancel drops the pasted key (today)', async () => {
    renderMeshCore(`${HELTEC}/settings/observer`, { fixtures });
    fireEvent.click(await screen.findByRole('button', { name: /Enter key manually/ }));
    const field = screen.getByPlaceholderText('128-character hex private key');
    fireEvent.change(field, { target: { value: 'ab'.repeat(64) } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Enter key manually/ }));
    expect(screen.getByPlaceholderText('128-character hex private key')).toHaveValue('');
  });

  it('one radio sweep at a time: a node discovery holds region discovery, across pages', async () => {
    let release: () => void = () => {};
    const hang = {
      ...fixtures,
      // The reply comes only when the test releases it: the sweep stays in flight.
      'POST /api/sources/:id/meshcore/discover': () =>
        new Response(
          new ReadableStream({
            start(c) {
              release = () => {
                c.enqueue(new TextEncoder().encode(JSON.stringify({ success: true, returned: 0, new: 0, nodes: [] })));
                c.close();
              };
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    };
    renderMeshCore(`${HELTEC}/settings/contacts`, { fixtures: hang });
    fireEvent.click(await screen.findByRole('button', { name: 'Discover Nearby Nodes' }));
    await waitFor(() => expect(requests('POST', /\/meshcore\/discover$/)).toBe(1));
    // Leave for Path hash & scope while it runs: region discovery is held and sends nothing.
    fireEvent.click(screen.getByRole('link', { name: 'Path hash & scope' }));
    const regions = await screen.findByRole('button', { name: 'Discover regions from repeaters' });
    expect(regions).toBeDisabled();
    fireEvent.click(regions);
    await pause();
    expect(requests('POST', /\/regions\/discover$/)).toBe(0);
    // Back on Contacts (a remount) the node sweep still holds every Discover.
    fireEvent.click(screen.getByRole('link', { name: 'Contacts' }));
    expect(await screen.findByRole('button', { name: 'Discover Repeaters' })).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Discover Repeaters' })).not.toBeDisabled());
    expect(requests('POST', /\/meshcore\/discover$/)).toBe(1);
  });

  it('the Channels leave guard names the fields that changed', async () => {
    renderMeshCore(`${HELTEC}/settings/channels`);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit ops' }));
    fireEvent.change(await screen.findByLabelText('Region / Scope (optional)'), { target: { value: 'gr-att' } });
    fireEvent.click(screen.getByRole('link', { name: 'Radio' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/Region \/ Scope \(optional\)/)).toBeInTheDocument();
    expect(within(sheet).queryByText(/Secret \(hex, 32 chars\)/)).toBeNull();
  });
});

describe('W11 own-issues (#6365)', () => {
  it('node list to Settings keeps the one MeshCore runtime: one status and one snapshot read', async () => {
    renderMeshCore(`${HELTEC}/nodes`, { fixtures });
    await screen.findAllByRole('columnheader');
    await pause();
    const status = requests('GET', /\/meshcore\/status$/);
    const snapshot = requests('GET', /\/meshcore\/snapshot$/);
    expect(snapshot).toBe(1);
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    await screen.findByRole('navigation', { name: 'Settings' });
    await pause();
    expect(requests('GET', /\/meshcore\/status$/)).toBe(status);
    expect(requests('GET', /\/meshcore\/snapshot$/)).toBe(snapshot);
  });

  it('Observer: a typed broker password is gone after Cancel and reopening', async () => {
    const withBroker = {
      ...fixtures,
      'GET /api/sources': () =>
        athensFixture.sources.map((x) =>
          x.id === SOURCE_IDS.heltec ? { ...x, config: { ...x.config, observer: { enabled: true, iataCode: 'ATH', brokers: [{ url: 'mqtts://broker.example', authMode: 'password', label: 'Region broker' }] } } } : x),
      'GET /api/sources/:id/observer/status': () => ({
        success: true,
        data: {
          running: true, configured: true, authMode: 'password', keyStored: false, connected: true, publishes: 0, dropped: 0,
          lastPublishAt: null, lastError: null, tokenExpiresAt: null,
          brokers: [{ key: 'b1', url: 'mqtts://broker.example', label: 'Region broker', authMode: 'password', tokenAudience: null, configured: true,
            keyStored: false, connected: true, publishes: 0, dropped: 0, lastPublishAt: null, lastError: null, tokenExpiresAt: null }],
        },
      }),
    };
    renderMeshCore(`${HELTEC}/settings/observer`, { fixtures: withBroker });
    fireEvent.click(await screen.findByRole('button', { name: /Set username and password/ }));
    fireEvent.change(screen.getByPlaceholderText('Broker password'), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Set username and password/ }));
    expect(screen.getByPlaceholderText('Broker password')).toHaveValue('');
  });
});
