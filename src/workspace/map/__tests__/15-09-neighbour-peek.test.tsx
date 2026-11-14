/**
 * @vitest-environment jsdom
 *
 * Board 15-09 (desktop): the neighbour link peek. The board draws a
 * bidirectional RF link and a one-way MQTT link side by side; built one at a
 * time (D9c), each is rendered with the server's enriched neighbour row and
 * the two are checked together.
 */
import { describe, it, expect } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { joined } from '../../chat/__tests__/renderChat';
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
    { route },
  );

describe('15-09-neighbour-peek', () => {
  it('15-09-neighbour-peek shows the board', async () => {
    const first = peek(both);
    await screen.findByText('Bidirectional');
    const text = first.container.textContent ?? '';
    cleanup();
    const second = peek(oneWay);
    await screen.findByText('One-way');
    expectBoard('15-09-neighbour-peek', joined(text, second.container));
  });

  it('a two-way link shows SNR each way with when it was heard', async () => {
    peek(both);
    const panel = await screen.findByRole('complementary', { name: 'Neighbour link' });
    expect(panel).toHaveTextContent('Hymettus Relay');
    expect(panel).toHaveTextContent('SNR +4.5 dB');
    expect(panel).toHaveTextContent('SNR -2.0 dB');
    expect(panel).toHaveTextContent('RF');
    expect(panel).toHaveTextContent(/heard 6 minutes ago/);
    expect(panel).toHaveTextContent(/heard 9 minutes ago/);
    expect(panel).toHaveTextContent('km');
  });

  it('a one-way link says there is no report back', async () => {
    peek(oneWay);
    const panel = await screen.findByRole('complementary', { name: 'Neighbour link' });
    expect(panel).toHaveTextContent('MQTT');
    expect(panel).toHaveTextContent('SNR -6.5 dB');
    expect(panel).toHaveTextContent('no report back');
  });

  it('Close calls back', async () => {
    let closed = false;
    peek(both, () => { closed = true; });
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(closed).toBe(true);
  });
});
