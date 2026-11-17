/**
 * @vitest-environment jsdom
 *
 * Boards 13-03 (desktop) and 13-20 (phone), Task 6.3: Language & units, which
 * holds today's Language, Units & Formats, Sorting and Link Previews. Rows
 * save today's keys as you go; Language is today's setter (this browser at
 * once), so every viewer may change it.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../../test/boardChecks';
import { renderPrefs } from './prefsHarness';

describe('13-03-language-units', () => {
  it('13-03-language-units shows the board', async () => {
    const { container } = renderPrefs('/preferences/language');
    await screen.findByText('Time Format');
    expectBoard('13-03-language-units', container);
  });

  it('13-20-language-units shows the board', async () => {
    const { container } = renderPrefs('/preferences/language', { phone: true });
    await screen.findByText('Time Format');
    expectBoard('13-20-language-units', container);
  });

  it.each(['units', 'sorting', 'link-previews'])('/preferences/%s lands on Language & units, keeping a search anchor', async (cat) => {
    renderPrefs(`/preferences/${cat}#setting-units.distanceUnit`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/preferences/language#setting-units.distanceUnit'));
    expect(await screen.findByText('Distance Unit')).toBeInTheDocument();
  });

  it('a unit, a sort and the link previews switch save today\'s keys', async () => {
    const { log } = renderPrefs('/preferences/language');
    const distance = await screen.findByRole('radiogroup', { name: 'Distance Unit' });
    fireEvent.click(within(distance).getByRole('radio', { name: 'Miles (mi)' }));
    await waitFor(() => expect(log.settings).toContainEqual({ distanceUnit: 'mi' }));
    fireEvent.change(screen.getByLabelText('Preferred Node List Sorting - Direction'), { target: { value: 'asc' } });
    await waitFor(() => expect(log.settings).toContainEqual({ preferredSortDirection: 'asc' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Show link previews' }));
    await waitFor(() => expect(log.settings).toContainEqual({ linkPreviewsEnabled: '0' }));
  });

  it('a viewer without settings:write may change only the language', async () => {
    const { log } = renderPrefs('/preferences/language', { permissions: { global: {}, bySource: {} } });
    await screen.findByText('Time Format');
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup', { name: 'Distance Unit' })).getByRole('radio', { name: 'Miles (mi)' })).toBeDisabled();
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(language).toBeEnabled();
    fireEvent.change(language, { target: { value: 'de' } });
    await waitFor(() => expect(log.settings).toContainEqual({ language: 'de' }));
    expect(localStorage.getItem('language')).toBe('de');
  });
});
