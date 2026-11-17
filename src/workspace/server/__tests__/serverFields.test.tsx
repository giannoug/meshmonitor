/**
 * @vitest-environment jsdom
 *
 * Settings search over Server › General (Task 6.4, s13n0): SERVER_FIELDS
 * lists exactly the rows the page draws, and a hit opens the page at its row.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SERVER_FIELDS } from '../serverFields';
import { renderServer } from './serverHarness';

const rowIds = () => Array.from(document.querySelectorAll('[data-setting-id]'), (el) => el.getAttribute('data-setting-id')).sort();

describe('Server › General in settings search', () => {
  it('SERVER_FIELDS lists every setting row of /server/general', async () => {
    renderServer('/server/general');
    await screen.findByText('Destination retention cap');
    expect(rowIds()).toEqual(SERVER_FIELDS.filter((f) => f.page === 'general').map((f) => f.id).sort());
  });

  it('finds the default landing page and opens General at that row', async () => {
    renderServer('/server/backup');
    await screen.findByRole('heading', { name: 'Backup & maintenance' });
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'landing page' } });
    const hit = d.getByRole('option', { name: /Default Landing Page/ });
    expect(hit).toHaveAttribute('href', '/server/general#setting-general.defaultLandingPage');
    fireEvent.click(hit);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/server/general#setting-general.defaultLandingPage'));
    // General loads lazily and waits for the settings read: allow for a busy run.
    await waitFor(() => expect(document.querySelector('[data-setting-id="general.defaultLandingPage"]')).toHaveAttribute('data-pulse', 'true'), { timeout: 4000 });
  });

  it('a section hit for a page that moved lands on its Workspace page', async () => {
    renderServer('/server/backup');
    await screen.findByRole('heading', { name: 'Backup & maintenance' });
    fireEvent.keyDown(document, { key: ',', metaKey: true });
    const d = within(await screen.findByRole('dialog', { name: 'Search settings' }));
    fireEvent.change(d.getByRole('combobox', { name: 'Search settings' }), { target: { value: 'apprise' } });
    expect(d.getByRole('option', { name: /Apprise API Server/ })).toHaveAttribute('href', '/server/notification-services');
  });
});
