/**
 * Task 5.9: the remote fixtures (remoteBoardFixtures) and what the board tests
 * count with them: `meshRequests()` lists what reached a mesh-sending route.
 */
import { vi } from 'vitest';

export { HILLTOP, PSYCHIKO, NODE, HILLTOP_CONFIG, remoteFixtures } from './remoteBoardFixtures';

/** Admin routes that send on the mesh (or ask the node for a passkey). */
const MESH = /\/api\/admin\/(load-config|load-owner|get-channel|commands|ensure-session-passkey|get-device-metadata|set-time|reboot)$|\/meshtastic\/admin\/cli$/;

/** Every request made so far, as `METHOD /path` with its body. */
export const requests = () =>
  vi.mocked(fetch).mock.calls.map(([u, init]) => ({
    what: `${(init?.method ?? 'GET').toUpperCase()} ${new URL(String(u), 'http://x').pathname}`,
    body: typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
  }));

/** The requests that went towards the mesh. */
export const meshRequests = () => requests().filter((r) => MESH.test(r.what));

/** Holds the requests `match` picks until `release()`, so a board can be checked mid-way. */
export function hold(match: (path: string, body: Record<string, unknown> | undefined) => boolean): () => void {
  const fetchMock = vi.mocked(fetch);
  const real = fetchMock.getMockImplementation()!;
  const waiting: Array<() => void> = [];
  fetchMock.mockImplementation((input, init) => {
    const path = new URL(String(input), 'http://x').pathname;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    if (!match(path, body)) return real(input, init);
    return new Promise((resolve) => waiting.push(() => resolve(real(input, init))));
  });
  return () => waiting.splice(0).forEach((go) => go());
}
