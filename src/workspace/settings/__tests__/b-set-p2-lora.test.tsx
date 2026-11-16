/**
 * @vitest-environment jsdom
 *
 * Boards b-set-p2-lora and b-set-p3-sheet (phone): LoRa as its own page, the
 * save bar docked above the tab bar with "Sends nothing on the mesh", the
 * modem preset sheet with the radio's current value marked, and the list's
 * one-line bar (b-set-p1) once something is queued.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { g2deviceConfigWith } from './radioFixtures';
import { g2, goTo, renderSettings } from './renderSettings';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const bar = () => screen.findByRole('region', { name: 'Unsaved radio changes' });

async function editHops() {
  const hops = await screen.findByLabelText('Hop Limit', {}, { timeout: 5000 });
  await waitFor(() => expect(hops).toHaveValue(3));
  fireEvent.click(within(hops.closest('[data-setting-id]') as HTMLElement).getByRole('button', { name: 'Increase' }));
  return hops;
}

describe('b-set-p2-lora', () => {
  it('b-set-p2-lora shows the board', async () => {
    const { container } = renderSettings(`${g2}/settings/lora`, { phone: true });
    await editHops();
    const region = await bar();
    expect(region).toHaveTextContent('1 change · LoRa');
    expect(within(region).getByText('Sends nothing on the mesh')).toBeInTheDocument();
    expect(screen.getByText('was 3')).toBeInTheDocument();
    expect(screen.getByText('· saving restarts the node')).toBeInTheDocument();
    expectBoard('b-set-p2-lora', container);
  });

  it('the settings list shows the queue in one line, and Review opens the sheet', async () => {
    renderSettings(`${g2}/settings/lora`, { phone: true });
    await editHops();
    goTo(`${g2}/settings`);
    const region = await bar();
    expect(region).toHaveTextContent('1 unsaved change');
    fireEvent.click(within(region).getByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('dialog', { name: 'Review changes' })).toBeInTheDocument();
  });
});

describe('b-set-p3-sheet', () => {
  it('b-set-p3-sheet shows the board', async () => {
    renderSettings(`${g2}/settings/lora`, { phone: true, fixtures: g2deviceConfigWith({ modemPreset: 4, region: 1 }) });
    const button = await screen.findByRole('button', { name: /Modem Preset/ }, { timeout: 5000 });
    await waitFor(() => expect(button).toHaveTextContent('MEDIUM_FAST'));
    fireEvent.click(button);
    const sheet = await screen.findByRole('dialog', { name: 'Modem Preset' });
    fireEvent.click(within(sheet).getByRole('radio', { name: /^LONG_FAST/ }));
    fireEvent.click(screen.getByRole('button', { name: /Modem Preset/ }));
    const again = await screen.findByRole('dialog', { name: 'Modem Preset' });
    expect(within(again).getByRole('radio', { name: /^LONG_FAST/ })).toBeChecked();
    expect(within(again).getByRole('radio', { name: /^MEDIUM_FAST/ })).toHaveAccessibleName(/Current value on the radio/);
    expectBoard('b-set-p3-sheet', document.body);
  });
});
