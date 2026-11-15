/**
 * @vitest-environment jsdom
 *
 * Board 18-02-packets-popout (phone, s18n1): the pop-out opened as a tab on a
 * phone is the full-screen monitor: Export and Close window in the header,
 * the device and count, Capture, Pause and Filters, two-line rows, and a row
 * tap opening the raw packet sheet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { withRowLayout } from '../../nodes/__tests__/rowLayout';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { captureOn } from '../../__fixtures__/packets';
import PacketsPopout from '../PacketsPopout';

afterEach(() => localStorage.clear());

async function packetRow(text: string): Promise<HTMLElement> {
  const [el] = await screen.findAllByText(text, {}, { timeout: 5000 });
  return el.closest<HTMLElement>('[data-testid="packet-row"]')!;
}

const renderWindow = () => renderWorkspace(<PacketsPopout />, { route: '/packet-monitor', phone: true, fixtures: captureOn });

describe('18-02-packets-popout', () => {
  withRowLayout();

  it('18-02-packets-popout shows the board', async () => {
    renderWindow();
    await packetRow('Nikos T-Echo');
    await screen.findByText(/200 shown \/ 1,284 total/);
    expectBoard('18-02-packets-popout', document.body);
  });

  it('a row reads type and sender, then direction, transport, destination, hops and SNR', async () => {
    renderWindow();
    expect(await packetRow('Nikos T-Echo')).toHaveTextContent(/^TEXT_MESSAGE_APPNikos T-EchoRX LoRa · Broadcast · 2 hops · -3 dB/);
  });

  it('a row tap opens the raw packet sheet', async () => {
    renderWindow();
    fireEvent.click(await packetRow('Nikos T-Echo'));
    expect(await screen.findByRole('dialog', { name: 'Raw packet #4821' })).toHaveTextContent('Size58 B');
  });

  it('the header holds Export and Close window', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    renderWindow();
    await packetRow('Nikos T-Echo');
    expect(screen.getByRole('button', { name: 'Export packets to JSONL' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });
});
