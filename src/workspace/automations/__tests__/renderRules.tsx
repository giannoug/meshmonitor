/**
 * Overview › Automations and a rule's page (Task 8.4) under the real Workspace
 * routes, against `rulesFixtures`. Each test file mocks the socket itself with
 * `socketMock` (a fake Socket.io socket the live trace subscribes to):
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('./socketMock')).socketMock(orig));
 */
import { onTestFinished, vi } from 'vitest';
import { act, configure } from '@testing-library/react';
import { fakeSocket } from './socketMock';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import WorkspaceApp from '../../WorkspaceApp';
import { RULES, rulesFixtures, type RulesLog } from '../../__fixtures__/rules';

configure({ asyncUtilTimeout: 5000 });

export { fakeSocket } from './socketMock';

export function renderRules(route = '/overview/automations', opts: RenderWorkspaceOptions & { rules?: unknown[] } = {}) {
  const log: RulesLog = { writes: [] };
  fakeSocket.reset();
  localStorage.clear();
  onTestFinished(() => localStorage.clear());
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderWorkspace(<WorkspaceApp />, { route, ...opts, fixtures: { ...rulesFixtures(log, opts.rules ?? RULES), ...opts.fixtures } });
  return { ...view, log };
}

/** Every request that is not a GET (the fetch mock), whether or not a fixture logs it. */
export function nonGet(): Array<{ method: string; path: string; body: unknown }> {
  return vi.mocked(fetch).mock.calls
    .map(([u, i]) => ({ method: (i?.method ?? 'GET').toUpperCase(), path: new URL(String(u), 'http://localhost').pathname, body: typeof i?.body === 'string' ? JSON.parse(i.body) : undefined }))
    .filter((r) => r.method !== 'GET');
}

/** GETs to `path` (the fetch mock). */
export const gets = (path: string | RegExp) => vi.mocked(fetch).mock.calls.filter(([u, i]) => {
  const p = new URL(String(u), 'http://localhost').pathname;
  return (i?.method ?? 'GET').toUpperCase() === 'GET' && (typeof path === 'string' ? p === path : path.test(p));
}).length;

export const settle = (ms = 60) => act(async () => new Promise((r) => setTimeout(r, ms)));
export const READ_ONLY = { global: { automations: { read: true, write: false } }, bySource: { 'src-g2': { messages: { read: true, write: false } } } } as never;
