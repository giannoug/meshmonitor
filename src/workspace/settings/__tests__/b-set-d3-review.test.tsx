/**
 * @vitest-environment jsdom
 *
 * Board b-set-d3-review (desktop): Review changes lists the queue old → new by
 * category with each category's restart tag and Discard, then the restart
 * note, Keep editing and the labelled Save. Saving writes the categories one
 * after another through today's handlers and shows one RebootModal at the end;
 * a category that fails stays queued and is named. Mesh checklist 3: the save
 * writes no MeshMonitor setting, so the persisted lastAnnouncementTime is
 * untouched by it and by the reload after the restart.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, goTo, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

// What each write sent, in order.
const writes: string[] = [];
const saved = (name: string) => () => {
  writes.push(name);
  return { success: true };
};
const fixtures = (fail?: string) => ({
  'POST /api/config/lora': fail === 'lora' ? () => new Response(JSON.stringify({ error: 'Radio said no' }), { status: 500 }) : saved('lora'),
  'POST /api/config/device': saved('device'),
  'POST /api/config/owner': saved('owner'),
});

const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });

async function queueLoraAndDevice(fail?: string) {
  writes.length = 0;
  const view = renderSettings(`${g2}/settings/lora`, { fixtures: fixtures(fail) });
  const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(hops).toHaveValue(3));
  fireEvent.change(hops, { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Modem Preset'), { target: { value: '4' } });
  goTo(`${g2}/settings/device/device`);
  fireEvent.change(await screen.findByLabelText(/Rebroadcast Mode/, {}, { timeout: 5000 }), { target: { value: '2' } });
  goTo(`${g2}/settings/lora`);
  await screen.findByLabelText('Hop Limit');
  return view;
}

const openReview = async () => {
  fireEvent.click(within(await bar()).getByRole('button', { name: 'Review' }));
  return screen.findByRole('dialog', { name: 'Review changes' });
};

describe('b-set-d3-review', () => {
  it('b-set-d3-review shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    await queueLoraAndDevice();
    const sheet = await openReview();
    expect(sheet).toHaveTextContent('3 changes in 2 categories, sent to Station G2 one category at a time.');
    const lora = within(sheet).getByRole('region', { name: 'LoRa' });
    expect(within(lora).getByText('Hop Limit').closest('li')).toHaveTextContent('Hop Limit34');
    expect(within(lora).getByText('Modem Preset').closest('li')).toHaveTextContent('Modem PresetLONG_FASTMEDIUM_FAST');
    expect(within(lora).getByText('Restarts')).toBeInTheDocument();
    const device = within(sheet).getByRole('region', { name: 'Device' });
    expect(within(device).getByText('Rebroadcast Mode').closest('li')).toHaveTextContent('Rebroadcast ModeALLLOCAL_ONLY');
    expect(within(device).getByText('May restart')).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Station G2 restarts about 7 s after the last write and is offline for 30–60 s. One restart, not two.');
    expectBoard('b-set-d3-review', document.body);
  });

  it('a category\'s Discard drops only that category', async () => {
    await queueLoraAndDevice();
    const sheet = await openReview();
    fireEvent.click(within(within(sheet).getByRole('region', { name: 'Device' })).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(within(sheet).queryByRole('region', { name: 'Device' })).toBeNull());
    expect(await bar()).toHaveTextContent('2 changes in LoRa');
  });

  it('two queued categories save one after another, then one RebootModal', async () => {
    await queueLoraAndDevice();
    const sheet = await openReview();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save & restart' }));
    await waitFor(() => expect(writes).toEqual(['lora', 'device']));
    expect(await screen.findAllByText('Device Reboot')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unsaved radio changes' })).toBeNull());
  });

  it('a failed category stays queued and is named; the other saves', async () => {
    await queueLoraAndDevice('lora');
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Save & restart' }));
    await waitFor(() => expect(writes).toEqual(['device']));
    const region = await bar();
    await within(region).findByRole('alert');
    expect(within(region).getByRole('alert')).toHaveTextContent('Not saved: LoRa. Still queued.');
    expect(region).toHaveTextContent('2 changes in LoRa');
  });

  it('mesh checklist 3: saving writes no MeshMonitor setting, so lastAnnouncementTime stays as persisted', async () => {
    await queueLoraAndDevice();
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Save & restart' }));
    await waitFor(() => expect(writes).toEqual(['lora', 'device']));
    const calls = vi.mocked(fetch).mock.calls.map(([u, init]) => ({ url: String(u), method: init?.method ?? 'GET', body: String(init?.body ?? '') }));
    const sent = calls.filter((c) => c.method !== 'GET');
    expect(sent.map((c) => new URL(c.url, 'http://x').pathname)).toEqual(['/api/config/lora', '/api/config/device']);
    expect(sent.some((c) => c.url.includes('/api/settings') || c.body.includes('lastAnnouncementTime') || c.body.includes('autoAnnounce'))).toBe(false);
  });

  it('Identity alone saves with "Save (may restart)"', async () => {
    writes.length = 0;
    renderSettings(`${g2}/settings/identity`, { fixtures: fixtures() });
    const name = await screen.findByDisplayValue('Station G2', {}, { timeout: 5000 });
    fireEvent.change(name, { target: { value: 'Station G3' } });
    fireEvent.click(within(await bar()).getByRole('button', { name: 'Save (may restart)' }));
    await waitFor(() => expect(writes).toEqual(['owner']));
  });

  it('discarding the last category closes Review, and the next edit does not reopen it', async () => {
    renderSettings(`${g2}/settings/lora`, { fixtures: fixtures() });
    const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
    await waitFor(() => expect(hops).toHaveValue(3));
    fireEvent.change(hops, { target: { value: '4' } });
    const sheet = await openReview();
    fireEvent.click(within(within(sheet).getByRole('region', { name: 'LoRa' })).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByLabelText('Hop Limit'), { target: { value: '6' } });
    await bar();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
