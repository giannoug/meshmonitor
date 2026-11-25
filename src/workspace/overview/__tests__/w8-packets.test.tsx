/**
 * @vitest-environment jsdom
 *
 * Overview › Packets own-issues (W8): the chart bars take the hook's colours
 * (O5a), the Dir cell carries its title (O5e), and the relay estimate reads no
 * poll (O5c).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { DISTRIBUTION_COLORS } from '../../../components/packetStatsChartData';
import { captureOn } from '../../__fixtures__/packets';
import { renderMessages } from './renderMessages';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const render = () => renderMessages('/overview/packets', { fixtures: captureOn });
async function row(text: string): Promise<HTMLElement> {
  const [cell] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return cell.closest<HTMLElement>('tr')!;
}
/** A colour as the DOM reports it (`#89b4fa` reads back as `rgb(…)`). */
const asDom = (c: string) => {
  const el = document.createElement('i');
  el.style.background = c;
  return el.style.background;
};

describe('Overview › Packets (W8)', () => {
  withRowLayout();

  it('chart bars use the hook\'s per-series colour', async () => {
    render();
    await row('Hearing you direct from Marousi');
    const byDevice = screen.getByRole('region', { name: 'By Device' });
    const fills = await within(byDevice).findAllByRole('listitem').then((li) => li.map((x) => x.querySelector<HTMLElement>('[style*="width"]')!));
    expect(fills.map((f) => f.style.background)).toEqual(fills.map((_, i) => asDom(DISTRIBUTION_COLORS[i])));
  });

  it('Dir cell has the direction title', async () => {
    render();
    const first = await row('Hearing you direct from Marousi');
    expect(within(first).getByTitle('Received')).toHaveTextContent('RX');
  });

  it('opening RelayModal makes no /api/poll request', async () => {
    render();
    fireEvent.click(await row('Hearing you direct from Marousi'));
    const panel = await screen.findByRole('complementary', { name: 'Raw packet #4821' });
    fireEvent.click(within(panel).getByRole('button', { name: 'via 0x12' }));
    expect(await screen.findByText('Message Relay Information')).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls.filter(([u]) => String(u).includes('/api/poll'))).toEqual([]);
  });
});
