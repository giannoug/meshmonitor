/**
 * @vitest-environment jsdom
 *
 * S6 (#6365): the phone Home tab skips a last-open device that was disabled since.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { renderWorkspace } from '../../test/renderWorkspace';
import { athensFixture, SOURCE_IDS } from '../../__fixtures__/athens';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

function Goto() {
  const navigate = useNavigate();
  return <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />;
}

const renderShell = (g2Enabled: boolean) =>
  renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <Goto />
      </WorkspaceShell>
    </ToastProvider>,
    {
      route: `/source/${SOURCE_IDS.g2}/nodes`,
      phone: true,
      fixtures: { 'GET /api/sources': () => athensFixture.sources.map((s) => (s.id === SOURCE_IDS.g2 ? { ...s, enabled: g2Enabled } : s)) },
    },
  );

const homeHref = () =>
  screen.getAllByRole('link').find((a) => a.textContent === 'Home' && a.closest('nav'))?.getAttribute('href');

describe('phone Home tab', () => {
  it('Home skips a disabled last-open device', async () => {
    renderShell(false);
    const goto = await screen.findByTestId('goto');
    fireEvent.change(goto, { target: { value: '/you' } });
    await waitFor(() => expect(homeHref()).toBe('/overview'));
  });

  it('Home keeps an enabled last-open device', async () => {
    renderShell(true);
    fireEvent.change(await screen.findByTestId('goto'), { target: { value: '/you' } });
    await waitFor(() => expect(homeHref()).toBe(`/source/${SOURCE_IDS.g2}`));
  });
});
