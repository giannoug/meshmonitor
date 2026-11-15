/**
 * Athens MQTT's packet monitor (Task 4.7, 18-03 / 18-04) under the real
 * Workspace routes. `storage` presets today's monitor keys
 * (`mqttPacketMonitor.*`), as a returning user has them.
 */
import { onTestFinished } from 'vitest';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import WorkspaceApp from '../../WorkspaceApp';

export const RECEPTIONS_ROUTE = `/source/${SOURCE_IDS.mqtt}/packetmonitor`;

export function renderReceptions(opts: RenderWorkspaceOptions & { storage?: Record<string, unknown> } = {}) {
  localStorage.clear();
  for (const [k, v] of Object.entries(opts.storage ?? {})) localStorage.setItem(k, JSON.stringify(v));
  onTestFinished(() => localStorage.clear());
  return renderWorkspace(<WorkspaceApp />, { route: RECEPTIONS_ROUTE, ...opts });
}
