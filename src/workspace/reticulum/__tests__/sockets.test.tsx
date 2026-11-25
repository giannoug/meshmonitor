/**
 * @vitest-environment jsdom
 *
 * Sockets (Ruling N), for the native Reticulum screen (Task 7.6): the device
 * screen opens exactly one WebSocketProvider, as MeshCore's does, and device
 * settings open none. (WorkspaceApp.test stubs the screen, so the count lives here.)
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { RNS_URL, renderReticulum } from './renderReticulum';

// One marker element per provider, so the test can count the sockets a route opens.
vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <div data-ws-provider="">{children}</div>,
  useWebSocketContext: () => ({ state: { socket: null, connected: false } }),
}));

describe('Reticulum sockets (Ruling N)', () => {
  it.each(['/destinations', '/paths', '/map'])('%s has exactly one WebSocketProvider', async (path) => {
    const { container } = renderReticulum(`${RNS_URL}${path}`);
    await screen.findByText('38 destinations · 4 interfaces');
    expect(container.querySelectorAll('[data-ws-provider]')).toHaveLength(1);
  });

  it('device settings open no socket', async () => {
    const { container } = renderReticulum(`${RNS_URL}/settings/lxmf-identity`);
    await screen.findByLabelText('Display name');
    expect(container.querySelectorAll('[data-ws-provider]')).toHaveLength(0);
  });
});
