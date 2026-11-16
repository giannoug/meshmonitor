/**
 * @vitest-environment jsdom
 *
 * Boards 11-04 (desktop) and 11-12 (phone), Task 6.1: turning password
 * sign-in off keeps today's order (s11n2): explain → the step-up browser
 * prompt ("Waiting for passkey…") → "Type DISABLE to confirm" only when the
 * server says the caller is the only admin → the recovery codes, which cannot
 * close until "I saved these codes" is ticked, and leave the page with Done.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expectBoard } from '../../test/boardChecks';
import { RECOVERY_CODES } from '../../__fixtures__/account';
import SecurityPage from '../SecurityPage';
import { joined, renderAccount } from './accountHarness';

const ASSERTION = { id: 'cred-1', rawId: 'cred-1', type: 'public-key', response: {}, clientExtensionResults: {} };
const prompt = vi.hoisted(() => ({ release: null as null | ((v: unknown) => void) }));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(() => new Promise((resolve) => { prompt.release = resolve; })),
}));

const calls: Array<{ path: string; body?: Record<string, unknown> }> = [];
function fixtures(onlyAdmin: boolean) {
  let asked = false;
  return {
    'POST /api/auth/passkey/step-up/options': () => {
      calls.push({ path: 'step-up/options' });
      return { success: true, data: { challenge: 'Y2hhbGxlbmdl', allowCredentials: [] } };
    },
    'POST /api/auth/passkey/password-login': (_u: URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ path: 'password-login', body });
      if (body.disabled === false) return { success: true, data: { disabled: false } };
      if (onlyAdmin && !body.confirm && !asked) {
        asked = true;
        return { success: true, data: { requireConfirm: true } };
      }
      return { success: true, data: { disabled: true, recoveryCodes: RECOVERY_CODES } };
    },
  };
}

beforeEach(() => {
  calls.length = 0;
  prompt.release = null;
});

async function turnOff(texts: string[], { phone = false, onlyAdmin = true } = {}) {
  renderAccount(<SecurityPage />, '/you/security', { phone, fixtures: fixtures(onlyAdmin) });
  fireEvent.click(await screen.findByRole('button', { name: 'Turn off password sign-in' }));
  const explain = await screen.findByRole('dialog', { name: 'Turn off password sign-in' });
  texts.push(explain.textContent ?? '');
  // Nothing has run yet: the prompt comes from Continue.
  expect(calls).toEqual([]);
  fireEvent.click(within(explain).getByRole('button', { name: 'Continue with a passkey' }));
  await waitFor(() => expect(prompt.release).not.toBeNull());
  expect(within(explain).getByRole('button', { name: 'Waiting for passkey…' })).toBeDisabled();
  expect(within(explain).getByRole('button', { name: 'Cancel' })).toBeDisabled();
  texts.push(explain.textContent ?? '');
  prompt.release!(ASSERTION);
}

async function confirmDisable(texts: string[]) {
  const sheet = await screen.findByRole('dialog', { name: 'Password sign-in' });
  texts.push(sheet.textContent ?? '');
  const confirm = within(sheet).getByRole('button', { name: 'Turn off password sign-in' });
  const field = within(sheet).getByLabelText('Type DISABLE to confirm');
  fireEvent.change(field, { target: { value: 'disable' } });
  expect(confirm).toBeDisabled();
  fireEvent.change(field, { target: { value: 'DISABLE' } });
  // Enter does not confirm (submitOnEnter false).
  fireEvent.submit(field.closest('form')!);
  expect(calls.filter((c) => c.body?.confirm)).toEqual([]);
  fireEvent.click(confirm);
}

describe('11-04-passkey-only', () => {
  it('11-04-passkey-only shows the board', async () => {
    const texts: string[] = [];
    await turnOff(texts);
    await confirmDisable(texts);
    const codes = await screen.findByRole('dialog', { name: 'Your recovery codes' });
    texts.push(codes.textContent ?? '');
    expectBoard('11-04-passkey-only', joined(texts));
  });

  it('runs today\'s requests in today\'s order, one prompt for both', async () => {
    await turnOff([]);
    await confirmDisable([]);
    await screen.findByRole('dialog', { name: 'Your recovery codes' });
    expect(calls).toEqual([
      { path: 'step-up/options' },
      { path: 'password-login', body: { disabled: true, assertion: ASSERTION } },
      { path: 'password-login', body: { disabled: true, assertion: ASSERTION, confirm: 'DISABLE' } },
    ]);
  });

  it('another admin exists: no DISABLE step, straight to the codes', async () => {
    await turnOff([], { onlyAdmin: false });
    await screen.findByRole('dialog', { name: 'Your recovery codes' });
    expect(screen.queryByLabelText('Type DISABLE to confirm')).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('the codes cannot close until saved, then leave the page', async () => {
    await turnOff([], { onlyAdmin: false });
    const sheet = await screen.findByRole('dialog', { name: 'Your recovery codes' });
    for (const code of RECOVERY_CODES) expect(within(sheet).getByText(code)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(sheet, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.getByRole('dialog', { name: 'Your recovery codes' })).toBeInTheDocument();
    const done = within(sheet).getByRole('button', { name: 'Done' });
    expect(done).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByLabelText('I saved these codes'));
    fireEvent.click(done);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.textContent).not.toContain(RECOVERY_CODES[0]);
    expect(await screen.findByText('Password sign-in is off')).toBeInTheDocument();
  });

  it('11-12-passkey-only shows the board', async () => {
    const texts: string[] = [];
    const off = renderAccount(<SecurityPage />, '/you/security', {
      phone: true,
      user: { passwordLoginDisabled: true },
      account: { passwordLoginDisabled: true, recoveryCodesLeft: 10 },
    });
    await screen.findByText('Turn password sign-in back on');
    texts.push(off.container.textContent ?? '');
    off.unmount();
    await turnOff([], { phone: true, onlyAdmin: false });
    const codes = await screen.findByRole('dialog', { name: 'Your recovery codes' });
    texts.push(codes.textContent ?? '');
    expectBoard('11-12-passkey-only', joined(texts));
  });

  it('turns password sign-in back on with the session alone', async () => {
    renderAccount(<SecurityPage />, '/you/security', {
      user: { passwordLoginDisabled: true },
      account: { passwordLoginDisabled: true, recoveryCodesLeft: 10 },
      fixtures: fixtures(false),
    });
    expect(await screen.findByText(/You have 10 recovery codes left/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Turn password sign-in back on' }));
    await waitFor(() => expect(calls).toEqual([{ path: 'password-login', body: { disabled: false } }]));
    expect(await screen.findByText('Password sign-in is back on')).toBeInTheDocument();
  });
});
