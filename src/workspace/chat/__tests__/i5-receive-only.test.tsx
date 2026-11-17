/**
 * @vitest-environment jsdom
 *
 * Board i5 (Task 6.7): a channel on a receive-only (MQTT) device, on the
 * phone. The header says Receive-only; one line takes the composer's place,
 * with today's reason and Switch to the same channel on a device with a radio.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const mqtt = `/source/${SOURCE_IDS.mqtt}/channel/0`;

async function channel() {
  const result = renderChat(mqtt, { phone: true });
  await screen.findByText('Glyfada Beach checking in');
  await screen.findByText(/no radio of its own/);
  return result;
}

describe('i5 receive-only', () => {
  it('i5-receive-only shows the board', async () => {
    const { container } = await channel();
    expectBoard('i5-receive-only', container);
  });

  it('one line in place of the composer, with Switch to the channel on a device with a radio', async () => {
    await channel();
    expect(document.querySelector('textarea')).toBeNull();
    const note = screen.getByText(/no radio of its own/).closest('[role="note"]') as HTMLElement;
    expect(within(note).getByRole('link', { name: 'Switch' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}/channel/0`);
    const header = screen.getByRole('heading', { name: '# LongFast' }).closest('header') as HTMLElement;
    expect(header).toHaveTextContent('Athens MQTTReceive-only');
  });
});
