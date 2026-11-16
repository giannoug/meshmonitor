/**
 * @vitest-environment jsdom
 *
 * Boards 11-05 (desktop) and 11-13 (phone), Task 6.1: You › API Token over
 * today's /api/token routes. One token per user: Revoke (today's confirm
 * words), then Generate; no Regenerate. A new token shows once, with Copy
 * (today's copy and toast) and Dismiss, and is gone from the page after.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { NEW_TOKEN_VALUE } from '../../__fixtures__/account';
import ApiTokenPage from '../ApiTokenPage';
import { joined, renderAccount } from './accountHarness';

async function generate(phone: boolean) {
  const r = renderAccount(<ApiTokenPage />, '/you/token', { phone, account: { token: false } });
  fireEvent.click(await screen.findByRole('button', { name: /Generate API Token/ }));
  await screen.findByText(NEW_TOKEN_VALUE);
  return r;
}

describe('11-05-api-token', () => {
  it('11-05-api-token shows the board', async () => {
    const texts: string[] = [];
    const { container } = await generate(false);
    texts.push(container.textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Token' }));
    texts.push((await screen.findByRole('dialog', { name: 'Revoke Token' })).textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Revoke' }));
    await screen.findByRole('button', { name: /Generate API Token/ });
    texts.push(container.textContent ?? '');
    expectBoard('11-05-api-token', joined(texts));
  });

  it('11-13-api-token shows the board', async () => {
    const { container } = await generate(true);
    expectBoard('11-13-api-token', container);
  });

  it('copies with today\'s helper and drops the token on Dismiss', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await generate(false);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(NEW_TOKEN_VALUE);
    expect(await screen.findByText('Token copied to clipboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(document.body.textContent).not.toContain(NEW_TOKEN_VALUE);
    // The summary keeps only the prefix.
    expect(screen.getByText('mm_v1_3f9a...')).toBeInTheDocument();
  });

  it('leaving the page drops the token: coming back shows only the prefix', async () => {
    const { unmount } = await generate(false);
    unmount();
    // A fresh visit, now that the token exists: nothing kept the secret for it.
    renderAccount(<ApiTokenPage />, '/you/token');
    expect(await screen.findByText('mm_v1_3f9a...')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(NEW_TOKEN_VALUE);
  });

  it('shows today\'s details and usage, with Revoke and no Regenerate', async () => {
    renderAccount(<ApiTokenPage />, '/you/token');
    expect(await screen.findByText('mm_v1_3f9a...')).toBeInTheDocument();
    expect(screen.getByText('Authorization: Bearer YOUR_TOKEN_HERE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View API Documentation/ })).toHaveAttribute('href', '/api/v1/docs');
    expect(screen.getByText('To replace it: Revoke, then Generate.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate/ })).toBeNull();
    expect(screen.queryByText(/Regenerate/)).toBeNull();
  });

  it('Revoke confirms first and Cancel keeps the token', async () => {
    let revoked = false;
    renderAccount(<ApiTokenPage />, '/you/token', { fixtures: { 'DELETE /api/token': () => { revoked = true; return { success: true }; } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke Token' }));
    const sheet = await screen.findByRole('dialog', { name: 'Revoke Token' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(revoked).toBe(false);
    expect(screen.getByText('mm_v1_3f9a...')).toBeInTheDocument();
  });
});
