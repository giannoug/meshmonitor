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

  it('Apply as Light is today\'s local set: no settings request, for any viewer (Ruling GM)', async () => {
    const { log } = appearance({ permissions: { global: {}, bySource: {} } });
    const row = (await screen.findByText('Mesh green', { selector: 'span' })).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Apply as Light' }));
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Light Active' })).toBeDisabled());
    expect(localStorage.getItem('lightTheme')).toBe('custom-mesh-green');
    expect(log.settings).toEqual([]);
    // The applied dark theme came from the install's settings.
    expect(within(screen.getByText('Athens Night', { selector: 'span' }).closest('div')!).getByRole('button', { name: 'Dark Active' })).toBeDisabled();
  });

  it('phone: a select opens the bottom sheet of its options (b-set-p3), and tap targets carry data-phone', async () => {
    appearance({ phone: true });
    await screen.findByText('Official Pin Color');
    fireEvent.click(screen.getByRole('button', { name: /Node List Style/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Node List Style' });
    expect(within(sheet).getByRole('radio', { name: 'Importance' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove emoji/ })[0]).toHaveAttribute('data-phone', 'true');
  });

  it('the ⋯ menu works from the keyboard; Escape closes only the menu', async () => {
    appearance();
    const more = await screen.findByRole('button', { name: 'More for Mesh green' });
    fireEvent.click(more);
    const menu = screen.getByRole('menu', { name: 'More for Mesh green' });
    const [clone, del] = within(menu).getAllByRole('menuitem');
    expect(clone).toHaveFocus();
    fireEvent.keyDown(clone, { key: 'ArrowDown' });
    expect(del).toHaveFocus();
    fireEvent.keyDown(del, { key: 'ArrowDown' });
    expect(clone).toHaveFocus();
    let reached = false;
    const outer = () => (reached = true);
    document.addEventListener('keydown', outer);
    fireEvent.keyDown(clone, { key: 'Escape' });
    document.removeEventListener('keydown', outer);
    expect(reached).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
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

  it('deleting the dark theme in use does what today does: the slot goes back to Mocha in context, nothing is saved', async () => {
    const { log } = appearance();
    fireEvent.click(await screen.findByRole('button', { name: 'More for Athens Night' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Athens Night' })).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(localStorage.getItem('darkTheme')).toBe('mocha'));
    // The install key still names the deleted theme, as today; the row shows context's Mocha.
    await waitFor(() => expect(screen.getByLabelText('Dark Theme')).toHaveDisplayValue('Mocha (Dark)'));
    expect(log.settings).toEqual([]);
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
