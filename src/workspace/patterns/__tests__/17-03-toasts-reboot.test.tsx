/**
 * @vitest-environment jsdom
 *
 * Boards 17-03-toasts-reboot (desktop) and 17-10-toasts-reboot (phone), Task
 * 9.1: today's config-issue banner (once, no dismiss), the reboot wait after a
 * save that restarts the radio (RebootModal's polling, drawn as steps), and
 * the toasts: today's queue (useToast) and today's device notifications (8 s,
 * from the per-source socket). The board draws a save toast and a 34 s wait
 * at once; a save toast lasts 5 s, so its text is read when the save lands
 * and the rest at 34 s, for one board check.
 *
 * The device notices run where the Workspace holds a device's socket
 * (ChatProviders); this board's settings page has none, so the test mounts
 * DeviceNotices beside it over a stub socket.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { joined } from '../../chat/__tests__/renderChat';
import { deviceConfigFixtures } from '../../__fixtures__/deviceConfig';
import WorkspaceShell from '../../shell/WorkspaceShell';
import WorkspaceSource from '../../source/WorkspaceSource';
import ToastHost from '../ToastHost';
import DeviceNotices from '../DeviceNotices';
import { g2 } from '../../settings/__tests__/renderSettings';

const socket = vi.hoisted(() => {
  const handlers: Record<string, (data: unknown) => void> = {};
  return {
    handlers,
    on: (event: string, handler: (data: unknown) => void) => {
      handlers[event] = handler;
    },
    off: (event: string) => {
      delete handlers[event];
    },
  };
});

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWebSocketContext: () => ({ state: { socket, connected: true }, enabled: true }),
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const COOKIE_ISSUE = {
  issues: [
    {
      type: 'cookie_secure',
      severity: 'error',
      message: 'Secure cookies are enabled but you are accessing via HTTP. Session cookies will not work. Set COOKIE_SECURE=false or access via HTTPS.',
      docsUrl: 'https://meshmonitor.org/faq.html#i-see-a-blank-white-screen-when-accessing-meshmonitor',
    },
  ],
};
// The connection check never answers, so the wait holds on "Verifying device connection…" as the boards draw it.
const pending = () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } });

function renderLora(phone: boolean) {
  Element.prototype.scrollIntoView ??= () => {};
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  return renderWorkspace(
    <ToastHost>
      <WorkspaceShell>
        <Routes>
          <Route path="source/:sourceId/*" element={<WorkspaceSource />} />
        </Routes>
      </WorkspaceShell>
      <DeviceNotices />
    </ToastHost>,
    {
      route: `${g2}/settings/lora`,
      phone,
      fixtures: {
        ...deviceConfigFixtures,
        'GET /api/auth/check-config-issues': () => COOKIE_ISSUE,
        'POST /api/config/lora': () => ({ success: true }),
        'GET /api/connection': pending,
      },
    },
  );
}

/** Saves a Hop Limit change; the radio restarts, so the reboot wait opens. */
async function saveLora() {
  const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(hops).toHaveValue(3));
  fireEvent.change(hops, { target: { value: '4' } });
  const bar = await screen.findByRole('region', { name: 'Unsaved radio changes' });
  fireEvent.click(within(bar).getByRole('button', { name: /^Save/ }));
  await screen.findByText('LoRa configuration saved! Device will reboot...');
  return screen.findByRole('dialog', { name: /Device Reboot/ });
}

const notify = (data: Record<string, unknown>) => act(() => socket.handlers['client-notification']?.(data));
const DUTY = { level: 40, message: 'Duty cycle limit exceeded. You can send again in 9 min.' };
const UNSIGNED = { level: 30, message: 'unsigned', kind: 'unsigned_update_ignored', nodeNum: 0xb81e44c0, nodeName: 'Lycabettus Hiker', policy: 'balanced' };

describe('17-03 / 17-10 toasts and the reboot wait', () => {
  it('17-03-toasts-reboot shows the board', async () => {
    renderLora(false);
    const wait = await saveLora();
    const atSave = document.body.textContent ?? '';
    await act(() => vi.advanceTimersByTimeAsync(34_000));
    expect(wait).toHaveTextContent('Elapsed: 34s');
    notify(UNSIGNED);
    notify(DUTY);
    expect(await screen.findByText(/Protection Level is Balanced/)).toBeInTheDocument();
    expectBoard('17-03-toasts-reboot', joined(atSave, document.body));
  });

  it('17-10-toasts-reboot shows the board', async () => {
    renderLora(true);
    const wait = await saveLora();
    await act(() => vi.advanceTimersByTimeAsync(34_000));
    expect(wait).toHaveTextContent('Elapsed: 34s');
    notify(DUTY);
    await screen.findByText('Duty cycle limit exceeded. You can send again in 9 min.');
    expectBoard('17-10-toasts-reboot', document.body);
  });

  it('a device notification shows 8 s, as today', async () => {
    renderLora(false);
    await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
    notify(DUTY);
    const toast = await screen.findByText('Duty cycle limit exceeded. You can send again in 9 min.');
    expect(toast.closest('[data-type]')).toHaveAttribute('data-type', 'error');
    await act(() => vi.advanceTimersByTimeAsync(7_900));
    expect(screen.getByText('Duty cycle limit exceeded. You can send again in 9 min.')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByText('Duty cycle limit exceeded. You can send again in 9 min.')).toBeNull();
  });
});
