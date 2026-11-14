/**
 * @vitest-environment jsdom
 *
 * A large mesh: the Nodes table and the phone list render only the rows near
 * the viewport (as Classic's virtualised list), and scrolling brings later
 * rows in, with working, focusable links (jsdom layout: `withRowLayout`).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { SOURCE_IDS, athensFixture } from '../../__fixtures__/athens';
import type { DeviceInfo } from '../../../types/device';
import { renderChat } from '../../chat/__tests__/renderChat';
import { withRowLayout } from './rowLayout';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const COUNT = 300;
const now = Math.floor(Date.now() / 1000);
const many: DeviceInfo[] = Array.from({ length: COUNT }, (_, i) => {
  const n = String(i + 1).padStart(3, '0');
  const num = 0x10000000 + i;
  return { nodeNum: num, user: { id: `!${num.toString(16)}`, longName: `Bulk ${n}`, shortName: `B${n}`, hwModel: 9, role: '0' }, lastHeard: now - 120, hopsAway: 1 };
});
const fixtures = { 'GET /api/poll': () => ({ ...athensFixture.poll, nodes: many }) };

withRowLayout();

function scrollTo(el: HTMLElement, top: number) {
  el.scrollTop = top;
  fireEvent.scroll(el);
}

describe('Nodes on a large mesh', () => {
  it('the table renders a window of rows, and scrolling brings later ones in', async () => {
    renderChat(`${g2}/nodes`, { fixtures });
    const table = await screen.findByRole('table', {}, { timeout: 5000 });
    await within(table).findByRole('link', { name: 'Bulk 001' });
    expect(table).toHaveAttribute('aria-rowcount', String(COUNT + 1));
    expect(within(table).getAllByRole('link').length).toBeLessThan(60);
    expect(within(table).queryByRole('link', { name: 'Bulk 260' })).toBeNull();

    scrollTo(table.parentElement!, 57 * 250);
    const late = await within(table).findByRole('link', { name: 'Bulk 260' });
    expect(late).toHaveAttribute('href', `${g2}/node/!${(0x10000000 + 259).toString(16)}`);
    expect(late.closest('tr')).toHaveAttribute('aria-rowindex', '261');
    late.focus();
    expect(late).toHaveFocus();
    expect(within(table).queryByRole('link', { name: 'Bulk 001' })).toBeNull();
  });

  it('the phone list renders a window of rows, and scrolling brings later ones in', async () => {
    renderChat(`${g2}/nodes`, { fixtures, phone: true });
    const list = await screen.findByRole('list', { name: 'Nodes' }, { timeout: 5000 });
    await within(list).findByRole('button', { name: /Bulk 001/ });
    expect(within(list).getAllByRole('listitem').length).toBeLessThan(60);
    expect(within(list).queryByRole('button', { name: /Bulk 260/ })).toBeNull();

    // Rows not yet measured count at the estimate, so go to the end rather than to a computed offset.
    scrollTo(list.parentElement!, 100_000);
    const late = await within(list).findByRole('button', { name: /Bulk 300/ });
    expect(late.closest('li')).toHaveAttribute('aria-posinset', '300');
    expect(within(list).queryByRole('button', { name: /Bulk 001/ })).toBeNull();
    late.focus();
    expect(late).toHaveFocus();
    fireEvent.click(late);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bulk 300' }, { timeout: 5000 })).toBeInTheDocument();
  });
});
