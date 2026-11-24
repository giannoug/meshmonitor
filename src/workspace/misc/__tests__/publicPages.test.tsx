/**
 * @vitest-environment jsdom
 *
 * Boards 17-05 / 17-12 (privacy document) and 17-06 / 17-13 (embed map), Task
 * 9.2: verified, not changed. `/privacy/:slug` is today's public page outside
 * both layouts (LayoutGate hands it to Classic's route table even for a
 * Workspace user), and `/embed/:profileId` is its own Vite entry
 * (`embed.html` → `src/embed.tsx`), served by its own server route, which
 * never loads the app or the Workspace. What each renders is today's.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { renderWorkspace } from '../../test/renderWorkspace';
import { EMBED_PROFILE, embedFixtures, privacyFixtures } from '../../__fixtures__/oddPages';
import LayoutGate from '../../LayoutGate';
import PrivacyDocumentPage from '../../../pages/PrivacyDocumentPage';
import { EmbedMap } from '../../../components/EmbedMap';

const layout = vi.hoisted(() => ({ value: 'workspace' as 'workspace' | 'classic' }));
vi.mock('../../layout/useLayout', () => ({ useLayout: () => ({ layout: layout.value, ready: true }) }));
vi.mock('../../WorkspaceApp', () => ({ default: () => <p>workspace app</p> }));
// The map needs a layout engine: the shell passes its children through, and each Leaflet layer draws its contents.
vi.mock('../../../components/map/BaseMap', () => ({ BaseMap: ({ children }: { children: ReactNode }) => <div data-testid="map">{children}</div> }));
vi.mock('react-leaflet', () => {
  const Through = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Marker: Through, Tooltip: Through, Popup: Through, Polyline: Through, GeoJSON: () => null };
});

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const T = { timeout: 10_000 };

function gate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LayoutGate classic={<p>classic routes</p>} />
    </MemoryRouter>,
  );
}

describe('public pages render outside both layouts', () => {
  it('/privacy/:slug goes to Classic\'s route table even for a Workspace user', async () => {
    layout.value = 'workspace';
    gate('/privacy/privacy');
    expect(screen.getByText('classic routes')).toBeInTheDocument();
    expect(screen.queryByText('workspace app')).toBeNull();
  });

  it('…while any other path of a Workspace user loads the Workspace (the control)', async () => {
    layout.value = 'workspace';
    gate('/source/src-g2/messages');
    expect(await screen.findByText('workspace app')).toBeInTheDocument();
  });

  it('/embed/:profileId is its own entry, which loads only EmbedMap', () => {
    const html = readFileSync(join(root, 'embed.html'), 'utf8');
    expect(html).toContain('src="/src/embed.tsx"');
    const entry = readFileSync(join(root, 'src/embed.tsx'), 'utf8');
    const imports = [...entry.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['react-dom/client', './components/EmbedMap']);
    const server = readFileSync(join(root, 'src/server/staticServing.ts'), 'utf8');
    expect(server).toMatch(/app\.get\('\/embed\/:profileId'[\s\S]*?'embed\.html'/);
  });
});

/** A viewer reading in British English, as the board's "2 November 2026". */
function britishViewer(children: ReactNode) {
  const en = JSON.parse(readFileSync(join(root, 'public/locales/en.json'), 'utf8')) as Record<string, string>;
  const i18n = createInstance();
  void i18n.init({ lng: 'en-GB', fallbackLng: 'en', resources: { en: { translation: en } }, initAsync: false, interpolation: { escapeValue: false } });
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

const privacy = (path: string) =>
  renderWorkspace(britishViewer(<Routes><Route path="privacy/:slug" element={<PrivacyDocumentPage />} /></Routes>), { route: path, anonymous: true, fixtures: privacyFixtures() });

describe('17-05 / 17-12 privacy document (today\'s page)', () => {
  it('shows the hosted document with Last updated', async () => {
    privacy('/privacy/privacy');
    expect(await screen.findByRole('heading', { name: 'Privacy Policy', level: 1 }, T)).toBeInTheDocument();
    expect(screen.getByText('Last updated')).toBeInTheDocument();
    expect(screen.getByText('2 November 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What this instance collects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'privacy@athensmesh.gr' })).toHaveAttribute('href', 'mailto:privacy@athensmesh.gr');
  });

  it('a document that is not published: Document not found', async () => {
    privacy('/privacy/cookies');
    expect(await screen.findByRole('heading', { name: 'Document not found' }, T)).toBeInTheDocument();
    expect(screen.getByText('This MeshMonitor instance has not published that document.')).toBeInTheDocument();
  });

  it('today\'s slugs are privacy, terms and contact: the board\'s /privacy/privacy-policy is not one', async () => {
    privacy('/privacy/privacy-policy');
    expect(await screen.findByRole('heading', { name: 'Document not found' }, T)).toBeInTheDocument();
  });
});

describe('17-06 / 17-13 embed map (today\'s page)', () => {
  it('draws the profile\'s nodes with names, popups, traceroute popups, the hop legend and the policy links', async () => {
    // The embed reads its API base from its own URL, as on /embed/<profile>.
    window.history.pushState({}, '', `/embed/${EMBED_PROFILE}`);
    renderWorkspace(<EmbedMap profileId={EMBED_PROFILE} />, { anonymous: true, fixtures: embedFixtures() });
    const map = await screen.findByTestId('map', {}, T);
    await within(map).findAllByText('Hymettus Relay', {}, T);
    for (const s of ['HYM', '!5d21b7f0', 'Router', 'RAK4631', '1 hop', '-4 dB', '1026m', 'Ch 0', 'Lycabettus Repeater']) {
      expect(within(map).getAllByText(s).length).toBeGreaterThan(0);
    }
    expect(within(map).getAllByText('Traceroute Segment').length).toBeGreaterThan(0);
    expect(within(map).getByText('Station G2 ↔ Halandri Relay')).toBeInTheDocument();
    expect(within(map).getByText('6.5 dB')).toBeInTheDocument();
    expect(await screen.findByText('13 nodes online')).toBeInTheDocument();
    for (const s of ['Local', '2 hops', '3 hops', '4+ hops', 'Unknown']) expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    for (const s of ['Privacy Policy', 'Terms of Service', 'Contact']) expect(await screen.findByRole('link', { name: s })).toBeInTheDocument();
    // s17n3: no polling indicator, and the legend lists hops only (no SNR or neighbour entries).
    expect(screen.queryByText(/updated|polling|refresh/i)).toBeNull();
    expect(screen.queryByText(/SNR/)).toBeNull();
  });
});
