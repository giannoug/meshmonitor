/**
 * Renders a Reticulum node URL the way the Workspace does (shell +
 * WorkspaceSource) against the section 9 fixture (`reticulumFixtures`). Each
 * test file mocks the socket itself (useReticulum reads it from its context):
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
 */
import { onTestFinished, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { renderChat } from '../../chat/__tests__/renderChat';
import type { RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { reticulumFixtures, type ReticulumFixtureOptions, type ReticulumLog } from '../../__fixtures__/reticulum';

export const RNS_URL = '/source/src-rns';

// The screens load lazily and run today's hooks: give the first find more than a second.
configure({ asyncUtilTimeout: 4000 });

export function renderReticulum(route: string, opts: RenderWorkspaceOptions & { reticulum?: ReticulumFixtureOptions } = {}) {
  const log: ReticulumLog = { reads: [], writes: [] };
  onTestFinished(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderChat(route, { ...opts, fixtures: { ...reticulumFixtures(log, opts.reticulum), ...opts.fixtures } });
  return { ...view, log };
}

/** Requests the page made to a Reticulum route ending in `suffix` with `method` (counted from the fetch mock). */
export function rnsRequests(method: string, suffix: string | RegExp): number {
  return vi.mocked(fetch).mock.calls.filter(([u, i]) => {
    const m = (i?.method ?? 'GET').toUpperCase();
    const p = new URL(String(u), 'http://localhost').pathname;
    return m === method && p.includes('/reticulum/') && (typeof suffix === 'string' ? p.endsWith(suffix) : suffix.test(p));
  }).length;
}
