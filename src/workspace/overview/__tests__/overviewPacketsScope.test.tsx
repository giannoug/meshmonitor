/**
 * @vitest-environment jsdom
 *
 * Review Focus 2 on Overview › Packets and Telemetry: a viewer who can read
 * Station G2 and Athens MQTT but not Rooftop RAK sees no RAK row, tag, chart
 * entry, filter option, section or legend line, through the real gate
 * (AuthContext's `hasPermission` and the shell's readable devices), even when
 * a reply carries RAK data. The server side of the same rule is
 * `src/server/routes/unifiedRoutes.packetsScope.test.ts` (packets) and
 * `unifiedRoutes.telemetryScope.test.ts` (telemetry).
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { SOURCE_IDS as S } from '../../__fixtures__/athens';
import { captureOn } from '../../__fixtures__/packets';
import { renderMessages, type MessagesOptions } from './renderMessages';

const renderPage = (route: string, opts: MessagesOptions = {}) =>
  renderMessages(route, { ...opts, fixtures: { ...captureOn, ...opts.fixtures } });

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const READ = { read: true, write: false };
const NO_RAK = {
  global: {},
  bySource: { [S.g2]: { packetmonitor: READ, messages: READ }, [S.mqtt]: { packetmonitor: READ, messages: READ } },
};

describe('Overview › Packets and Telemetry: per-source read (Review Focus 2)', () => {
  withRowLayout();

  it('Packets shows no row, tag, chart entry or filter option from a device the viewer cannot read', async () => {
    renderPage('/overview/packets', { permissions: NO_RAK });
    const [cell] = await screen.findAllByText('Hearing you direct from Marousi', {}, { timeout: 5000 });
    expect(cell.closest('tr')).toHaveTextContent('SG');
    expect(screen.queryByText('Battery 71 %, 3.88 V')).toBeNull();
    expect(screen.queryByText('Battery 87 %, 4.02 V')).toBeNull();
    const bySource = screen.getByRole('region', { name: 'By Source' });
    await within(bySource).findByText('612');
    expect(within(bySource).queryByText('83')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const source = screen.getByRole('combobox', { name: 'Source' });
    expect(within(source).queryByRole('option', { name: 'Rooftop RAK' })).toBeNull();
    expect(within(source).getByRole('option', { name: 'Athens MQTT' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Rooftop RAK');
  });

  it('Telemetry shows no line, section, chip or option from a device the viewer cannot read', async () => {
    renderPage('/overview/telemetry', { permissions: NO_RAK });
    const [voltage] = await screen.findAllByRole('heading', { name: /^Voltage/ }, { timeout: 5000 });
    const legend = within(voltage.closest<HTMLElement>('[data-testid="combined-telemetry-chart"]')!).getByRole('list', { name: 'Sources' });
    expect(legend).toHaveTextContent('Station G2');
    expect(legend).not.toHaveTextContent('Rooftop RAK');
    expect(document.body).not.toHaveTextContent('Rooftop RAK');

    fireEvent.click(screen.getByRole('tab', { name: 'Latest' }));
    await screen.findAllByText('Kifisia Rooftop', {}, { timeout: 5000 });
    expect(screen.queryByRole('region', { name: 'Rooftop RAK' })).toBeNull();
    expect(screen.queryByText('Piraeus Base')).toBeNull();
    expect(document.body).not.toHaveTextContent('Rooftop RAK');
  });
});
