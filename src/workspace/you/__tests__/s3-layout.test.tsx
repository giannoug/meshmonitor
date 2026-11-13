/**
 * @vitest-environment jsdom
 *
 * Board s3-layout (Task 1.8): You › Layout on the phone, under the tab bar.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import LayoutPage from '../LayoutPage';

function renderPhone() {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <LayoutPage />
      </WorkspaceShell>
    </ToastProvider>,
    { route: '/you/layout', phone: true },
  );
}

beforeEach(() => localStorage.clear());

describe('s3-layout', () => {
  it('s3-layout shows the board', async () => {
    const { container } = renderPhone();
    await screen.findByText(/Same data and settings in both\./);
    expectBoard('s3-layout', container);
  });

  it('heads the page with a back link to You and the desktop note is not shown', async () => {
    renderPhone();
    const head = (await screen.findByRole('heading', { name: 'Layout' })).closest('header')!;
    expect(within(head).getByRole('link', { name: 'You' })).toHaveAttribute('href', '/you');
    expect(screen.queryByText(/Only you · on every browser/)).toBeNull();
  });
});
