/**
 * Station G2's More tools (Task 8.5) under the real Workspace routes
 * (WorkspaceApp), against the Athens cast plus `toolsFixtures`: Tools, the
 * device packet monitor, Info and Security. Each test file mocks the socket:
 *
 *   vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));
 */
import { onTestFinished, vi } from 'vitest';
import { configure } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import { toolsFixtures, type ToolsLog } from '../../__fixtures__/tools';
import WorkspaceApp from '../../WorkspaceApp';

export const G2 = `/source/${SOURCE_IDS.g2}`;

// The pages load lazily and run today's hooks: give the first find more than a second.
configure({ asyncUtilTimeout: 5000 });

export function renderTools(route: string, opts: RenderWorkspaceOptions = {}) {
  const log: ToolsLog = { writes: [] };
  localStorage.clear();
  onTestFinished(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  Element.prototype.scrollIntoView ??= () => {};
  const view = renderWorkspace(<WorkspaceApp />, { route, ...opts, fixtures: { ...captureOn, ...toolsFixtures(log), ...opts.fixtures } });
  return { ...view, log };
}

/** Every request the page made, as "METHOD /path?query". */
export const fetched = () =>
  vi.mocked(globalThis.fetch).mock.calls.map(([u, init]) => {
    const url = new URL(String(u), 'http://localhost');
    return `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}${url.search}`;
  });

/** Requests other than GET (writes, and anything that could transmit). */
export const nonGets = () => fetched().filter((r) => !r.startsWith('GET '));
