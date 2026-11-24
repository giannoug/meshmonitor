/**
 * @vitest-environment jsdom
 *
 * Task 9.1: ToastHost (today's toast queue, drawn for the Workspace),
 * ConfigBanner (today's config issues: one read, no interval, no dismiss) and
 * RebootWait (RebootModal's polling, verbatim: same endpoints, same waits,
 * same limits), plus the Maintenance reboot that opens it. None of the toasts
 * or banners sends anything; the reboot sends one command per press.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { useToast } from '../../../components/ToastContainer';
import { SourceProvider } from '../../../contexts/SourceContext';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, renderSettings } from '../../settings/__tests__/renderSettings';
import ToastHost from '../ToastHost';
import ConfigBanner from '../ConfigBanner';
import RebootWait from '../RebootWait';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const calls = () =>
  vi.mocked(fetch).mock.calls.map(([u, init]) => `${(init?.method ?? 'GET').toUpperCase()} ${new URL(String(u), 'http://x').pathname}`);
const nonGets = () => calls().filter((c) => !c.startsWith('GET '));

function Shout({ message, type, duration }: { message: string; type: 'success' | 'error' | 'info' | 'warning'; duration?: number }) {
  const { showToast } = useToast();
  return <button type="button" onClick={() => showToast(message, type, duration)}>Shout {type}</button>;
}

describe('ToastHost', () => {
  it('draws today\'s queue: each toast with its kind, a close button, and today\'s 5 s timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWorkspace(
      <ToastHost>
        <Shout message="Config saved" type="info" />
        <Shout message="Could not save" type="error" />
      </ToastHost>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shout info' }));
    fireEvent.click(screen.getByRole('button', { name: 'Shout error' }));
    const info = screen.getByText('Config saved').closest('[data-type]')!;
    expect(info).toHaveAttribute('data-type', 'info');
    expect(screen.getByText('Could not save').closest('[data-type]')).toHaveAttribute('data-type', 'error');
    fireEvent.click(within(info as HTMLElement).getByRole('button', { name: 'Close notification' }));
    expect(screen.queryByText('Config saved')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(screen.queryByText('Could not save')).toBeNull();
    expect(nonGets()).toEqual([]);
  });

  it('on the phone the host is marked for phone sizes', () => {
    renderWorkspace(
      <ToastHost>
        <Shout message="Hello" type="success" />
      </ToastHost>,
      { phone: true },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shout success' }));
    expect(screen.getByText('Hello').closest('[data-phone]')).not.toBeNull();
  });
});

const ISSUE = (severity: 'error' | 'warning', message: string) => ({
  issues: [{ type: 'cookie_secure', severity, message, docsUrl: 'https://meshmonitor.org/faq.html#cookies' }],
});

describe('ConfigBanner', () => {
  it('shows today\'s issue with Learn more, read once and never again', async () => {
    const view = renderWorkspace(<ConfigBanner />, {
      fixtures: { 'GET /api/auth/check-config-issues': () => ISSUE('error', 'Secure cookies are enabled but you are accessing via HTTP.') },
    });
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Configuration Error: Secure cookies are enabled but you are accessing via HTTP.');
    expect(banner).toHaveAttribute('data-severity', 'error');
    const link = within(banner).getByRole('link', { name: /Learn more/ });
    expect(link).toHaveAttribute('href', 'https://meshmonitor.org/faq.html#cookies');
    expect(link).toHaveAttribute('target', '_blank');
    // No dismiss, as today.
    expect(within(banner).queryByRole('button')).toBeNull();
    view.rerenderWorkspace();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls().filter((c) => c === 'GET /api/auth/check-config-issues')).toHaveLength(1);
    expect(nonGets()).toEqual([]);
  });

  it('the HTTPS warning is a warning; no issues, no banner', async () => {
    renderWorkspace(<ConfigBanner />, { fixtures: { 'GET /api/auth/check-config-issues': () => ISSUE('warning', 'You are accessing via HTTPS but secure cookies are disabled.') } });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-severity', 'warning');
  });

  it('nothing to say draws nothing', async () => {
    const { container } = renderWorkspace(<ConfigBanner />, { fixtures: { 'GET /api/auth/check-config-issues': () => ({ issues: [] }) } });
    await waitFor(() => expect(calls()).toContain('GET /api/auth/check-config-issues'));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RebootWait', () => {
  const sourced = (ui: ReactNode) => (
    <SourceProvider sourceId={SOURCE_IDS.g2} sourceName="Station G2" sourceType="meshtastic_tcp">
      {ui}
    </SourceProvider>
  );
  const configWith = (counts: number[]) => {
    let i = 0;
    return () => ({ localNodeInfo: { rebootCount: counts[Math.min(i++, counts.length - 1)] } });
  };
  const waitCalls = () => calls().filter((c) => /\/api\/(config\/current|connection|nodes\/refresh)$/.test(c));
  const run = async (ms: number) => {
    for (let t = 0; t < ms; t += 1000) await act(() => vi.advanceTimersByTimeAsync(1000));
  };

  it('polls as RebootModal: one config read, 30 s, the connection, then refresh and read until the count moves; then closes', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderWorkspace(sourced(<RebootWait open expectation="always" deviceName="Station G2" onClose={onClose} />), {
      fixtures: {
        'GET /api/config/current': configWith([4, 4, 5]),
        'GET /api/connection': () => ({ connected: true }),
        'POST /api/nodes/refresh': () => ({ success: true }),
      },
    });
    const wait = screen.getByRole('dialog', { name: /Device Reboot/ });
    expect(wait).toHaveTextContent('Station G2');
    expect(wait).toHaveTextContent('Please do not close this window or refresh the page.');
    await run(29_000);
    expect(waitCalls()).toEqual(['GET /api/config/current']);
    await run(1_000);
    await run(15_000);
    expect(calls().filter((c) => c === 'GET /api/connection')).toHaveLength(1);
    // Refresh, 2 s, read (4); 3 s; refresh, 2 s, read (5): verified.
    expect(calls().filter((c) => c === 'POST /api/nodes/refresh')).toHaveLength(2);
    expect(nonGets()).toEqual(['POST /api/nodes/refresh', 'POST /api/nodes/refresh']);
    await run(2_000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the steps: done, current (today\'s words), to come; and the elapsed time', async () => {
    vi.useFakeTimers();
    renderWorkspace(sourced(<RebootWait open expectation="always" deviceName="Station G2" onClose={() => {}} />), {
      fixtures: {
        'GET /api/config/current': configWith([4]),
        'GET /api/connection': () => new Response(new ReadableStream({ start() {} })),
      },
    });
    await run(34_000);
    const steps = screen.getAllByRole('listitem');
    expect(steps.map((s) => [s.getAttribute('data-step'), s.textContent])).toEqual([
      ['done', 'Device rebooting... Please wait'],
      ['current', 'Verifying device connection...'],
      ['todo', 'Checking for configuration updates'],
    ]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Elapsed: 34s');
  });

  it('closing stops the polling', async () => {
    vi.useFakeTimers();
    const view = renderWorkspace(sourced(<RebootWait open expectation="possible" deviceName="Station G2" onClose={() => {}} />), {
      fixtures: { 'GET /api/config/current': configWith([4]) },
    });
    expect(screen.getByRole('dialog', { name: /Device May Restart/ })).toBeInTheDocument();
    await run(1_000);
    expect(waitCalls()).toEqual(['GET /api/config/current']);
    view.unmount();
    await run(60_000);
    expect(waitCalls()).toEqual(['GET /api/config/current']);
  });

  it('Maintenance › Reboot asks first, sends one reboot per press, then waits for the radio', async () => {
    renderSettings(`${g2}/settings/maintenance/danger`, {
      fixtures: { 'POST /api/device/reboot': () => ({ success: true }), 'GET /api/connection': () => new Response(new ReadableStream({ start() {} })) },
    });
    const reboot = await screen.findByRole('button', { name: 'Reboot Device' }, { timeout: 10_000 });
    await waitFor(() => expect(reboot).toBeEnabled());
    fireEvent.click(reboot);
    const sheet = await screen.findByRole('dialog', { name: 'Reboot the device?' });
    expect(within(sheet).getByRole('button', { name: 'Reboot Device' })).toHaveAttribute('type', 'button');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reboot Device' }));
    expect(await screen.findByRole('dialog', { name: /Device Reboot/ })).toHaveTextContent('Station G2');
    // The other POST is the danger zone's cached metadata read (no packet).
    expect(nonGets().filter((c) => c !== 'POST /api/admin/get-device-metadata')).toEqual(['POST /api/device/reboot']);
  });
});
