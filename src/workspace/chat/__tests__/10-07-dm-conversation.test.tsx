/**
 * @vitest-environment jsdom
 *
 * Board 10-07 (phone): the DM with its node actions sheet open (⋯): Ask the
 * node / Organise / Data, each item with today's label and its Sends line.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { joined, renderChat } from './renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const route = `/source/${SOURCE_IDS.g2}/dm/!a1b2c301`;

async function openSheet() {
  const result = renderChat(route, { phone: true });
  await screen.findByTestId('key-mismatch-warning');
  const actions = await screen.findByRole('button', { name: 'Node actions' });
  await waitFor(() => expect(actions).toBeEnabled());
  fireEvent.click(actions);
  return { ...result, sheet: await screen.findByRole('dialog', { name: /Kifisia Rooftop/ }) };
}

describe('10-07-dm-conversation', () => {
  it('10-07-dm-conversation shows the board', async () => {
    const { container, sheet } = await openSheet();
    await waitFor(() => expect(container).toHaveTextContent('Forward'));
    expectBoard('10-07-dm-conversation', joined(container, sheet));
  });

  it('the sheet switches between Ask the node, Organise and Data', async () => {
    const { sheet } = await openSheet();
    const s = within(sheet);
    expect(s.getByRole('tab', { name: 'Ask the node' })).toHaveAttribute('aria-selected', 'true');
    expect(s.getByRole('button', { name: /^Exchange Node Info/ })).toBeInTheDocument();
    fireEvent.click(s.getByRole('tab', { name: 'Organise' }));
    expect(s.getByRole('button', { name: /^Add to favorites/ })).toBeInTheDocument();
    expect(s.queryByRole('button', { name: /^Exchange Node Info/ })).toBeNull();
    fireEvent.click(s.getByRole('tab', { name: 'Data' }));
    expect(s.getByRole('button', { name: /^Purge Data/ })).toBeInTheDocument();
  });

  it('no device header: the DM draws its own, with Back', async () => {
    renderChat(route, { phone: true });
    await screen.findByTestId('key-mismatch-warning');
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', `/source/${SOURCE_IDS.g2}`);
    expect(screen.queryByRole('button', { name: /switch device/ })).toBeNull();
  });
});

// F.2 A23-M1: Escape closes only the top layer. In the 768–1023 px drawer layout a
// header menu open over the content closes on Escape, and the drawer stays.
describe('Escape with a header menu open in the drawer layout', () => {
  it('closes the menu only', async () => {
    renderChat(route, { width: 900 });
    fireEvent.click(await screen.findByRole('button', { name: 'Show sidebar' }));
    await screen.findByRole('complementary', { name: 'Station G2' });
    const ask = await screen.findByRole('button', { name: /Ask the node/ });
    fireEvent.click(ask);
    expect(ask).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(ask, { key: 'Escape' });
    expect(ask).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary', { name: 'Station G2' })).toBeInTheDocument();
  });
});
