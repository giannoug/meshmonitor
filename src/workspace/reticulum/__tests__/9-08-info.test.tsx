/**
 * @vitest-environment jsdom
 *
 * Boards 9-08 (desktop) and 9-16 (phone): Info, native (Task 7.6). Own mode
 * reads "Unknown", as today (s9n2). It only reads.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RNS_URL, renderReticulum } from './renderReticulum';

vi.mock('../../../contexts/WebSocketContext', async (orig) => (await import('../../meshcore/__tests__/mocks')).wsMock(orig));

describe('9-08-info', () => {
  it('9-08-info shows the board', async () => {
    const { container } = renderReticulum(`${RNS_URL}/info`);
    await screen.findByText('0.9.6');
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expectBoard('9-08-info', container);
  });

  it('attach mode reads as today', async () => {
    renderReticulum(`${RNS_URL}/info`, {
      fixtures: { 'GET /api/sources/:id/reticulum/status': () => ({ success: true, data: { connected: true, mode: 'attach', interfaceCount: 4, destinationCount: 38 } }) },
    });
    expect(await screen.findByText('Attach (shared rnsd)')).toBeInTheDocument();
  });

  it('9-16-info shows the board', async () => {
    const { container } = renderReticulum(`${RNS_URL}/info`, { phone: true });
    await screen.findByText('0.9.6');
    expect(screen.getByRole('link', { name: /Tools/ })).toHaveAttribute('href', RNS_URL);
    expectBoard('9-16-info', container);
  });
});
