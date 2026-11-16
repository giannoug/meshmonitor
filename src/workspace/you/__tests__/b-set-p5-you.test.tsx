/**
 * @vitest-environment jsdom
 *
 * Board b-set-p5-you (Task 6.1): You on a phone with its Preferences: the
 * note that they apply to everyone (the map style follows the user), then
 * today's preference categories with today's labels.
 */
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { expectBoard } from '../../test/boardChecks';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import YouHome from '../YouHome';

function renderYou() {
  return renderWorkspace(
    <ToastProvider>
      <WorkspaceShell>
        <YouHome />
      </WorkspaceShell>
    </ToastProvider>,
    { route: '/you', phone: true },
  );
}

describe('b-set-p5-you', () => {
  it('b-set-p5-you shows the board', async () => {
    const { container } = renderYou();
    await screen.findByText('Notifications');
    expectBoard('b-set-p5-you', container);
  });

  it('lists today\'s preference categories under the note', async () => {
    renderYou();
    const note = await screen.findByText(/Preferences apply to everyone on this MeshMonitor/);
    expect(note.textContent).toContain('Map style is the one exception: it follows you.');
    const prefs = screen.getByRole('heading', { name: 'Preferences' }).parentElement!;
    const link = (name: string) => within(prefs).getByRole('link', { name: new RegExp(`^${name}`) });
    expect(link('Layout')).toHaveAttribute('href', '/you/layout');
    expect(link('Language')).toHaveAttribute('href', '/preferences/language');
    expect(link('Units & Formats')).toHaveAttribute('href', '/preferences/units');
    expect(link('Sorting')).toHaveAttribute('href', '/preferences/sorting');
    expect(link('Appearance')).toHaveAttribute('href', '/preferences/appearance');
    expect(link('Link Previews')).toHaveAttribute('href', '/preferences/link-previews');
    expect(link('Map')).toHaveAttribute('href', '/preferences/map');
  });
});
