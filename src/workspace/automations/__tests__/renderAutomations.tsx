/**
 * Renders Station G2's Automations the way the Workspace does (shell +
 * WorkspaceSource) against `automationFixtures`. Each test file mocks the
 * socket and App itself:
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
 *   vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));
 */
import { onTestFinished, vi } from 'vitest';
import { act, configure } from '@testing-library/react';
import { renderChat } from '../../chat/__tests__/renderChat';
import type { RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { automationFixtures, type AutomationLog } from '../../__fixtures__/automations';

export const G2 = '/source/src-g2';
export const AUTO = `${G2}/automation`;

// The page loads lazily and reads every built-in: give the first find more than a second.
configure({ asyncUtilTimeout: 4000 });

export function renderAutomations(route = AUTO, opts: RenderWorkspaceOptions = {}) {
  const log: AutomationLog = { writes: [] };
  onTestFinished(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderChat(route, { ...opts, fixtures: { ...automationFixtures(log), ...opts.fixtures } });
  return { ...view, log };
}

/** Writes to a path ending in `tail`. */
export const writes = (log: AutomationLog, tail: string) => log.writes.filter((w) => w.path.endsWith(tail));

/** Requests the page made with `method` to `path` (from the fetch mock). */
export function requests(method: string, path: string | RegExp): number {
  return vi.mocked(fetch).mock.calls.filter(([u, i]) => {
    const m = (i?.method ?? 'GET').toUpperCase();
    const p = new URL(String(u), 'http://localhost').pathname;
    return m === method && (typeof path === 'string' ? p === path : path.test(p));
  }).length;
}

/** Every request that is not a GET (the fetch mock), whether or not a fixture logs it. */
export function nonGet(): Array<{ method: string; path: string }> {
  return vi.mocked(fetch).mock.calls
    .map(([u, i]) => ({ method: (i?.method ?? 'GET').toUpperCase(), path: new URL(String(u), 'http://localhost').pathname }))
    .filter((r) => r.method !== 'GET');
}

export const settle = (ms = 60) => act(async () => new Promise((r) => setTimeout(r, ms)));
