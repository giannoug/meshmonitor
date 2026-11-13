/**
 * @vitest-environment jsdom
 *
 * Board r2-you-layout (Task 1.8): You › Layout on desktop. The page is built
 * here; the board's You sidebar (account head, Account and Preferences
 * groups, Help & about, Sign out) is Task 6.1's `YouSidebar`, which owns the
 * rest of `expectBoard('r2-you-layout')`. Here only the page's must strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWorkspace, type RenderWorkspaceOptions } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import { useLayout } from '../../layout/useLayout';
import LayoutPage from '../LayoutPage';
import { prefsFixture } from '../../__fixtures__/prefsFixture';

const check = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../__fixtures__/board-checks/r2-you-layout.json'), 'utf8'),
) as { must: string[]; absent: string[] };

/** The board's must strings that belong to the page; the rest are the You sidebar (6.1). */
const PAGE_MUST = [
  'Only you · on every browser you sign in from',
  'Both layouts show the same data and settings',
  'Messages as',
  'Hops, SNR and route',
  'Rows',
];

/** What LayoutGate would decide right now, from the same queries. */
function GateProbe() {
  return <span data-testid="gate">{useLayout().layout}</span>;
}

function renderLayout(opts: RenderWorkspaceOptions = {}) {
  return renderWorkspace(
    <ToastProvider>
      <GateProbe />
      <WorkspaceShell>
        <LayoutPage />
      </WorkspaceShell>
    </ToastProvider>,
    { route: '/you/layout', ...opts },
  );
}

beforeEach(() => localStorage.clear());

describe('r2-you-layout', () => {
  it('r2-you-layout shows the board (page)', async () => {
    const { container } = renderLayout();
    await screen.findByText('Only you · on every browser you sign in from');
    expect(check.must).toEqual(expect.arrayContaining(PAGE_MUST));
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    for (const s of PAGE_MUST) expect(text).toContain(s);
    for (const s of check.absent) expect(text).not.toContain(s);
  });

  it('marks the current layout and shows the In Workspace defaults', async () => {
    renderLayout();
    await waitFor(() => expect(screen.getByRole('radio', { name: /^Workspace/ })).toBeChecked());
    expect(screen.getByRole('radio', { name: /^Classic/ })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Messages as' })).toHaveDisplayValue('Rows (Slack-style)');
    expect(screen.getByRole('combobox', { name: 'Hops, SNR and route' })).toHaveDisplayValue('On hover or tap');
  });

  it('choosing Classic saves layout=classic and moves the gate (and its mirror) to Classic', async () => {
    const prefs = prefsFixture({ layout: 'workspace' });
    renderLayout({ fixtures: prefs.fixtures });
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('workspace'));
    fireEvent.click(screen.getByRole('radio', { name: /^Classic/ }));
    await waitFor(() => expect(prefs.puts).toEqual([['layout', 'classic']]));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('classic'));
    await waitFor(() => expect(localStorage.getItem('mm.layout')).toBe('classic'));
  });

  it('saves the message style and signal detail preferences', async () => {
    const prefs = prefsFixture({ layout: 'workspace' });
    renderLayout({ fixtures: prefs.fixtures });
    const style = await screen.findByRole('combobox', { name: 'Messages as' });
    fireEvent.change(style, { target: { value: 'bubbles' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Hops, SNR and route' }), { target: { value: 'always' } });
    await waitFor(() =>
      expect(prefs.puts).toEqual([
        ['workspace.messageStyle', 'bubbles'],
        ['workspace.signalDetail', 'always'],
      ]),
    );
    expect(style).toHaveDisplayValue('Bubbles');
  });

  it('a guest cannot choose: the controls are off', async () => {
    renderLayout({ anonymous: true });
    expect(await screen.findByText('Sign in to choose your layout.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Classic/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Messages as' })).toBeDisabled();
  });
});
