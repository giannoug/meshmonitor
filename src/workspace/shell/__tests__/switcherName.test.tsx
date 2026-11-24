/**
 * @vitest-environment jsdom
 *
 * S23c (#6365): a switcher row's accessible name is its parts joined with commas.
 */
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../WorkspaceShell';

describe('device switcher row name', () => {
  it('the row\'s accessible name is "<name>, <chip>, <status>", with comma separators', async () => {
    renderWorkspace(
      <ToastProvider>
        <WorkspaceShell>
          <span />
        </WorkspaceShell>
      </ToastProvider>,
      { route: '/overview', phone: true },
    );
    fireEvent.click(await screen.findByRole('button', { name: /switch device/i }));
    const sheet = await screen.findByRole('dialog', { name: 'Devices' });
    await within(sheet).findByText('2');
    expect(within(sheet).getByRole('link', { name: 'Athens MQTT, Receive-only, MQTT broker · Connected' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Station G2, Meshtastic · Connected, 1 unread' })).toBeInTheDocument();
  });
});
