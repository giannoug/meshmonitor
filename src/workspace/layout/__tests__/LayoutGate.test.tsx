/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { fixtureApi } from '../../__fixtures__/fixtureApi';
import LayoutGate from '../../LayoutGate';

vi.mock('../../WorkspaceApp', () => ({ default: () => <div data-testid="workspace-app" /> }));

function Where() {
  const { pathname } = useLocation();
  return <div data-testid="classic">{pathname}</div>;
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

const config = (workspacePreview: boolean) => () => ({ baseUrl: '', workspacePreview });
const prefs = (layout?: string) => () => ({ success: true, data: { preferences: layout ? { layout } : {} } });

beforeEach(() => {
  prevFetch = globalThis.fetch;
  localStorage.clear();
});
afterEach(() => {
  globalThis.fetch = prevFetch;
});

describe('LayoutGate', () => {
  it('renders Classic when the preview flag is off, whatever the user chose', async () => {
    renderGate({ 'GET /api/config': config(false), 'GET /api/user/preferences': prefs('workspace') });
    expect(await screen.findByTestId('classic')).toHaveTextContent('/');
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });

  it('renders the Workspace when the preview flag is on and the user chose it', async () => {
    renderGate({ 'GET /api/config': config(true), 'GET /api/user/preferences': prefs('workspace') });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
    expect(localStorage.getItem('mm.layout')).toBe('workspace');
  });

  it('sends a Classic user on a Workspace-only URL to its Classic page', async () => {
    renderGate(
      { 'GET /api/config': config(true), 'GET /api/user/preferences': prefs('classic') },
      { route: '/overview/reports' },
    );
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/reports'));
  });

  it('keeps the basename when it redirects', async () => {
    renderGate(
      { 'GET /api/config': config(false) },
      { route: '/meshmonitor/preferences/appearance', basename: '/meshmonitor' },
    );
    // Under a basename, useLocation() reports the path below it.
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/settings'));
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
    renderGate({ 'GET /api/config': config(true) }, { hang: '/api/settings' });
    expect(screen.getByTestId('classic')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId('classic')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });

  it('keeps a workspace mirror when /api/config fails', async () => {
    localStorage.setItem('mm.layout', 'workspace');
    renderGate({ 'GET /api/config': () => new Response('{}', { status: 500 }) });
    expect(await screen.findByTestId('workspace-app')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(localStorage.getItem('mm.layout')).toBe('workspace');
  });

  it('fetches neither preferences nor settings when the preview flag is off', async () => {
    renderGate({ 'GET /api/config': config(false) });
    await new Promise((r) => setTimeout(r, 50));
    const urls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes('/api/user/preferences') || u.includes('/api/settings'))).toBe(false);
  });

  it('holds a Workspace-only URL while the layout is unknown, so the deep link survives', async () => {
    renderGate({}, { route: '/overview/reports', hang: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('classic')).toBeNull();
  });

  it('sends a Workspace-only URL to Classic when the layout cannot be fetched', async () => {
    renderGate({ 'GET /api/config': () => new Response('{}', { status: 500 }) }, { route: '/overview/reports' });
    await waitFor(() => expect(screen.getByTestId('classic').textContent).toBe('/reports'));
  });

  it.each([
    ['/privacy/terms', undefined],
    ['/packet-monitor', undefined],
    ['/meshmonitor/privacy/terms', '/meshmonitor'],
    ['/meshmonitor/packet-monitor', '/meshmonitor'],
  ])('renders Classic for public page %s even for a Workspace user', async (route, basename) => {
    renderGate(
      { 'GET /api/config': config(true), 'GET /api/user/preferences': prefs('workspace') },
      { route, basename },
    );
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('workspace'));
    expect(screen.getByTestId('classic').textContent).toBe(route.replace('/meshmonitor', ''));
    expect(screen.queryByTestId('workspace-app')).toBeNull();
  });
});
