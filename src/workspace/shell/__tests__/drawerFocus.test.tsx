/**
 * @vitest-environment jsdom
 *
 * S23b (#6365): a drawer with nothing to focus takes focus itself.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

// A sidebar with no link or button in it.
vi.mock('../../overview/OverviewSidebar', () => ({ default: () => <p>Nothing to follow</p> }));

describe('drawer focus', () => {
  it('drawer with no focusable content focuses the sidebar box inside it', async () => {
    renderWorkspace(
      <ToastProvider>
        <WorkspaceShell>
          <span />
        </WorkspaceShell>
      </ToastProvider>,
      { route: '/overview', width: 900 },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Show sidebar' }));
    const drawer = document.getElementById('ws-drawer')!;
    await screen.findByText('Nothing to follow');
    // The wrapper is display: contents and cannot take focus; the sidebar's own box does.
    const box = drawer.firstElementChild as HTMLElement;
    await waitFor(() => expect(box).toHaveFocus());
    expect(box).toHaveAttribute('tabindex', '-1');
    expect(drawer).not.toHaveFocus();
  });
});
