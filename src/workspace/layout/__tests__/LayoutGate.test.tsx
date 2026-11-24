/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { fixtureApi } from '../../__fixtures__/fixtureApi';
import LayoutGate from '../../LayoutGate';

vi.mock('../../WorkspaceApp', () => ({ default: () => <div data-testid="workspace-app" /> }));
vi.mock('../../tools/PacketsPopout', () => ({ default: () => <div data-testid="packets-popout" /> }));

function Where() {
  const { pathname, hash } = useLocation();
  return <div data-testid="classic">{pathname + hash}</div>;
}

const classic = (
  <Routes>
    <Route path="*" element={<Where />} />
  </Routes>
);

let prevFetch: typeof fetch;

function renderGate(
  fixtures: Parameters<typeof fixtureApi>[0],
  opts: { route?: string; basename?: string; hang?: boolean | string } = {},
) {
  const api = fixtureApi(fixtures);
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    // `hang: true` stalls every request; a string stalls the requests whose URL contains it.
    if (opts.hang === true || (opts.hang && url.includes(opts.hang))) return new Promise<Response>(() => {});
    return api(url, { ...init, method: init?.method ?? 'GET' }) ?? new Response('{}', { status: 404 });
  }) as typeof fetch;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[opts.route ?? '/']} basename={opts.basename}>
        <LayoutGate classic={classic} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const prefs = (layout?: string) => () => ({ success: true, data: { preferences: layout ? { layout } : {} } });

beforeEach(() => {
  prevFetch = globalThis.fetch;
  localStorage.clear();
});
afterEach(() => {
  globalThis.fetch = prevFetch;
});

describe('LayoutGate', () => {
  it('renders the Workspace when the user chose it, with no server flag', async () => {
    renderGate({ 'GET /api/user/preferences': prefs('workspace') });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
    expect(localStorage.getItem('mm.layout')).toBe('workspace');
  });

  it('follows the install default when the user has no layout', async () => {
    renderGate({
      'GET /api/user/preferences': prefs(),
      'GET /api/settings': () => ({ defaultLayout: 'workspace' }),
    });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
  });

  it('renders Classic when neither the user nor the install chose the Workspace', async () => {
    renderGate({ 'GET /api/user/preferences': prefs(), 'GET /api/settings': () => ({}) });
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('classic'));
    expect(screen.getByTestId('classic')).toHaveTextContent('/');
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });

  it('a user Classic choice wins over a Workspace default', async () => {
    renderGate({
      'GET /api/user/preferences': prefs('classic'),
      'GET /api/settings': () => ({ defaultLayout: 'workspace' }),
    });
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('classic'));
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });

  it('does not read /api/config', async () => {
    renderGate({ 'GET /api/user/preferences': prefs('classic') });
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('classic'));
    const urls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes('/api/config'))).toBe(false);
  });

  it('sends a Classic user on a Workspace-only URL to its Classic page', async () => {
    renderGate({ 'GET /api/user/preferences': prefs('classic') }, { route: '/overview/reports' });
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/reports'));
  });

  it('keeps the basename when it redirects', async () => {
    renderGate(
      { 'GET /api/user/preferences': prefs('classic') },
      { route: '/meshmonitor/preferences/appearance', basename: '/meshmonitor' },
    );
    // Under a basename, useLocation() reports the path below it.
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/settings'));
  });

  it.each([
    ['/meshmonitor/source/s1/settings/lora', '/source/s1/configuration#config-lora'],
    ['/meshmonitor/source/s1/settings/notifications', '/source/s1/settings#settings-notifications'],
    ['/meshmonitor/source/s1/settings?node=!a1b2c3d4', '/source/s1/admin'],
  ])('sends a Classic user on %s to today\'s section under the basename', async (route, expected) => {
    renderGate({ 'GET /api/user/preferences': prefs('classic') }, { route, basename: '/meshmonitor' });
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe(expected));
  });

  it('renders straight from the localStorage mirror before the fetches land', async () => {
    localStorage.setItem('mm.layout', 'workspace');
    renderGate({}, { hang: true });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
  });

  it('renders Classic synchronously when there is no mirror', () => {
    renderGate({}, { hang: true });
    expect(screen.getByTestId('classic')).toHaveTextContent('/');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('never blocks Classic on a stalled /api/settings', async () => {
    renderGate({}, { hang: '/api/settings' });
    expect(screen.getByTestId('classic')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('classic')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });

  it('keeps a workspace mirror when /api/settings fails', async () => {
    localStorage.setItem('mm.layout', 'workspace');
    renderGate({ 'GET /api/settings': () => new Response('{}', { status: 500 }) });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(localStorage.getItem('mm.layout')).toBe('workspace');
  });

  it('holds a Workspace-only URL while the layout is unknown, so the deep link survives', async () => {
    renderGate({}, { route: '/overview/reports', hang: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('classic')).toBeNull();
  });

  it('sends a Workspace-only URL to Classic when the layout cannot be fetched', async () => {
    renderGate({ 'GET /api/user/preferences': () => new Response('{}', { status: 500 }) }, { route: '/overview/reports' });
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/reports'));
  });

  it.each([
    ['/packet-monitor', undefined],
    ['/meshmonitor/packet-monitor', '/meshmonitor'],
  ])('renders the Workspace pop-out window, without the shell, for %s and a Workspace user (18-01)', async (route, basename) => {
    renderGate({ 'GET /api/user/preferences': prefs('workspace') }, { route, basename });
    expect(await screen.findByTestId('packets-popout')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-app')).toBeNull();
    expect(screen.queryByTestId('classic')).toBeNull();
  });

  it('keeps today\'s pop-out window for a Classic user', async () => {
    renderGate({ 'GET /api/user/preferences': prefs('classic') }, { route: '/packet-monitor' });
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('classic'));
    expect(screen.getByTestId('classic').textContent).toBe('/packet-monitor');
    expect(screen.queryByTestId('packets-popout')).toBeNull();
  });

  it.each([
    ['/privacy/terms', undefined],
    ['/meshmonitor/privacy/terms', '/meshmonitor'],
  ])('renders Classic for public page %s even for a Workspace user', async (route, basename) => {
    renderGate({ 'GET /api/user/preferences': prefs('workspace') }, { route, basename });
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('workspace'));
    expect(screen.getByTestId('classic').textContent).toBe(route.replace('/meshmonitor', ''));
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });
});
