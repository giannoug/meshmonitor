/**
 * @vitest-environment jsdom
 *
 * Board b-set-d4-search (desktop): ⌘, / Ctrl+, opens settings search anywhere
 * in the Workspace (⌘K stays message search). Results come per device the
 * viewer can open settings on, then Preferences and Global Settings: a field
 * on the open category (the row kit's registry) is a "Setting" and opens its
 * row, scrolled to and pulsed; every other match is today's section catalogue
 * ("Section"), which opens its category. A result that leaves the device's
 * settings with radio edits queued asks first (the leave guard).
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, mqtt, realUrl, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const rak = `/source/${SOURCE_IDS.rak}`;
const pins = { 'GET /api/user/preferences': () => ({ success: true, data: { preferences: { 'settings.pins': ['modules/mqtt', 'modules/storeforward'] } } }) };
const dialog = () => screen.findByRole('dialog', { name: 'Search settings' });
const queryDialog = () => screen.queryByRole('dialog', { name: 'Search settings' });

async function search(q: string) {
  fireEvent.keyDown(document, { key: ',', metaKey: true });
  const d = within(await dialog());
  fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: q } });
  return d;
}

async function loraLoaded() {
  const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(hops).toHaveValue(3));
  return hops;
}

describe('b-set-d4-search', () => {
  it('b-set-d4-search shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderSettings(`${g2}/settings/node-display`, { fixtures: pins });
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('hop');
    const g2Group = d.getByRole('group', { name: 'Station G2' });
    expect(within(g2Group).getByRole('option', { name: /LoRa/ })).toHaveTextContent('Section');
    expect(d.getByRole('group', { name: 'Rooftop RAK' })).toBeInTheDocument();
    expectBoard('b-set-d4-search', document.body);
  });

  it('⌘K does not open settings search, and ⌘, does not open message search', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(await screen.findByRole('dialog', { name: 'Search Messages' })).toBeInTheDocument();
    expect(queryDialog()).toBeNull();
    // One layer at a time: ⌘, does not open over message search.
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(await dialog()).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull();
  });

  it('Ctrl+, opens it off a Mac and shows Ctrl+,; it toggles; Escape closes it', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    expect(await dialog()).toHaveTextContent('Ctrl+,');
    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    await waitFor(() => expect(queryDialog()).toBeNull());
    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    fireEvent.keyDown(await dialog(), { key: 'Escape' });
    await waitFor(() => expect(queryDialog()).toBeNull());
  });

  it('opens anywhere in the Workspace, not only in settings', async () => {
    renderSettings(`${g2}/channel/0`);
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(await dialog()).toBeInTheDocument();
  });

  it('a field on the open category opens its row, scrolled to and pulsed', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    // Navigate to LoRa so its rows register, then search from there.
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Settings' })).getByRole('link', { name: 'LoRa' }));
    await loraLoaded();
    const d = await search('hop limit');
    const hit = within(d.getByRole('group', { name: 'Station G2' })).getByRole('option', { name: /^Hop Limit/ });
    expect(hit).toHaveTextContent('On the radio › LoRa');
    expect(hit).toHaveTextContent('Setting');
    fireEvent.click(hit);
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/lora#setting-lora.hopLimit`));
    expect(queryDialog()).toBeNull();
    const row = document.querySelector('[data-setting-id="lora.hopLimit"]')!;
    await waitFor(() => expect(row).toHaveAttribute('data-pulse'));
    expect(scroll).toHaveBeenCalled();
    fireEvent.animationEnd(row);
    expect(row).not.toHaveAttribute('data-pulse');
  });

  it('arrow keys move and Enter opens the chosen result', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('hop');
    const options = d.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    const input = d.getByRole('combobox', { name: 'Search settings' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
    // Heltec MeshCore's Device actions ("zero hop") ranks second since Task 7.4 searches MeshCore pages.
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(realUrl()).toBe(`${rak}/settings/lora`));
  });

  it('Preferences and Global Settings are searched too', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('theme');
    const prefs = d.getByRole('group', { name: 'Preferences' });
    expect(within(prefs).getByRole('option', { name: /^Appearance/ })).toHaveAttribute('href', '/preferences/appearance');
    // Task 6.3: every Preferences row is found too, and opens at that row.
    expect(within(prefs).getByRole('option', { name: /^Dark Theme/ })).toHaveAttribute('href', '/preferences/appearance#setting-appearance.darkTheme');
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'vacuum' } });
    expect(within(d.getByRole('group', { name: 'Global Settings' })).getByRole('option', { name: /Database Maintenance/ })).toHaveAttribute(
      'href',
      // Database Maintenance lives on Server › Backup & maintenance (Task 6.4).
      '/server/backup',
    );
  });

  it('never finds a category the viewer\'s grants hide; View only categories stay findable', async () => {
    renderSettings(`${g2}/settings/node-display`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('hop');
    expect(within(d.getByRole('group', { name: 'Station G2' })).getByRole('option', { name: /LoRa/ })).toBeInTheDocument();
    // Rooftop RAK and the MQTT broker are not readable.
    expect(d.queryByRole('group', { name: 'Rooftop RAK' })).toBeNull();
  });

  it('without configuration:read, the radio categories are not found', async () => {
    renderSettings(`${g2}/settings/node-display`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: false } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('lora');
    expect(d.queryByRole('option', { name: /LoRa/ })).toBeNull();
    expect(d.getByText('No matching settings')).toBeInTheDocument();
  });

  it('a result on another device with radio edits queued asks first (the leave guard), one sheet at a time', async () => {
    renderSettings(`${g2}/settings/lora`);
    fireEvent.change(await loraLoaded(), { target: { value: '5' } });
    const d = await search('node display');
    fireEvent.click(within(d.getByRole('group', { name: 'Athens MQTT' })).getByRole('option', { name: /Node Display/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(queryDialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(realUrl()).toBe(`${g2}/settings/lora`);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(realUrl()).toBe(`${mqtt}/settings/node-display`));
  });

  it('a result inside the same device\'s settings keeps the queued edits and never asks', async () => {
    renderSettings(`${g2}/settings/lora`);
    fireEvent.change(await loraLoaded(), { target: { value: '5' } });
    const d = await search('gps');
    fireEvent.click(within(d.getByRole('group', { name: 'Station G2' })).getByRole('option', { name: /Position/ }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/device/position`));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('region', { name: 'Unsaved radio changes' })).toHaveTextContent('1 change in LoRa');
  });
  it('ranks every result before the cap of 40, so a strong match in a later group survives', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const d = await search('s');
    expect(d.getAllByRole('option')).toHaveLength(40);
    expect(within(d.getByRole('group', { name: 'Preferences' })).getByRole('option', { name: /^Sorting/ })).toBeInTheDocument();
  });

  it('⌘, does not open over the Review sheet; Escape then closes only the sheet and unlocks the page', async () => {
    renderSettings(`${g2}/settings/lora`);
    fireEvent.change(await loraLoaded(), { target: { value: '5' } });
    const bar = await screen.findByRole('region', { name: 'Unsaved radio changes' });
    fireEvent.click(within(bar).getByRole('button', { name: 'Review' }));
    await screen.findByRole('dialog', { name: 'Review changes' });
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(queryDialog()).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
    // With nothing else open, ⌘, opens search again.
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    expect(await dialog()).toBeInTheDocument();
  });

  it('⌘, does not open over the leave guard\'s confirm sheet', async () => {
    renderSettings(`${g2}/settings/lora`);
    fireEvent.change(await loraLoaded(), { target: { value: '5' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Devices' })).getByRole('link', { name: /Athens MQTT/ }));
    await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    fireEvent.keyDown(document, { key: ',', ctrlKey: true });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(queryDialog()).toBeNull();
  });
});
