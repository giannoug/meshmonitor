/**
 * @vitest-environment jsdom
 *
 * Task 6.2: with guests allowed, Login (the rail on desktop, You on the
 * phone, the read-only chat note) opens SignInCard in a Sheet: the same card
 * without the branding and footer (s11n0), and no Classic LoginModal. The
 * sheet's title follows the step. Closing it drops what was typed and stops
 * the passkey autofill wait, as LoginModal did.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../components/ToastContainer';
import WorkspaceShell from '../../shell/WorkspaceShell';
import YouHome from '../../you/YouHome';
import { CUSTOM_TITLE, signedOut, signInFixtures, TYPED_PASS } from '../../__fixtures__/signIn';
import { renderSignIn } from './signInHarness';

const passkey = vi.hoisted(() => ({ autofill: false, cancel: vi.fn(), signIn: vi.fn() }));
vi.mock('../../../services/passkeyClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/passkeyClient')>();
  return {
    ...actual,
    passkeyAutofillSupported: vi.fn(async () => passkey.autofill),
    cancelPasskeyCeremony: passkey.cancel,
    // The browser's autofill wait never answers here.
    signInWithPasskey: passkey.signIn,
  };
});

beforeEach(() => {
  passkey.autofill = false;
  passkey.cancel.mockReset();
  passkey.signIn.mockReset().mockImplementation(() => new Promise(() => {}));
});

const GUESTS = signInFixtures({ status: signedOut({ anonymousDisabled: false }), login: 'mfa' });

function renderShell(route: string, phone = false, page = <span />) {
  return renderSignIn(
    <ToastProvider>
      <WorkspaceShell>{page}</WorkspaceShell>
    </ToastProvider>,
    { route, phone, fixtures: GUESTS },
  );
}

async function openFromRail() {
  renderShell('/overview');
  const rail = await screen.findByRole('navigation', { name: 'Devices' });
  fireEvent.click(await within(rail).findByRole('button', { name: 'Login' }));
  return screen.findByRole('dialog', { name: 'Login' });
}

describe('sign-in dialog', () => {
  it('the rail opens the card in a sheet, without branding or footer', async () => {
    const dialog = await openFromRail();
    expect(within(dialog).getByRole('button', { name: 'Sign in with a passkey' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Username')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Login with OIDC' })).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(CUSTOM_TITLE);
    expect(dialog).not.toHaveTextContent(/Version|GitHub/);
    // Not Classic's LoginModal (its .form-group / .modal markup).
    expect(document.querySelector('.form-group, .modal-overlay, .modal')).toBeNull();
  });

  it('the title follows the step: Two-Factor Authentication', async () => {
    const dialog = await openFromRail();
    fireEvent.change(within(dialog).getByLabelText('Username'), { target: { value: 'giannoug' } });
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: TYPED_PASS } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('dialog', { name: 'Two-Factor Authentication' })).toBeInTheDocument();
  });

  it('closing drops the password; reopening starts at the first step', async () => {
    let dialog = await openFromRail();
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: TYPED_PASS } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.innerHTML).not.toContain(TYPED_PASS);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Devices' })).getByRole('button', { name: 'Login' }));
    dialog = await screen.findByRole('dialog', { name: 'Login' });
    expect(within(dialog).getByLabelText('Password')).toHaveValue('');
  });

  it('the passkey autofill waits while open and stops when the sheet closes', async () => {
    passkey.autofill = true;
    const dialog = await openFromRail();
    await waitFor(() => expect(passkey.signIn).toHaveBeenCalledWith({ autofill: true }));
    expect(passkey.cancel).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(passkey.cancel).toHaveBeenCalled());
  });

  it('the phone guest You tab opens the same card', async () => {
    renderShell('/you', true, <YouHome />);
    fireEvent.click(await screen.findByRole('button', { name: /^Login/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Login' });
    expect(within(dialog).getByLabelText('Username')).toBeInTheDocument();
    expect(dialog.querySelector('[data-phone]')).not.toBeNull();
  });
});
