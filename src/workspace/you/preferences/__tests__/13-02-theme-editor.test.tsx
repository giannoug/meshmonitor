/**
 * @vitest-environment jsdom
 *
 * Boards 13-02 (desktop) and 13-19 (phone), Task 6.3: the custom theme
 * editor page over today's ThemeEditor logic (useThemeEditor). Update Theme
 * is today's PUT /api/themes/:slug; a new theme is today's POST; both need
 * themes:write.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expectBoard } from '../../../test/boardChecks';
import { renderPrefs } from './prefsHarness';

const EDIT = '/preferences/appearance/themes/custom-athens-night';

describe('13-02-theme-editor', () => {
  it('13-02-theme-editor shows the board', async () => {
    const { container } = renderPrefs(EDIT);
    await screen.findByDisplayValue('Athens Night');
    await screen.findByText('Accessibility Check');
    expectBoard('13-02-theme-editor', container);
  });

  it('13-19-theme-editor shows the board', async () => {
    const { container } = renderPrefs(EDIT, { phone: true });
    await screen.findByDisplayValue('Athens Night');
    await screen.findByText('Accessibility Check');
    expectBoard('13-19-theme-editor', container);
  });

  it('Update Theme saves the edited colour map with today\'s PUT, then goes back to Appearance', async () => {
    const { log } = renderPrefs(EDIT);
    await screen.findByDisplayValue('Athens Night');
    fireEvent.change(screen.getByLabelText('Accent hex'), { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Theme' }));
    await waitFor(() => expect(log.themes).toHaveLength(1));
    const [call] = log.themes;
    expect(call).toMatchObject({ method: 'PUT', path: '/api/themes/custom-athens-night' });
    expect(call.body).toMatchObject({ name: 'Athens Night', slug: 'custom-athens-night', definition: expect.objectContaining({ accent: '#123456' }) });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/preferences/appearance'));
  });

  it('the JSON editor shows the same theme and today\'s validation error inline', async () => {
    renderPrefs(EDIT);
    await screen.findByDisplayValue('Athens Night');
    fireEvent.click(screen.getByRole('radio', { name: 'JSON Editor' }));
    const json = screen.getByRole('textbox', { name: 'JSON Editor' }) as HTMLTextAreaElement;
    expect(JSON.parse(json.value)).toMatchObject({ accent: '#89b4fa' });
    fireEvent.change(json, { target: { value: '{' } });
    expect(await screen.findByText(/^Invalid JSON/)).toBeInTheDocument();
  });

  it('Clone starts a new theme from the custom one, saved with today\'s POST', async () => {
    const { log } = renderPrefs('/preferences/appearance/themes/new?from=custom-mesh-green');
    await screen.findByText('Create Custom Theme');
    fireEvent.change(screen.getByPlaceholderText('My Custom Theme'), { target: { value: 'Mesh green two' } });
    expect(screen.getByDisplayValue('custom-mesh-green-two')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Theme' }));
    await waitFor(() => expect(log.themes).toHaveLength(1));
    expect(log.themes[0]).toMatchObject({ method: 'POST', path: '/api/themes' });
    expect(log.themes[0].body).toMatchObject({ slug: 'custom-mesh-green-two', definition: expect.objectContaining({ accent: '#a6e3a1' }) });
  });

  it('without themes:write the save stays off', async () => {
    renderPrefs(EDIT, { permissions: { global: { themes: { read: true, write: false } }, bySource: {} } });
    // The editor opens on the list's slug; nothing can be saved.
    await screen.findByDisplayValue('Athens Night');
    expect(screen.getByRole('button', { name: 'Update Theme' })).toBeDisabled();
  });

  it('an unknown theme ends in Not found, not endless loading', async () => {
    renderPrefs('/preferences/appearance/themes/custom-nope');
    expect(await screen.findByText('Not found', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
