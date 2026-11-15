/**
 * @vitest-environment jsdom
 *
 * Board b-set-p4-modules (phone): Modules is a page; the unsupported modules
 * are one "Hidden: … Why?" line, the phone form of 12-07's folded row.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

describe('b-set-p4-modules', () => {
  it('b-set-p4-modules shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/modules`, { phone: true });
    await within(await screen.findByRole('list', { name: 'Supported' }, { timeout: 5000 })).findByText('Traffic Management');
    expectBoard('b-set-p4-modules', container);
    expect(screen.getByTestId('settings-back')).toHaveAttribute('href', `${g2}/settings`);
  });

  it('Why? shows the hidden modules, each still reachable', async () => {
    renderSettings(`${g2}/settings/modules`, { phone: true });
    await within(await screen.findByRole('list', { name: 'Supported' }, { timeout: 5000 })).findByText('Traffic Management');
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByRole('link', { name: /^TAK/ })).toHaveAttribute('href', `${g2}/settings/modules/tak`);
  });
});
