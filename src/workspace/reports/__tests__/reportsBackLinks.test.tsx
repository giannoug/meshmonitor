/**
 * @vitest-environment jsdom
 *
 * Every Overview › Reports page's "Back to reports" goes to the list under
 * the prefix the page was opened from, and `?report=coverage` opens Coverage
 * under either prefix.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderReports } from './renderReports';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const SLUGS = ['mesh-issues', 'coverage', 'solar', 'nodeinfo-enrichment', 'mqtt-violations', 'traceroute-explorer'];

describe('reports back links', () => {
  it.each(['/overview/reports', '/reports'].flatMap((base) => SLUGS.map((slug) => [base, slug] as const)))(
    '%s/%s goes back to %s',
    async (base, slug) => {
      renderReports(`${base}/${slug}`);
      expect(await screen.findByRole('link', { name: 'Back to reports' }, { timeout: 8000 })).toHaveAttribute('href', base);
    },
    15000,
  );

  it.each(['/overview/reports', '/reports'])('%s?report=coverage opens Coverage', async (base) => {
    renderReports(`${base}?report=coverage`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Coverage Report' }, { timeout: 8000 })).toBeInTheDocument();
  }, 15000);
});
