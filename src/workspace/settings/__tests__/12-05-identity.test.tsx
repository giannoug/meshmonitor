/**
 * @vitest-environment jsdom
 *
 * Boards 12-05-identity (desktop) and 12-21-identity (phone): Node Identity on
 * the row kit with today's labels, the node's ID and role (set on Device ›
 * Device), and an edit that queues in the radio save bar as "Save (may
 * restart)", which sends nothing on the mesh.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { g2, realUrl, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

afterEach(() => vi.restoreAllMocks());

const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });
const shortName = async () => {
  const input = await screen.findByLabelText('Short Name', {}, { timeout: 5000 });
  await waitFor(() => expect(input).toHaveValue('G2'));
  return input;
};

describe('12-05-identity', () => {
  it('12-05-identity shows the board', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const { container } = renderSettings(`${g2}/settings/identity`);
    fireEvent.change(await shortName(), { target: { value: 'SG2' } });
    await within(await bar()).findByText('Save (may restart)');
    expect(screen.getByText('was G2')).toBeInTheDocument();
    expect(screen.getByText('!a1b2c300')).toBeInTheDocument();
    expect(screen.getByText('3 / 4 characters')).toBeInTheDocument();
    expectBoard('12-05-identity', container);
  });

  it('12-21-identity shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/identity`, { phone: true });
    fireEvent.change(await shortName(), { target: { value: 'SG2' } });
    await within(await bar()).findByText('Save (may restart)');
    expect(await bar()).toHaveTextContent('Sends nothing on the mesh');
    expectBoard('12-21-identity', container);
  });

  it('Role opens Device › Device, where it is set', async () => {
    renderSettings(`${g2}/settings/identity`);
    await shortName();
    fireEvent.click(screen.getByRole('link', { name: /CLIENT/ }));
    await waitFor(() => expect(realUrl()).toBe(`${g2}/settings/device/device`));
  });

  it('the short name takes at most 4 characters, as today', async () => {
    renderSettings(`${g2}/settings/identity`);
    expect(await shortName()).toHaveAttribute('maxLength', '4');
    expect(screen.getByLabelText('Long Name')).toHaveAttribute('maxLength', '39');
  });

  it('a read-only viewer gets disabled rows', async () => {
    renderSettings(`${g2}/settings/identity`, {
      permissions: { bySource: { [SOURCE_IDS.g2]: { configuration: { read: true, write: false }, settings: { read: true, write: false } } } },
    });
    expect(await shortName()).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Unmessageable' })).toBeDisabled();
  });
});
