/**
 * @vitest-environment jsdom
 *
 * Board a-chat-D-desktop, frame only (Task 1.6): the device rail and the
 * layout-D sidebar. The chat pane is Phase 2, which owns the full
 * `expectBoard('a-chat-D-desktop')`; here only the frame's must strings.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

const check = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../__fixtures__/board-checks/a-chat-D-desktop.json'),
    'utf8',
  ),
) as { must: string[]; absent: string[] };

/** The board's must strings that belong to the rail and sidebar; the rest are chat content. */
const FRAME_MUST = ['Station G2', 'Nodes', 'Configuration', 'More tools…', 'Message a node', 'Direct messages'];

describe('a-chat-D-desktop (frame)', () => {
  it('shows the board frame', async () => {
    const { container, findByRole } = renderWorkspace(
      <ToastProvider>
        <WorkspaceShell>
          <p>page</p>
        </WorkspaceShell>
      </ToastProvider>,
      { route: '/source/src-g2/channels' },
    );
    const sidebar = await findByRole('complementary', { name: 'Station G2' });
    await within(sidebar).findByText('12 online');

    expect(check.must).toEqual(expect.arrayContaining(FRAME_MUST));
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    for (const s of FRAME_MUST) expect(text).toContain(s);
    for (const s of check.absent) expect(text).not.toContain(s);
  });
});
