/**
 * @vitest-environment jsdom
 *
 * Ruling 9.1 IJ: an open Meshtastic-family device holds one live connection
 * (DeviceSocket), with today's device notification toasts on it, on every
 * page under `/source/:id`: settings and tools as well as chat. Moving between
 * the device's pages keeps that one connection; no page opens a second.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, configure, fireEvent, screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { renderWorkspace } from '../../test/renderWorkspace';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import { deviceConfigFixtures } from '../../__fixtures__/deviceConfig';
import { toolsFixtures } from '../../__fixtures__/tools';
import WorkspaceApp from '../../WorkspaceApp';

const ws = vi.hoisted(() => {
  const handlers: Record<string, (data: unknown) => void> = {};
  return {
    /** Providers mounted so far, and those mounted now. */
    mounted: 0,
    live: 0,
    handlers,
    socket: {
      on: (event: string, handler: (data: unknown) => void) => {
        handlers[event] = handler;
      },
      off: (event: string) => {
        delete handlers[event];
      },
    },
  };
});

vi.mock('../../../contexts/WebSocketContext', async (orig) => {
  const { useEffect } = await import('react');
  return {
    ...(await orig<object>()),
    WebSocketProvider: ({ children }: { children: ReactNode }) => {
      useEffect(() => {
        ws.mounted += 1;
        ws.live += 1;
        return () => {
          ws.live -= 1;
        };
      }, []);
      return <>{children}</>;
    },
    useWebSocketContext: () => ({ state: { socket: ws.socket, connected: true }, enabled: true }),
    // DeviceNotices reads the socket with useOptionalSocket (F.2 A23-M3).
    useOptionalSocket: () => ws.socket,
  };
});
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

configure({ asyncUtilTimeout: 5000 });

const G2 = `/source/${SOURCE_IDS.g2}`;

function Goto() {
  const navigate = useNavigate();
  return <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />;
}
const goTo = (path: string) => fireEvent.change(screen.getByTestId('goto'), { target: { value: path } });
const notify = (message: string) => act(() => ws.handlers['client-notification']?.({ level: 40, message }));

describe('the device screen\'s one socket (Ruling 9.1 IJ)', () => {
  it('a notice shows on a settings page and on a tools page, over one connection kept across the device\'s pages', async () => {
    ws.mounted = 0;
    ws.live = 0;
    Element.prototype.scrollIntoView ??= () => {};
    renderWorkspace(
      <>
        <WorkspaceApp />
        <Goto />
      </>,
      { route: `${G2}/settings/lora`, fixtures: { ...captureOn, ...deviceConfigFixtures, ...toolsFixtures({ writes: [] }) } },
    );
    await screen.findByLabelText('Hop Limit');
    expect(ws.live).toBe(1);
    notify('Duty cycle limit exceeded. You can send again in 9 min.');
    expect(await screen.findByText('Duty cycle limit exceeded. You can send again in 9 min.')).toBeInTheDocument();

    goTo(`${G2}/tools`);
    await screen.findByText('Analysis, Reports, Users, Audit log');
    notify('Radio overheated');
    expect(await screen.findByText('Radio overheated')).toBeInTheDocument();
    // The same connection: nothing was torn down or opened.
    expect([ws.mounted, ws.live]).toEqual([1, 1]);

    // A chat page reads the device's socket too; ChatProviders opens none of its own.
    goTo(`${G2}/dm/!a1b2c301`);
    await screen.findByTestId('dm-header');
    expect([ws.mounted, ws.live]).toEqual([1, 1]);

    // Another device: its own connection, the first one closed.
    goTo(`/source/${SOURCE_IDS.mqtt}/packets`);
    await waitFor(() => expect(ws.mounted).toBe(2));
    expect(ws.live).toBe(1);
  });
});
