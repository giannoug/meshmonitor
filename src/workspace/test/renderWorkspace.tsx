/**
 * Render a Workspace subtree the way the app does, against the Athens fixture.
 *
 * - Real English strings from `public/locales/en.json`: a real i18next instance
 *   in an `<I18nextProvider>`, which the global react-i18next mock hands over
 *   to (see `withRealProvider` in src/test/mockI18n.ts).
 * - `QueryClientProvider`, `MemoryRouter` at `route`, `CsrfProvider`,
 *   `AuthProvider`, and a `SourceProvider` when `route` is `/source/:id/...`.
 * - `global.fetch` is a `vi.fn` over `fixtureApi(fixtures)`; an unmatched
 *   request gets a 404. `/api/auth/status` follows `anonymous`, `isAdmin` and
 *   `permissions`; a test's own `fixtures` win over both.
 * - `window.matchMedia` answers min/max-width queries for a 390 px (`phone`)
 *   or 1280 px viewport.
 * fetch and matchMedia are restored when the test finishes.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactElement } from 'react';
import { vi, onTestFinished } from 'vitest';
import { render, type RenderResult } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CsrfProvider } from '../../contexts/CsrfContext';
import { AuthProvider, type AuthStatus } from '../../contexts/AuthContext';
import { SourceProvider } from '../../contexts/SourceContext';
import type { SourcedPermissionSet } from '../../types/permission';
import { athensFixture } from '../__fixtures__/athens';
import { fixtureApi } from '../__fixtures__/fixtureApi';

const en = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/locales/en.json'), 'utf8'),
) as Record<string, string>;

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  initAsync: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export interface RenderWorkspaceOptions {
  route?: string;
  phone?: boolean;
  /** Non-admin grants. Passing them makes the user a non-admin unless `isAdmin` says otherwise. */
  permissions?: Partial<SourcedPermissionSet>;
  /** Default: true, or false when `permissions` is given. */
  isAdmin?: boolean;
  anonymous?: boolean;
  fixtures?: Parameters<typeof fixtureApi>[0];
}

function authStatusFor(opts: RenderWorkspaceOptions): AuthStatus {
  const base = athensFixture.authStatus;
  const permissions = { global: {}, bySource: {}, ...opts.permissions };
  if (opts.anonymous) return { ...base, authenticated: false, user: null, permissions };
  const isAdmin = opts.isAdmin ?? !opts.permissions;
  return { ...base, user: { ...base.user!, isAdmin }, permissions };
}

/** Evaluate `(min-width: Npx)` / `(max-width: Npx)` clauses joined by `and` at `width`. */
function mediaMatches(query: string, width: number): boolean {
  const clauses = query.split(/\s+and\s+/);
  return clauses.every((clause) => {
    const m = clause.match(/\((min|max)-width:\s*([\d.]+)px\)/);
    if (!m) return false;
    return m[1] === 'min' ? width >= Number(m[2]) : width <= Number(m[2]);
  });
}

export function renderWorkspace(ui: ReactElement, opts: RenderWorkspaceOptions = {}): RenderResult {
  const route = opts.route ?? '/';
  const authStatus = authStatusFor(opts);
  const api = fixtureApi({ 'GET /api/auth/status': () => authStatus, ...opts.fixtures });

  const prevFetch = globalThis.fetch;
  const prevMatchMedia = window.matchMedia;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    return (
      api(url, { ...init, method }) ??
      new Response(JSON.stringify({ error: `No fixture for ${method} ${url}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    );
  }) as typeof fetch;
  const width = opts.phone ? 390 : 1280;
  window.matchMedia = vi.fn((query: string) => ({
    matches: mediaMatches(query, width),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onTestFinished(() => {
    queryClient.clear();
    globalThis.fetch = prevFetch;
    window.matchMedia = prevMatchMedia;
  });

  const sourceId = route.match(/^\/source\/([^/?#]+)/)?.[1];
  const source = athensFixture.sources.find((s) => s.id === sourceId);
  const content = sourceId ? (
    <SourceProvider sourceId={sourceId} sourceName={source?.name ?? null} sourceType={source?.type ?? null}>
      {ui}
    </SourceProvider>
  ) : (
    ui
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <I18nextProvider i18n={i18n}>
          <CsrfProvider>
            <AuthProvider>{content}</AuthProvider>
          </CsrfProvider>
        </I18nextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
