/**
 * @vitest-environment jsdom
 *
 * A Dashboard health tile opens Nodes on its scope (Task 8.1): `?show=`
 * picks the chip; the tile-only scopes (Low battery, New today) show a chip of
 * their own while on, and pressing it goes back to all nodes.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';
import { withRowLayout } from './rowLayout';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

withRowLayout();

const route = `/source/${SOURCE_IDS.g2}/nodes`;
const table = () => screen.findByRole('table', {}, { timeout: 5000 });

describe('Nodes ?show=', () => {
  it('low-battery lists the nodes at 20 % or below, with a chip that clears it', async () => {
    renderChat(`${route}?show=low-battery`);
    await within(await table()).findByText('Athens Rover');
    expect(within(await table()).queryByText('Kifisia Rooftop')).toBeNull();
    const chip = screen.getByRole('button', { name: /^Low battery/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    await within(await table()).findByText('Kifisia Rooftop');
    expect(screen.queryByRole('button', { name: /^Low battery/ })).toBeNull();
  });

  it('online opens on the Online chip', async () => {
    renderChat(`${route}?show=online`);
    await within(await table()).findByText('Kifisia Rooftop');
    expect(screen.getByRole('button', { name: /^Online/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
