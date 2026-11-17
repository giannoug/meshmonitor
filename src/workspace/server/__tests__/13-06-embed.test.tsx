/**
 * @vitest-environment jsdom
 *
 * Boards 13-06 (desktop) and 13-23 (phone), Task 6.4: Server › Embed. Today's
 * profiles, form, embed code and delete, admins only.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { grants, renderServer } from './serverHarness';

const PATH = '/server/embed';

describe('13-06 / 13-23 embed', () => {
  it.each([
    ['13-06-embed', false],
    ['13-23-embed', true],
  ])('%s shows the board', async (board, phone) => {
    const { container } = renderServer(PATH, { phone });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Athens public' }));
    await screen.findByTestId('embed-preview');
    expectBoard(board, container);
  });

  it('Save profile sends today\'s PUT with the origins parsed', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Athens public' }));
    const origins = await screen.findByLabelText(/Allowed Origins/);
    expect(origins).toHaveValue('https://athensmesh.gr, https://club.example.org');
    fireEvent.change(origins, { target: { value: 'https://athensmesh.gr, not a url' } });
    expect(screen.getByText('not a url').closest('[data-invalid]')).not.toBeNull();
    fireEvent.change(origins, { target: { value: 'https://athensmesh.gr' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Paths' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(log.writes.some((w) => w.method === 'PUT' && w.path === '/api/embed-profiles/athens-public')).toBe(true));
    const put = log.writes.find((w) => w.method === 'PUT')!.body as Record<string, unknown>;
    expect(put).toMatchObject({ name: 'Athens public', allowedOrigins: ['https://athensmesh.gr'], showPaths: true, channels: [0, 1] });
  });

  it('Embed Code shows today\'s snippet and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderServer(PATH);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Embed Code' }))[0]);
    const code = await screen.findByRole('textbox', { name: 'Embed code' });
    expect((code as HTMLTextAreaElement).value).toMatch(/^<iframe src=".*\/embed\/athens-public" width="800" height="600"/);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith((code as HTMLTextAreaElement).value));
  });

  it('Delete asks with today\'s words', async () => {
    const { log } = renderServer(PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'More for Club site' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const sheet = await screen.findByRole('dialog', { name: 'Delete' });
    expect(within(sheet).getByText('Are you sure you want to delete this embed profile?')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(log.writes).toContainEqual({ method: 'DELETE', path: '/api/embed-profiles/club-site', body: undefined }));
  });

  it('a non-admin gets no access and nothing is read', async () => {
    renderServer(PATH, { permissions: grants({ write: true }) });
    expect(await screen.findByText("You don't have permission to do this")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).includes('/api/embed-profiles'))).toBe(false);
  });
});
