/**
 * @vitest-environment jsdom
 *
 * Board 8-08 (desktop): a MeshCore radio's Settings › Radio (Task 7.4) on the
 * row kit: the sidebar's On the radio and In MeshMonitor lists, Radio
 * parameters with "was" badges, Companion (Multi-ACKs, BLE PIN), and the dock
 * "N changes in Radio · Save radio settings". Also the simple radio pages
 * (Name, TX power, Telemetry) and their one request per save.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { HELTEC, renderMeshCore } from './renderMeshCore';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./mocks')).wsMock(orig));

const writes = (log: { writes: Array<{ method: string; path: string; body: unknown }> }, tail: string) =>
  log.writes.filter((w) => w.method !== 'GET' && w.path.endsWith(tail));

describe('8-08-settings-radio', () => {
  it('8-08-settings-radio shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderMeshCore(`${HELTEC}/settings/radio`);
    await screen.findByText('Multi-ACKs');
    // The board shows three edits queued: preset, bandwidth and spreading factor.
    fireEvent.change(screen.getByLabelText('Bandwidth (kHz)'), { target: { value: '250' } });
    expect(await screen.findByText('1 change in Radio')).toBeInTheDocument();
    expect(screen.getByText('Applies at once; nodes on the old settings stop hearing you. Sends nothing on the mesh.')).toBeInTheDocument();
    expectBoard('8-08-settings-radio', container);
  });

  it('lists the radio\'s pages by role, On the radio and In MeshMonitor, in the sidebar', async () => {
    renderMeshCore(`${HELTEC}/settings/radio`);
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await within(nav).findByRole('link', { name: 'Maintenance' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(expect.arrayContaining([
      'Name', 'Location', 'Radio', 'TX power', 'Telemetry', 'Path hash & scope', 'Sender names', 'Channels', 'Contacts',
      'Analyzer Observer', 'Console', 'Maintenance',
      'Connection', 'Receive-only', 'Reactions', 'Required repeaters', 'Regions', 'Display', 'Filters', 'Notifications',
    ]));
    // A Companion has no local repeater pages.
    expect(names).not.toContain('Adverts & forwarding');
    expect(names).not.toContain('Clock');
  });

  it('a local repeater adds Adverts & forwarding and Clock, and has no Companion pages', async () => {
    renderMeshCore(`${HELTEC}/settings/radio`, { meshcore: { deviceType: 2 } });
    const nav = await screen.findByRole('navigation', { name: 'Settings' });
    await within(nav).findByRole('link', { name: 'Adverts & forwarding' });
    expect(within(nav).getByRole('link', { name: 'Clock' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Path hash & scope' })).toBeNull();
    expect(within(nav).queryByRole('link', { name: 'Sender names' })).toBeNull();
    expect(screen.queryByText('Multi-ACKs')).toBeNull();
  });

  it('a radio save sends today\'s one setRadioParams request, once per press; opening and re-rendering send nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/radio`);
    await screen.findByText('Multi-ACKs');
    // Re-renders (an edit, then Discard) send nothing either.
    fireEvent.click(screen.getByRole('switch', { name: 'Multi-ACKs' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(log.writes).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Preset'), { target: { value: 'eu-uk-depr' } });
    const save = await screen.findByRole('button', { name: 'Save radio settings' });
    fireEvent.click(save);
    await waitFor(() => expect(writes(log, '/config/radio')).toHaveLength(1));
    expect(writes(log, '/config/radio')[0].body).toEqual({ freq: 869.525, bw: 250, sf: 11, cr: 5 });
    // Only what changed: no Multi-ACKs or PIN write.
    expect(log.writes).toHaveLength(1);
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(writes(log, '/config/radio')).toHaveLength(1);
  });

  it('Multi-ACKs carries today\'s airtime warning as its Sends line, and saves alone', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/radio`);
    await screen.findByText('Multi-ACKs');
    expect(screen.getByText(/Each received DM sends one extra ACK/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Multi-ACKs' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save radio settings' }));
    await waitFor(() => expect(writes(log, '/config/multi-acks')).toHaveLength(1));
    expect(writes(log, '/config/multi-acks')[0].body).toEqual({ value: 1 });
    expect(writes(log, '/config/radio')).toHaveLength(0);
  });

  it('Discard puts the saved values back and sends nothing', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/radio`);
    await screen.findByText('Multi-ACKs');
    fireEvent.change(screen.getByLabelText('Bandwidth (kHz)'), { target: { value: '250' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByText('1 change in Radio')).toBeNull());
    expect(screen.getByLabelText('Bandwidth (kHz)')).toHaveValue('62.5');
    expect(log.writes).toHaveLength(0);
  });

  it('without configuration:write the page is view only: no dock, controls off', async () => {
    renderMeshCore(`${HELTEC}/settings/radio`, {
      permissions: { bySource: { 'src-heltec': { connection: { read: true, write: false }, configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    await screen.findByText('Radio parameters');
    expect(screen.getByLabelText('Preset')).toBeDisabled();
    expect(screen.getByText("You don't have permission to change configuration for this source.")).toBeInTheDocument();
  });
});

describe('the simple radio pages (s8n4: Name, TX power, Telemetry)', () => {
  it('a name save sends today\'s one request, once per press', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/name`);
    const field = await screen.findByLabelText('Name');
    expect(log.writes).toHaveLength(0);
    fireEvent.change(field, { target: { value: 'Heltec Athens' } });
    expect(screen.getByText('Writes the name to the radio; your next advert carries it. Sends nothing on the mesh.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(writes(log, '/config/name')).toHaveLength(1));
    expect(writes(log, '/config/name')[0].body).toEqual({ name: 'Heltec Athens' });
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(log.writes).toHaveLength(1);
  });

  it('TX power saves today\'s one request with the new power', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/tx-power`);
    await screen.findByLabelText('Power (dBm)');
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save TX power' }));
    await waitFor(() => expect(writes(log, '/config/tx-power')).toHaveLength(1));
    expect(writes(log, '/config/tx-power')[0].body).toEqual({ power: 21 });
  });

  it('Telemetry writes the three modes one after another, as today (#5773)', async () => {
    const { log } = renderMeshCore(`${HELTEC}/settings/telemetry`);
    fireEvent.change(await screen.findByLabelText('Environment telemetry'), { target: { value: 'always' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save telemetry settings' }));
    await waitFor(() => expect(log.writes.filter((w) => w.path.includes('/config/telemetry-mode-'))).toHaveLength(3));
    expect(log.writes.map((w) => w.path.split('/').pop())).toEqual(['telemetry-mode-base', 'telemetry-mode-loc', 'telemetry-mode-env']);
  });
});
