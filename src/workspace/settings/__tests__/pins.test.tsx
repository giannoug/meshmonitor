/**
 * @vitest-environment jsdom
 *
 * Pins and the list's own search (Task 5.4, spec "Pinned" and "Search"):
 * the ☆ on a category header pins it; pins are category ids in the user's
 * `settings.pins` preference, so they follow the user to every device that
 * has the category. The search field at the top of the settings list filters
 * that list and offers "Search everywhere", which opens ⌘, search with the
 * same words.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { prefsFixture } from '../../__fixtures__/prefsFixture';
import { g2, goTo, mqtt, realUrl, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const nav = () => screen.findByRole('navigation', { name: 'Settings' }, { timeout: 5000 });
const pinnedList = () => within(screen.getByRole('navigation', { name: 'Settings' })).queryByRole('list', { name: 'Pinned' });

describe('pins', () => {
  it('the ☆ on a category header pins it, and pins follow the user to another device', async () => {
    const prefs = prefsFixture();
    renderSettings(`${g2}/settings/node-display`, { fixtures: prefs.fixtures });
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    await nav();
    expect(pinnedList()).toBeNull();
    const star = screen.getByRole('button', { name: 'Pin Node Display' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(star);
    await waitFor(() => expect(prefs.puts).toEqual([['settings.pins', ['node-display']]]));
    await waitFor(() => expect(pinnedList()).not.toBeNull());
    expect(within(pinnedList()!).getByRole('link', { name: 'Node Display' })).toHaveAttribute('href', `${g2}/settings/node-display`);
    expect(screen.getByRole('button', { name: 'Pin Node Display' })).toHaveAttribute('aria-pressed', 'true');

    goTo(`${mqtt}/settings/telemetry`);
    await screen.findByRole('heading', { level: 1, name: 'Telemetry' });
    await waitFor(() => expect(within(pinnedList()!).getByRole('link', { name: 'Node Display' })).toHaveAttribute('href', `${mqtt}/settings/node-display`));

    goTo(`${mqtt}/settings/node-display`);
    fireEvent.click(await screen.findByRole('button', { name: 'Pin Node Display', pressed: true }));
    await waitFor(() => expect(prefs.puts.at(-1)).toEqual(['settings.pins', []]));
    await waitFor(() => expect(pinnedList()).toBeNull());
  });

  it('the phone page bar carries the ☆ too', async () => {
    const prefs = prefsFixture({ 'settings.pins': ['lora'] });
    renderSettings(`${g2}/settings/node-display`, { phone: true, fixtures: prefs.fixtures });
    fireEvent.click(await screen.findByRole('button', { name: 'Pin Node Display' }, { timeout: 5000 }));
    await waitFor(() => expect(prefs.puts).toEqual([['settings.pins', ['lora', 'node-display']]]));
  });

  it('an anonymous viewer has no ☆ (no preferences to write)', async () => {
    renderSettings(`${g2}/settings/node-display`, {
      anonymous: true,
      permissions: { bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: false } } } },
    });
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: /^Pin / })).toBeNull();
  });
});

describe('the list\'s search field', () => {
  it('filters the list to this device\'s categories and offers Search everywhere', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const field = screen.getByRole('searchbox', { name: 'Search settings' });
    expect(field).toHaveAttribute('placeholder', 'Search Station G2 settings');
    fireEvent.change(field, { target: { value: 'gps' } });
    const list = await nav();
    expect(within(list).getAllByRole('link').map((a) => a.textContent)).toEqual(['Position']);
    expect(within(list).getByRole('link', { name: 'Position' })).toHaveAttribute('href', `${g2}/settings/device/position`);
    fireEvent.click(within(list).getByRole('button', { name: 'Search everywhere' }));
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    expect(d.getByRole('combobox', { name: 'Search settings' })).toHaveValue('gps');
    expect(d.getByRole('group', { name: 'Rooftop RAK' })).toBeInTheDocument();
  });

  it('with no match it says so and still offers Search everywhere', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), { target: { value: 'theme' } });
    const list = await nav();
    expect(within(list).getByText('No matching sections')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Search everywhere' })).toBeInTheDocument();
  });

  it('the query clears after navigating away by another route (rail, link, back)', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const field = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(field, { target: { value: 'mqtt' } });
    expect(field).toHaveValue('mqtt');
    goTo(`${g2}/settings/telemetry`);
    await screen.findByRole('heading', { level: 1, name: 'Telemetry' });
    expect(screen.getByRole('searchbox', { name: 'Search settings' })).toHaveValue('');
  });

  it('following a filtered row clears the field', async () => {
    renderSettings(`${g2}/settings/node-display`);
    await screen.findByRole('heading', { level: 1, name: 'Node Display' }, { timeout: 5000 });
    const field = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(field, { target: { value: 'mqtt' } });
    fireEvent.click(within(await nav()).getByRole('link', { name: 'MQTT' }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/modules/mqtt`));
    expect(field).toHaveValue('');
  });

  it('the phone list page has the field without a shortcut hint (b-set-p1-list)', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings`, { phone: true });
    const field = await screen.findByRole('searchbox', { name: 'Search settings' }, { timeout: 5000 });
    expect(field).toHaveAttribute('placeholder', 'Search settings');
    expect(container.textContent).not.toContain('⌘,');
  });
});
