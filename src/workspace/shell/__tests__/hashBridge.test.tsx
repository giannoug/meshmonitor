/**
 * @vitest-environment jsdom
 *
 * S3 (#6365): the hashchange bridge for Classic's SectionNav does not double the browser's own event on
 * Back/Forward, and a re-click on the open category still fires one.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

function Probe() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="url">{pathname + hash}</output>
      <input data-testid="goto" onChange={(e) => void navigate(e.target.value)} />
      <button type="button" onClick={() => void navigate(-1)}>back</button>
    </>
  );
}

function renderShell(route: string) {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <Probe />
      </WorkspaceShell>
    </ToastProvider>,
    { route },
  );
}

const hashEvents = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.filter(([e]) => (e as Event).type === 'hashchange');

describe('hashchange bridge', () => {
  it('Back fires one hashchange', async () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    renderShell('/source/src-g2/settings/lora#config-lora');
    await screen.findByTestId('url');
    fireEvent.change(screen.getByTestId('goto'), { target: { value: '/source/src-g2/settings/power#config-power' } });
    expect(hashEvents(spy)).toHaveLength(1);
    // The browser fires the POP's own event; the bridge adds none.
    fireEvent.click(screen.getByText('back'));
    expect(screen.getByTestId('url')).toHaveTextContent('/source/src-g2/settings/lora#config-lora');
    expect(hashEvents(spy)).toHaveLength(1);
    spy.mockRestore();
  });

  it('re-clicking the open category fires one hashchange', async () => {
    renderShell('/source/src-g2/settings/lora');
    const side = await screen.findByRole('complementary', { name: 'Station G2' });
    const open = await (await import('@testing-library/react')).within(side).findByRole('link', { current: 'page' });
    const spy = vi.spyOn(window, 'dispatchEvent');
    fireEvent.click(open);
    expect(hashEvents(spy)).toHaveLength(1);
    spy.mockRestore();
  });
});
