/**
 * @vitest-environment jsdom
 *
 * S8 (#6365): You › Layout does not show defaults for a preference it could not read.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWorkspace } from '../../test/renderWorkspace';
import { ToastProvider } from '../../../components/ToastContainer';
import LayoutPage from '../LayoutPage';

describe('You › Layout', () => {
  it('a failed preferences load shows an error, not defaults', async () => {
    renderWorkspace(
      <ToastProvider>
        <LayoutPage />
      </ToastProvider>,
      { route: '/you/layout', fixtures: { 'GET /api/user/preferences': () => new Response('{}', { status: 500 }) } },
    );
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
  });

  it('enables the choices once the preferences load', async () => {
    renderWorkspace(
      <ToastProvider>
        <LayoutPage />
      </ToastProvider>,
      { route: '/you/layout' },
    );
    await waitFor(() => expect(screen.getAllByRole('radio')[0]).toBeEnabled());
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
