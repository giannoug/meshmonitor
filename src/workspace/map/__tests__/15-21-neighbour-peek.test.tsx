/**
 * @vitest-environment jsdom
 *
 * Board 15-21 (phone): the neighbour link peek as a bottom sheet. As on 15-09,
 * the board's two links (bidirectional RF, one-way MQTT) are built one at a
 * time (D9c) and checked together.
 */
import { describe, it, expect } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { appBasename } from '../../../init';
import NeighbourPeek, { type NeighbourLink } from '../NeighbourPeek';

const [both, oneWay] = athensFixture.neighborInfo;
const route = `/source/${SOURCE_IDS.g2}/map`;
const peek = (link: NeighbourLink, onClose = () => {}) =>
  renderWorkspace(
    <SettingsProvider baseUrl={appBasename}>
      <NeighbourPeek link={link} onClose={onClose} />
    </SettingsProvider>,
    { route, phone: true },
  );

describe('15-21-neighbour-peek', () => {
  it('15-21-neighbour-peek shows the board', async () => {
    peek(both);
    await screen.findByText('Bidirectional');
    const text = document.body.textContent ?? '';
    cleanup();
    peek(oneWay);
    await screen.findByText('One-way');
    const el = document.createElement('div');
    el.textContent = `${text} ${document.body.textContent}`;
    expectBoard('15-21-neighbour-peek', el);
  });

  it('is a bottom sheet with SNR each way', async () => {
    peek(both);
    const sheet = await screen.findByRole('dialog', { name: /Neighbour link/ });
    expect(sheet).toHaveAttribute('data-side', 'bottom');
    expect(within(sheet).getByText(/Hymettus Relay/, { selector: 'h2 *' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('SNR +4.5 dB');
    expect(sheet).toHaveTextContent('SNR -2.0 dB');
  });

  it('Close calls back', async () => {
    let closed = false;
    peek(both, () => { closed = true; });
    fireEvent.click(within(await screen.findByRole('dialog', { name: /Neighbour link/ })).getByRole('button', { name: 'Close' }));
    expect(closed).toBe(true);
  });
});
