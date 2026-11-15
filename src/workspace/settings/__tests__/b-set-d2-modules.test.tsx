/**
 * @vitest-environment jsdom
 *
 * Board b-set-d2-modules (desktop): Modules with the settings list beside it.
 * 12-07 redraws the same page (a folded row for the unsupported modules, a
 * "Supported" heading), so this test checks d2's remaining strings against it.
 */
import type { ReactNode } from 'react';
import { describe, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('b-set-d2-modules', () => {
  it('b-set-d2-modules shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/modules`);
    await within(await screen.findByRole('list', { name: 'Supported' }, { timeout: 5000 })).findByText('Traffic Management');
    expectBoard('b-set-d2-modules', container, { staged: ['⌘,', 'Search settings'] });
  });
});
