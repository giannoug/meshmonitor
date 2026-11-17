/**
 * @vitest-environment jsdom
 *
 * Boards 13-01 (desktop) and 13-15 (phone), Task 6.3: You › Appearance.
 * Today's Appearance rows save as you go to `POST /api/settings`; tapbacks
 * and custom themes are today's (Rule X hooks); destructive actions ask with
 * today's words.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../../test/boardChecks';
import { PREF_SETTINGS } from '../../../__fixtures__/preferences';
import { renderPrefs } from './prefsHarness';

const appearance = (opts = {}) => renderPrefs('/preferences/appearance', opts);

describe('13-01-appearance', () => {
  it('13-01-appearance shows the board', async () => {
    const { container } = appearance();
    await screen.findByText('Athens Night', { selector: 'span' });
    await screen.findByText('Official Pin Color');
    expectBoard('13-01-appearance', container);
  });

  it('13-15-appearance shows the board', async () => {
    const { container } = appearance({ phone: true });
    await screen.findByText('Official Pin Color');
    await screen.findByText('3 custom themes');
    expectBoard('13-15-appearance', container);
    expect(screen.getByRole('link', { name: /Custom Themes/ })).toHaveAttribute('href', '/preferences/appearance/themes');
  });

  it('a row saves today\'s key as it changes', async () => {
    const { log } = appearance();
    const mode = await screen.findByRole('radiogroup', { name: 'Appearance Mode' });
    fireEvent.click(within(mode).getByRole('radio', { name: 'Light' }));
    await waitFor(() => expect(log.settings).toContainEqual({ appearanceMode: 'light' }));
    fireEvent.change(screen.getByLabelText('Node List Style'), { target: { value: 'importance' } });
    await waitFor(() => expect(log.settings).toContainEqual({ nodeListStyle: 'importance' }));
  });

  it('shows the official pin colour only for the official pin (#5018)', async () => {
    appearance({ settings: { ...PREF_SETTINGS, mapPinStyle: 'meshmonitor' } });
    await screen.findByText('Map Pin Style');
    expect(screen.queryByText('Official Pin Color')).toBeNull();
  });

  it('Apply as Light sets the Light Theme row', async () => {
    const { log } = appearance();
    const row = (await screen.findByText('Mesh green', { selector: 'span' })).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Apply as Light' }));
    await waitFor(() => expect(log.settings).toContainEqual({ lightTheme: 'custom-mesh-green' }));
    // The applied theme was already the dark one.
    expect(within(screen.getByText('Athens Night', { selector: 'span' }).closest('div')!).getByRole('button', { name: 'Dark Active' })).toBeDisabled();
  });

  it('Delete asks with today\'s words, then deletes', async () => {
    const { log } = appearance();
    fireEvent.click(await screen.findByRole('button', { name: 'More for Mesh green' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Mesh green' });
    expect(sheet).toHaveTextContent('Are you sure you want to delete this theme?');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.themes).toEqual([{ method: 'DELETE', path: '/api/themes/custom-mesh-green' }]));
  });

  it('Reset to Defaults asks with today\'s words before saving the tapbacks', async () => {
    const { log } = appearance();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset to Defaults' }));
    const sheet = await screen.findByRole('dialog', { name: 'Reset to Defaults' });
    expect(sheet).toHaveTextContent('Reset tapback emojis to defaults? This will replace all your custom emojis.');
    expect(log.settings.some((b) => 'customTapbackEmojis' in b)).toBe(false);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset to Defaults' }));
    await waitFor(() => expect(log.settings.some((b) => 'customTapbackEmojis' in b)).toBe(true));
  });

  it('without settings:write the rows are View only, and without themes:write there is no Create', async () => {
    appearance({ permissions: { global: {}, bySource: {} } });
    await screen.findByText('Athens Night', { selector: 'span' });
    expect(screen.getAllByText('View only').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('radiogroup', { name: 'Appearance Mode' })).getByRole('radio', { name: 'Light' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset to Defaults' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Create New Theme/ })).toBeNull();
    expect(screen.getByText('Needs themes:write')).toBeInTheDocument();
  });
});
