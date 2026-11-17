/**
 * @vitest-environment jsdom
 *
 * Settings search over You › Preferences (Task 6.3 fix round 1, s13n0):
 * PREF_FIELDS lists exactly the rows each page draws, and a search hit opens
 * the page at its row, which scrolls into view and pulses.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { PREF_FIELDS } from '../prefFields';
import { SOURCE_IDS } from '../../../__fixtures__/athens';
import { renderPrefs } from './prefsHarness';

const rowIds = () => Array.from(document.querySelectorAll('[data-setting-id]'), (el) => el.getAttribute('data-setting-id')).sort();

describe('Preferences in settings search', () => {
  it.each([
    ['language', 'Time Format'],
    ['appearance', 'Official Pin Color'],
    ['map', 'Map Click Zoom Gate'],
    ['meshcore-messaging', 'Remote CLI reply timeout (seconds)'],
  ])('PREF_FIELDS lists every row of /preferences/%s', async (page, text) => {
    renderPrefs(`/preferences/${page}`);
    await screen.findByText(text);
    expect(rowIds()).toEqual(PREF_FIELDS.filter((f) => f.page === page).map((f) => f.id).sort());
  });

  it('finds a row of another page and opens it at that row', async () => {
    renderPrefs('/preferences/map');
    await screen.findByText('Map Click Zoom Gate');
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'distance unit' } });
    const hit = within(d.getByRole('group', { name: 'Preferences' })).getByRole('option', { name: /Distance Unit/ });
    expect(hit).toHaveAttribute('href', '/preferences/language#setting-units.distanceUnit');
    fireEvent.click(hit);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/preferences/language#setting-units.distanceUnit'));
    await waitFor(() => expect(document.querySelector('[data-setting-id="units.distanceUnit"]')).toHaveAttribute('data-pulse', 'true'));
  });

  it('finds the MeshCore and link preview rows; the admin-only row only for admins', async () => {
    renderPrefs('/preferences/language', { permissions: { global: {}, bySource: { [SOURCE_IDS.g2]: { settings: { read: true, write: true } } } } });
    await screen.findByText('Time Format');
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    const box = d.getByRole('combobox', { name: 'Search settings' });
    fireEvent.change(box, { target: { value: 'retry' } });
    expect(d.getByRole('option', { name: /Auto-retry automated MeshCore channel sends/ })).toHaveAttribute(
      'href',
      '/preferences/meshcore-messaging#setting-meshcore-messaging.meshcoreChannelRetryEnabled',
    );
    fireEvent.change(box, { target: { value: 'link previews' } });
    expect(d.getByRole('option', { name: /Show link previews/ })).toHaveAttribute('href', '/preferences/language#setting-link-previews.linkPreviewsEnabled');
    fireEvent.change(box, { target: { value: 'landing page' } });
    expect(d.queryByRole('option', { name: /Default Landing Page/ })).toBeNull();
  });
});
