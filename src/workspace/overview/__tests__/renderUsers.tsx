/**
 * Overview › Users and Audit log (Task 4.8) under the real Workspace routes,
 * with the users / audit fixtures. `writes()` lists every non-GET request as
 * `{ method, url, body }`, so a test can pin today's exact request.
 */
import { vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { usersFixtures } from '../../__fixtures__/users';
import { renderMessages, type MessagesOptions } from './renderMessages';

export const renderUsers = (route = '/overview/users', opts: MessagesOptions = {}) =>
  renderMessages(route, { ...opts, fixtures: { ...usersFixtures, ...opts.fixtures } });

export interface Sent {
  method: string;
  url: string;
  body: unknown;
}

export const requests = (): Sent[] =>
  vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => ({
    method: init?.method ?? 'GET',
    url: String(u),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));

export const writes = () => requests().filter((r) => r.method !== 'GET');
export const gets = () => requests().filter((r) => r.method === 'GET').map((r) => r.url);

/** Opens a user from the list (desktop column or phone list). */
export async function openUser(name: string): Promise<void> {
  const list = await screen.findByRole('list', { name: 'Users' }, { timeout: 5000 });
  fireEvent.click(await within(list).findByRole('button', { name: new RegExp(`^${name}\\b`) }));
}

/** The matrix cell for `resource` on `device` (its accessible name starts with both). */
export const cell = (resource: string, device: string) =>
  screen.findByRole('button', { name: new RegExp(`^${resource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} on ${device}: `) }, { timeout: 5000 });
