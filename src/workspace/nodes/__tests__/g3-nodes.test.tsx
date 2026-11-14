/**
 * @vitest-environment jsdom
 *
 * Board g3-nodes (phone): the Nodes list with its own header (Back, Add node
 * from URL, Show on Map), the search, the quick chips and Filters, and
 * two-line rows that open the node page.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { SOURCE_IDS } from '../../__fixtures__/athens';
import { renderChat } from '../../chat/__tests__/renderChat';

vi.mock('../../../contexts/WebSocketContext', async (orig) => ({
  ...(await orig<object>()),
  WebSocketProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../App', async () => ({ default: (await import('../../__tests__/pageStub')).pageStub('app') }));

const g2 = `/source/${SOURCE_IDS.g2}`;
const route = `${g2}/nodes`;

const list = () => screen.findByRole('list', { name: 'Nodes' }, { timeout: 5000 });

describe('g3-nodes', () => {
  it('g3-nodes shows the board', async () => {
    const { container } = renderChat(route, { phone: true });
    await within(await list()).findByText('Kifisia Rooftop');
    expectBoard('g3-nodes', container);
    expect(screen.queryByTestId('page-app')).toBeNull();
  });

  it('a row opens the node page', async () => {
    renderChat(route, { phone: true });
    fireEvent.click(await within(await list()).findByRole('button', { name: /Kifisia Rooftop/ }));
    // Until Task 3.4's node page, the node page URL shows today's node details (App at Classic's messages).
    expect(await screen.findByTestId('page-app')).toBeInTheDocument();
    expect(screen.getByTestId('seen-location')).toHaveTextContent(`${g2}/messages`);
  });

  it('a row reads hops, battery and distance, and an import says it was not heard yet', async () => {
    renderChat(route, { phone: true });
    const rows = await list();
    const kifisia = await within(rows).findByRole('button', { name: /Kifisia Rooftop/ });
    expect(kifisia).toHaveTextContent('2 hops · 88% · 12.4 km');
    expect(within(rows).getByText('Added from a contact link; not heard on the mesh yet')).toBeInTheDocument();
    expect(within(rows).getByText('Imported')).toBeInTheDocument();
  });

  it('Direct keeps the direct nodes, and a second tap shows all again', async () => {
    renderChat(route, { phone: true });
    const rows = await list();
    await within(rows).findByText('Kifisia Rooftop');
    const direct = screen.getByRole('button', { name: 'Direct' });
    fireEvent.click(direct);
    await waitFor(() => expect(within(rows).queryByText('Kifisia Rooftop')).toBeNull());
    expect(within(rows).getByText('Station G2')).toBeInTheDocument();
    fireEvent.click(direct);
    expect(await within(rows).findByText('Kifisia Rooftop')).toBeInTheDocument();
  });

  it('Back leads Home and the map button to the map', async () => {
    renderChat(route, { phone: true });
    await list();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', g2);
    expect(screen.getByRole('link', { name: 'Show on Map' })).toHaveAttribute('href', `${g2}/map`);
  });
});
