/**
 * @vitest-environment jsdom
 *
 * Board 10-16 (phone): message search as a full-screen page with Back, from
 * the Home pill (note s10n5). Same filters as the desktop dialog; a phone has
 * no shortcut, so no hint.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { expectBoard } from '../../test/boardChecks';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
// The board's page of results holds four.
const fourOf31 = () => ({ success: true, count: 4, total: 31, data: athensFixture.searchResults.slice(0, 4) });

async function openPage() {
  const result = renderChat(g2, { phone: true, fixtures: { 'GET /api/messages/search': fourOf31 } });
  fireEvent.click(await screen.findByRole('button', { name: /Search Messages/ }));
  const page = within(await screen.findByRole('dialog', { name: 'Search Messages' }));
  return { ...result, page };
}

afterEach(() => vi.restoreAllMocks());

describe('10-16-search-messages', () => {
  it('10-16-search-messages shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { page } = await openPage();
    fireEvent.change(page.getByRole('textbox', { name: 'Search for text in messages...' }), { target: { value: 'relay' } });
    fireEvent.click(page.getByRole('button', { name: 'Search' }));
    await page.findByText(/Showing 4 of 31 results/);
    expectBoard('10-16-search-messages', document.body);
  });

  it('the phone page shows no shortcut hint', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    await openPage();
    expect(document.body.textContent).not.toContain('⌘K');
    expect(document.body.textContent).not.toContain('Ctrl+K');
  });

  it('Back closes the page and returns to Home', async () => {
    const { page } = await openPage();
    expect(page.getByText('Station G2')).toBeInTheDocument();
    fireEvent.click(page.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
    expect(screen.getByRole('navigation', { name: 'Device tools' })).toBeInTheDocument();
  });

  it('picking a result opens its conversation and closes the page', async () => {
    const { page } = await openPage();
    fireEvent.change(page.getByRole('textbox', { name: 'Search for text in messages...' }), { target: { value: 'relay' } });
    fireEvent.click(page.getByRole('button', { name: 'Search' }));
    fireEvent.click(await page.findByRole('button', { name: /DM with Kifisia Rooftop/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Search Messages' })).toBeNull());
    expect(await screen.findByTestId('dm-header')).toBeInTheDocument();
  });

  it('the Search button needs at least 2 characters', async () => {
    const { page } = await openPage();
    expect(page.getByText('Enter at least 2 characters to search.')).toBeInTheDocument();
    fireEvent.change(page.getByRole('textbox', { name: 'Search for text in messages...' }), { target: { value: 'r' } });
    expect(page.getByRole('button', { name: 'Search' })).toBeDisabled();
  });
});
